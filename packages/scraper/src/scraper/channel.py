"""YouTube channel scraper using yt-dlp."""

import json
import logging
import re
from pathlib import Path
from typing import Any

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

# Set up logging
logger = logging.getLogger(__name__)


class _NullLogger:
    """Suppress all yt-dlp logging output."""
    def debug(self, msg): pass
    def info(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass


# Rich metadata fields we extract for each video
VIDEO_METADATA_FIELDS = [
    "id",
    "title",
    "description",
    "upload_date",
    "duration",
    "duration_string",
    "channel",
    "channel_id",
    "thumbnail",
    "tags",
    "categories",
    "url",
    "live_status",  # is_live, was_live, not_live, is_upcoming
]


def get_channel_video_ids(channel_url: str) -> tuple[str, list[dict[str, Any]]]:
    """
    Fast fetch of all video IDs and basic info from a channel.
    Uses flat extraction - very fast but limited metadata.

    Args:
        channel_url: YouTube channel URL (e.g., https://www.youtube.com/@triggerpod)

    Returns:
        Tuple of (channel_title, list of video dicts with basic info)
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "ignoreerrors": True,
    }

    if not channel_url.endswith("/videos"):
        channel_url = channel_url.rstrip("/") + "/videos"

    logger.info(f"Fetching video list from: {channel_url}")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(channel_url, download=False)

            if result is None:
                logger.error(f"yt-dlp returned None for channel: {channel_url}")
                return "", []

            entries = result.get("entries", [])
            channel_title = result.get("channel", result.get("uploader", "Unknown"))

            logger.info(f"Found {len(entries)} videos from: {channel_title}")

            videos = []
            for entry in entries:
                if entry is None:
                    continue
                videos.append({
                    "id": entry.get("id"),
                    "title": entry.get("title"),
                    "url": entry.get("url"),
                    "duration": entry.get("duration"),
                })

            return channel_title, videos

    except Exception as e:
        logger.error(f"yt-dlp error fetching channel {channel_url}: {e}")
        return "", []


def get_channel_metadata(channel_url: str) -> dict[str, Any]:
    """
    Get channel metadata including description.

    Args:
        channel_url: YouTube channel URL (e.g., https://www.youtube.com/@triggerpod)

    Returns:
        Channel metadata dict with name, description, subscriber_count, etc.
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "ignoreerrors": True,
        "logger": _NullLogger(),
    }

    # Use /about page which has more channel info
    if not channel_url.endswith("/about"):
        channel_url = channel_url.rstrip("/").replace("/videos", "") + "/about"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(channel_url, download=False)

            if result is None:
                logger.warning(f"yt-dlp returned None for channel metadata: {channel_url}")
                return {}

            # Get the best thumbnail URL from the thumbnails list
            thumbnails = result.get("thumbnails", [])
            thumbnail_url = thumbnails[-1].get("url") if thumbnails else None

            return {
                "name": result.get("channel", result.get("uploader", "")),
                "description": result.get("description", ""),
                "subscriber_count": result.get("channel_follower_count"),
                "channel_id": result.get("channel_id"),
                "thumbnail_url": thumbnail_url,
            }

    except Exception as e:
        logger.error(f"yt-dlp error fetching channel metadata {channel_url}: {e}")
        return {}


def get_video_metadata(video_id: str) -> dict[str, Any]:
    """
    Get rich metadata for a single video.

    Args:
        video_id: YouTube video ID

    Returns:
        Video metadata dictionary
    """
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "ignoreerrors": True,
        "extract_flat": False,
        "noprogress": True,
        "logger": _NullLogger(),
    }

    video_url = f"https://www.youtube.com/watch?v={video_id}"

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)

            if info is None:
                logger.warning(f"yt-dlp returned None for video: {video_id}")
                return {"id": video_id}

            data = {field: info.get(field) for field in VIDEO_METADATA_FIELDS}
            data["url"] = info.get("webpage_url")  # Normalize URL field
            return data

    except Exception as e:
        logger.error(f"yt-dlp error fetching video metadata {video_id}: {e}")
        return {"id": video_id}


def get_transcript(video_id: str, lang: str = "en") -> str | None:
    """
    Get transcript/captions as plain text for a video.

    Uses youtube-transcript-api which handles YouTube's transcript API directly.

    Args:
        video_id: YouTube video ID
        lang: Language code (default: en)

    Returns:
        Plain text transcript or None if not available
    """
    try:
        ytt_api = YouTubeTranscriptApi()

        # Try to get transcript in preferred language order
        languages_to_try = [lang, f"{lang}-US", f"{lang}-GB", "en", "en-US", "en-GB"]

        transcript = ytt_api.fetch(video_id, languages=languages_to_try)

        # Join all text segments
        text = " ".join([entry.text for entry in transcript])

        # Clean up the text
        text = re.sub(r"\s+", " ", text).strip()

        return text if text else None

    except Exception as e:
        logger.debug(f"Transcript not available for {video_id}: {e}")
        return None


