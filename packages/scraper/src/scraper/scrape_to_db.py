"""
Scrape YouTube channels and save to Supabase.

This script reads channels from channels.json and scrapes the latest videos
to the Supabase database.
"""

import argparse
import json
import logging
import time
from pathlib import Path

from .channel import (
    get_channel_video_ids,
    get_channel_metadata,
    get_video_metadata,
)
from .transcript import fetch_transcript
from .db import (
    get_or_create_source,
    upsert_videos_batch,
    update_source_scraped_at,
    create_scrape_log,
    complete_scrape_log,
    add_video_tags,
    video_has_transcript,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)
# Set transcript module to INFO to see provider fallbacks
logging.getLogger("scraper.transcript").setLevel(logging.INFO)
# Suppress noisy HTTP request logs from httpx/httpcore
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def load_channels_config(config_path: Path | None = None) -> dict[str, str]:
    """Load channels configuration from JSON file."""
    if config_path is None:
        config_path = Path(__file__).parent.parent.parent / "channels.json"

    with open(config_path, encoding="utf-8") as f:
        return json.load(f)


def scrape_channel_to_db(
    channel_name: str,
    channel_handle: str,
    video_limit: int = 10,
    fetch_transcripts: bool = True,
    fetch_metadata: bool = True,
    verbose: bool = True,
    transcript_providers: list[str] | None = None,
) -> dict:
    """
    Scrape a single channel and save to Supabase.

    Args:
        channel_name: Display name of the channel
        channel_handle: YouTube handle (e.g., @triggerpod)
        video_limit: Maximum number of videos to scrape
        fetch_transcripts: Whether to fetch transcripts
        verbose: Print progress messages
        transcript_providers: List of providers to use for transcripts (default: ["youtube_api", "supadata"])

    Returns:
        Stats dict with counts
    """
    stats = {
        "videos_found": 0,
        "videos_processed": 0,
        "transcripts_added": 0,
        "errors": [],
    }

    channel_url = f"https://www.youtube.com/{channel_handle}"
    channel_start_time = time.time()

    if verbose:
        print(f"\n{'='*60}")
        print(f"Scraping: {channel_name} ({channel_handle})")
        print(f"{'='*60}")

    # Get video list from YouTube
    if verbose:
        print(f"Fetching video list...")

    start_time = time.time()
    channel_title, videos = get_channel_video_ids(channel_url)
    video_list_time = time.time() - start_time

    if not videos:
        stats["errors"].append("No videos found")
        return stats

    stats["videos_found"] = len(videos)

    if verbose:
        print(f"Found {len(videos)} videos, processing {min(video_limit, len(videos))} ({video_list_time:.1f}s)")

    # Limit videos
    videos_to_process = videos[:video_limit]

    # Get channel metadata (including description)
    channel_metadata = {}
    try:
        channel_metadata = get_channel_metadata(channel_url)
        if verbose and channel_metadata.get("description"):
            print(f"Fetched channel description ({len(channel_metadata.get('description', ''))} chars)")
    except Exception as e:
        if verbose:
            print(f"Could not fetch channel metadata: {e}")

    # Get or create source in database
    # Extract channel_id from first video's metadata if possible
    source = get_or_create_source(
        external_id=channel_handle.lstrip("@"),
        name=channel_name,
        handle=channel_handle,
        source_type="youtube_channel",
        description=channel_metadata.get("description"),
        subscriber_count=channel_metadata.get("subscriber_count"),
        thumbnail_url=channel_metadata.get("thumbnail_url"),
    )
    source_id = source["id"]

    if verbose:
        print(f"Source ID: {source_id}")

    # Create scrape log
    scrape_log = create_scrape_log(source_id)
    log_id = scrape_log["id"]

    try:
        # Enrich videos with metadata
        enriched_videos = []

        for i, video in enumerate(videos_to_process):
            video_id = video.get("id")
            if not video_id:
                continue

            if verbose:
                title_preview = video.get('title', 'Unknown')[:50]
                print(f"  [{i+1}/{len(videos_to_process)}] {title_preview}...")

            # Get rich metadata
            if fetch_metadata:
                try:
                    meta_start = time.time()
                    metadata = get_video_metadata(video_id)
                    meta_time = time.time() - meta_start
                    video.update(metadata)
                    if verbose:
                        print(f"      ✓ metadata ({meta_time:.1f}s)")
                except Exception as e:
                    stats["errors"].append(f"Metadata error for {video_id}: {e}")
                    if verbose:
                        print(f"      ✗ metadata failed")

            # Get transcript if requested
            if fetch_transcripts:
                # Check if transcript already exists in database
                if video_has_transcript(video_id):
                    if verbose:
                        print(f"      ○ transcript (already in DB)")
                else:
                    # Fetch transcript using configured providers
                    transcript_start = time.time()
                    result = fetch_transcript(video_id, providers=transcript_providers)
                    transcript_time = time.time() - transcript_start
                    if result.success:
                        video["transcript"] = result.content
                        video["transcript_language"] = result.language
                        stats["transcripts_added"] += 1
                        if verbose:
                            print(f"      ✓ transcript ({len(result.content)} chars, {result.provider}, {transcript_time:.1f}s)")
                    else:
                        if verbose:
                            print(f"      - no transcript ({transcript_time:.1f}s): {result.error}")

            enriched_videos.append(video)
            stats["videos_processed"] += 1

        # Batch upsert to database
        if enriched_videos:
            if verbose:
                print(f"\nSaving {len(enriched_videos)} videos to database...")

            db_start = time.time()
            saved_videos = upsert_videos_batch(
                source_id, enriched_videos, has_rich_metadata=fetch_metadata
            )
            db_time = time.time() - db_start

            # Add tags for each video
            tags_start = time.time()
            for i, video in enumerate(enriched_videos):
                tags = video.get("tags", [])
                if tags and saved_videos and i < len(saved_videos):
                    try:
                        add_video_tags(saved_videos[i]["id"], tags[:20])  # Limit tags
                    except Exception as e:
                        stats["errors"].append(f"Tags error: {e}")
            tags_time = time.time() - tags_start

            if verbose:
                print(f"Saved {len(saved_videos)} videos (db: {db_time:.1f}s, tags: {tags_time:.1f}s)")

        # Update source scraped timestamp
        update_source_scraped_at(source_id)

        # Complete scrape log
        complete_scrape_log(
            log_id,
            status="completed",
            videos_found=stats["videos_found"],
            videos_new=stats["videos_processed"],
            transcripts_added=stats["transcripts_added"],
        )

        # Print timing summary
        total_time = time.time() - channel_start_time
        if verbose:
            print(f"\n--- Timing Summary ---")
            print(f"Total: {total_time:.1f}s for {stats['videos_processed']} videos")
            if stats['videos_processed'] > 0:
                print(f"Average: {total_time / stats['videos_processed']:.1f}s per video")

    except Exception as e:
        stats["errors"].append(str(e))
        complete_scrape_log(
            log_id,
            status="failed",
            videos_found=stats["videos_found"],
            error_message=str(e),
        )
        raise

    return stats