# --- High-level functions ---


def fetch_channel_videos(
    channel_url: str,
    output_file: Path | None = None,
    enrich_metadata: bool = True,
    metadata_limit: int | None = None,
    save_every: int = 10,
) -> list[dict[str, Any]]:
    """
    Fetch all videos from a channel with optional rich metadata.

    Args:
        channel_url: YouTube channel URL
        output_file: Path to save JSON output
        enrich_metadata: If True, fetch rich metadata (slower)
        metadata_limit: Limit how many videos to enrich (None = all)
        save_every: Save to file every N videos (default: 10)

    Returns:
        List of video dictionaries
    """
    channel_title, videos = get_channel_video_ids(channel_url)

    if not videos:
        return []

    # Add channel info to all videos
    for v in videos:
        v["channel"] = channel_title

    # Save basic list immediately
    if output_file:
        save_videos(videos, output_file)

    if enrich_metadata:
        limit = metadata_limit if metadata_limit else len(videos)
        print(f"\nFetching rich metadata for {limit} videos...")

        for i, video in enumerate(videos[:limit]):
            print(f"  [{i + 1}/{limit}] {video.get('title', 'Unknown')[:50]}...", flush=True)
            metadata = get_video_metadata(video["id"])
            video.update(metadata)

            # Save progress every N videos
            if output_file and (i + 1) % save_every == 0:
                save_videos(videos, output_file)
                print(f"  >> Saved progress ({i + 1} videos enriched)", flush=True)

        # Final save
        if output_file:
            save_videos(videos, output_file)

    return videos


def add_transcripts(
    videos: list[dict[str, Any]],
    limit: int | None = None,
    output_file: Path | None = None,
    save_every: int = 5,
) -> list[dict[str, Any]]:
    """
    Add transcripts to videos that don't have them yet.

    Args:
        videos: List of video dictionaries
        limit: Max number of transcripts to fetch (None = all)
        output_file: Path to save updated JSON
        save_every: Save to file every N transcripts (default: 5)

    Returns:
        Updated list of videos
    """
    # Find videos without transcripts
    needs_transcript = [v for v in videos if v.get("transcript") is None]

    if not needs_transcript:
        print("All videos already have transcripts")
        return videos

    count = min(limit, len(needs_transcript)) if limit else len(needs_transcript)
    print(f"\nFetching transcripts for {count} videos...")

    for i, video in enumerate(needs_transcript[:count]):
        video_id = video.get("id")
        if not video_id:
            continue

        print(f"  [{i + 1}/{count}] {video.get('title', 'Unknown')[:50]}...", flush=True)
        video["transcript"] = get_transcript(video_id)

        # Save progress every N transcripts
        if output_file and (i + 1) % save_every == 0:
            save_videos(videos, output_file)
            print(f"  >> Saved progress ({i + 1} transcripts fetched)", flush=True)

    # Final save
    if output_file:
        save_videos(videos, output_file)

    return videos


def load_videos(file_path: Path) -> list[dict[str, Any]]:
    """Load videos from JSON file."""
    with open(file_path, encoding="utf-8") as f:
        return json.load(f)


def save_videos(videos: list[dict[str, Any]], file_path: Path) -> None:
    """Save videos to JSON file."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)
    print(f"Saved to: {file_path}")


# --- CLI ---


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="YouTube channel scraper")
    parser.add_argument("channel_url", nargs="?", help="YouTube channel URL")
    parser.add_argument("-o", "--output", type=Path, help="Output JSON file")
    parser.add_argument("--fast", action="store_true", help="Skip rich metadata (faster)")
    parser.add_argument("--metadata-limit", type=int, help="Limit metadata fetching")
    parser.add_argument("--transcripts", type=int, metavar="N", help="Fetch transcripts for N videos")
    parser.add_argument("--input", type=Path, help="Input JSON file (for adding transcripts)")

    args = parser.parse_args()

    output_dir = Path(__file__).parent.parent.parent / "output"

    # Mode 1: Add transcripts to existing file
    if args.input:
        videos = load_videos(args.input)
        output_file = args.output or args.input
        add_transcripts(videos, limit=args.transcripts, output_file=output_file)

    # Mode 2: Fetch channel videos
    elif args.channel_url:
        output_file = args.output or output_dir / "videos.json"
        videos = fetch_channel_videos(
            args.channel_url,
            output_file=output_file,
            enrich_metadata=not args.fast,
            metadata_limit=args.metadata_limit,
        )

        if args.transcripts:
            add_transcripts(videos, limit=args.transcripts, output_file=output_file)

        print(f"\nTotal: {len(videos)} videos")

    else:
        parser.print_help()