def scrape_all_channels(
    video_limit: int = 10,
    fetch_transcripts: bool = True,
    fetch_metadata: bool = True,
    channels_filter: list[str] | None = None,
    verbose: bool = True,
    transcript_providers: list[str] | None = None,
) -> dict:
    """
    Scrape all channels from channels.json to Supabase.

    Args:
        video_limit: Maximum videos per channel
        fetch_transcripts: Whether to fetch transcripts
        channels_filter: Optional list of channel names to filter
        verbose: Print progress messages
        transcript_providers: List of providers to use for transcripts

    Returns:
        Combined stats dict
    """
    channels = load_channels_config()

    if channels_filter:
        channels = {k: v for k, v in channels.items() if k in channels_filter}

    total_stats = {
        "channels_processed": 0,
        "total_videos_found": 0,
        "total_videos_processed": 0,
        "total_transcripts_added": 0,
        "errors": [],
    }

    if verbose:
        print(f"\nScraping {len(channels)} channels, {video_limit} videos each")
        print(f"Metadata: {'enabled' if fetch_metadata else 'disabled'}")
        print(f"Transcripts: {'enabled' if fetch_transcripts else 'disabled'}")

    for channel_name, channel_handle in channels.items():
        try:
            stats = scrape_channel_to_db(
                channel_name=channel_name,
                channel_handle=channel_handle,
                video_limit=video_limit,
                fetch_transcripts=fetch_transcripts,
                fetch_metadata=fetch_metadata,
                verbose=verbose,
                transcript_providers=transcript_providers,
            )

            total_stats["channels_processed"] += 1
            total_stats["total_videos_found"] += stats["videos_found"]
            total_stats["total_videos_processed"] += stats["videos_processed"]
            total_stats["total_transcripts_added"] += stats["transcripts_added"]
            total_stats["errors"].extend(stats["errors"])

        except Exception as e:
            total_stats["errors"].append(f"{channel_name}: {e}")
            if verbose:
                print(f"ERROR scraping {channel_name}: {e}")

    if verbose:
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Channels processed: {total_stats['channels_processed']}")
        print(f"Total videos found: {total_stats['total_videos_found']}")
        print(f"Total videos saved: {total_stats['total_videos_processed']}")
        print(f"Transcripts added: {total_stats['total_transcripts_added']}")
        if total_stats["errors"]:
            print(f"Errors: {len(total_stats['errors'])}")
            for err in total_stats["errors"][:5]:
                print(f"  - {err}")

    return total_stats


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Scrape YouTube channels to Supabase database"
    )
    parser.add_argument(
        "-n", "--limit",
        type=int,
        default=10,
        help="Number of videos per channel (default: 10)"
    )
    parser.add_argument(
        "--no-transcripts",
        action="store_true",
        help="Skip fetching transcripts"
    )
    parser.add_argument(
        "-c", "--channels",
        nargs="+",
        help="Specific channel names to scrape (default: all)"
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Minimal output"
    )
    parser.add_argument(
        "--single",
        type=str,
        metavar="HANDLE",
        help="Scrape a single channel by handle (e.g., @triggerpod)"
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Skip fetching rich metadata (faster, only gets id/title/duration)"
    )
    parser.add_argument(
        "--supadata-only",
        action="store_true",
        help="Use only Supadata for transcripts (skip youtube_api)"
    )

    args = parser.parse_args()

    # Determine transcript providers
    transcript_providers = ["supadata"] if args.supadata_only else None

    if args.single:
        # Single channel mode
        scrape_channel_to_db(
            channel_name=args.single,
            channel_handle=args.single,
            video_limit=args.limit,
            fetch_transcripts=not args.no_transcripts,
            fetch_metadata=not args.fast,
            verbose=not args.quiet,
            transcript_providers=transcript_providers,
        )
    else:
        # All channels mode
        scrape_all_channels(
            video_limit=args.limit,
            fetch_transcripts=not args.no_transcripts,
            fetch_metadata=not args.fast,
            channels_filter=args.channels,
            verbose=not args.quiet,
            transcript_providers=transcript_providers,
        )


if __name__ == "__main__":
    main()
