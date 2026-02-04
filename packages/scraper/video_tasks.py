"""
Helper script for Claude Code to manage video transcripts and summaries.

Usage:
    # Show overall status
    uv run python video_tasks.py status

    # Sync new videos from all channels (only new ones, with transcripts)
    uv run python video_tasks.py sync-new [--limit N]

    # Get next video needing a transcript
    uv run python video_tasks.py next-transcript

    # Fetch and save transcript for a video
    uv run python video_tasks.py fetch-transcript <video_id>

    # Get next video needing a summary (has transcript but no summary)
    uv run python video_tasks.py next-summary

    # Save a summary for a video
    uv run python video_tasks.py save-summary <video_id> "<summary>"

    # Batch fetch all missing transcripts
    uv run python video_tasks.py fetch-all-transcripts [--limit N]
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from src.scraper.db import get_client
from src.scraper.transcript import fetch_transcript
from src.scraper.channel import get_channel_video_ids, get_video_metadata


def get_status():
    """Show overall status of videos, transcripts, and summaries."""
    client = get_client()

    # Total videos
    total = client.table("videos").select("id", count="exact").execute()

    # Videos with transcripts
    with_transcript = (
        client.table("videos")
        .select("id", count="exact")
        .not_.is_("transcript", "null")
        .execute()
    )

    # Videos without transcripts
    without_transcript = (
        client.table("videos")
        .select("id", count="exact")
        .is_("transcript", "null")
        .execute()
    )

    # Videos with summaries
    with_summary = (
        client.table("videos")
        .select("id", count="exact")
        .not_.is_("summary", "null")
        .execute()
    )

    # Videos needing summaries (have transcript but no summary)
    needs_summary = (
        client.table("videos")
        .select("id", count="exact")
        .not_.is_("transcript", "null")
        .is_("summary", "null")
        .execute()
    )

    print("=== VIDEO STATUS ===")
    print(f"Total videos: {total.count}")
    print()
    print("--- Transcripts ---")
    print(f"With transcript: {with_transcript.count}")
    print(f"Missing transcript: {without_transcript.count}")
    print()
    print("--- Summaries ---")
    print(f"With summary: {with_summary.count}")
    print(f"Needs summary (has transcript): {needs_summary.count}")


def get_next_transcript():
    """Get the next video that needs a transcript."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, external_id, title, url")
        .is_("transcript", "null")
        .order("published_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        print("NO_MORE_VIDEOS")
        print("All videos have transcripts!")
        return None

    video = result.data[0]
    print(f"VIDEO_ID: {video['id']}")
    print(f"EXTERNAL_ID: {video['external_id']}")
    print(f"TITLE: {video['title']}")
    print(f"URL: {video['url']}")
    return video


def fetch_and_save_transcript(video_id: str):
    """Fetch transcript for a video and save it to the database."""
    client = get_client()

    # Get video details
    result = (
        client.table("videos")
        .select("id, external_id, title")
        .eq("id", video_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        print(f"ERROR: Video {video_id} not found")
        return False

    video = result.data[0]
    external_id = video['external_id']

    print(f"Fetching transcript for: {video['title']}")
    print(f"YouTube ID: {external_id}")

    # Fetch transcript
    transcript_result = fetch_transcript(external_id)

    if not transcript_result.success:
        print(f"FAILED: {transcript_result.error}")
        return False

    # Save to database
    client.table("videos").update({
        "transcript": transcript_result.content,
        "transcript_language": transcript_result.language or "en",
        "has_transcript": True,
        "transcript_scraped_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", video_id).execute()

    print(f"SUCCESS: Saved transcript ({len(transcript_result.content)} chars)")
    print(f"Provider: {transcript_result.provider}")
    return True


def fetch_all_transcripts(limit: int = 100):
    """Fetch transcripts for all videos that are missing them."""
    client = get_client()

    # Get videos without transcripts
    result = (
        client.table("videos")
        .select("id, external_id, title")
        .is_("transcript", "null")
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
    )

    if not result.data:
        print("All videos have transcripts!")
        return

    total = len(result.data)
    success_count = 0
    fail_count = 0

    print(f"Fetching transcripts for {total} videos...")
    print()

    for i, video in enumerate(result.data, 1):
        print(f"[{i}/{total}] {video['title'][:60]}...")

        transcript_result = fetch_transcript(video['external_id'])

        if transcript_result.success:
            # Save to database
            client.table("videos").update({
                "transcript": transcript_result.content,
                "transcript_language": transcript_result.language or "en",
                "has_transcript": True,
                "transcript_scraped_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", video['id']).execute()

            print(f"  ✓ Saved ({len(transcript_result.content)} chars)")
            success_count += 1
        else:
            print(f"  ✗ Failed: {transcript_result.error}")
            fail_count += 1

    print()
    print(f"=== COMPLETE ===")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")


def get_next_summary():
    """Get the next video that needs a summary (has transcript but no summary)."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, title, transcript")
        .not_.is_("transcript", "null")
        .is_("summary", "null")
        .limit(1)
        .execute()
    )

    if not result.data:
        print("NO_MORE_VIDEOS")
        print("All videos with transcripts have summaries!")
        return None

    video = result.data[0]
    print(f"VIDEO_ID: {video['id']}")
    print(f"TITLE: {video['title']}")
    print(f"TRANSCRIPT_LENGTH: {len(video['transcript'])} chars")
    print("---TRANSCRIPT_START---")
    print(video['transcript'])
    print("---TRANSCRIPT_END---")
    return video


def list_pending_summaries(limit: int = 5):
    """List videos that need summaries (metadata only, no transcripts)."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, title, external_id, duration_seconds")
        .not_.is_("transcript", "null")
        .is_("summary", "null")
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
    )

    if not result.data:
        print("NO_MORE_VIDEOS")
        print("All videos with transcripts have summaries!")
        return []

    print(f"=== {len(result.data)} VIDEOS PENDING SUMMARIES ===")
    for i, video in enumerate(result.data, 1):
        duration_min = (video.get('duration_seconds') or 0) // 60
        print(f"{i}. {video['id']}")
        print(f"   Title: {video['title']}")
        print(f"   Duration: {duration_min} min")
        print()
    return result.data


def get_transcript(video_id: str):
    """Get the transcript for a specific video."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, title, transcript")
        .eq("id", video_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        print(f"ERROR: Video {video_id} not found")
        return None

    video = result.data[0]
    if not video.get('transcript'):
        print(f"ERROR: Video {video_id} has no transcript")
        return None

    print(f"VIDEO_ID: {video['id']}")
    print(f"TITLE: {video['title']}")
    print(f"TRANSCRIPT_LENGTH: {len(video['transcript'])} chars")
    print("---TRANSCRIPT_START---")
    print(video['transcript'])
    print("---TRANSCRIPT_END---")
    return video


def save_summary(video_id: str, summary: str):
    """Save a summary for a video."""
    client = get_client()

    client.table("videos").update({
        "summary": summary,
        "summary_generated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", video_id).execute()

    print(f"Saved summary for video {video_id} ({len(summary)} chars)")


def sync_new_videos(limit_per_channel: int = 20, new_channel_limit: int = 10):
    """
    Sync new videos from all channels.

    Only fetches videos that are more recent than the latest video
    already stored for each channel. Fetches transcripts for new videos.

    For channels with no existing videos (newly added), only fetches the
    most recent `new_channel_limit` videos to avoid backfilling too much.
    """
    client = get_client()

    # Load channels config
    config_path = Path(__file__).parent / "channels.json"
    with open(config_path, encoding="utf-8") as f:
        channels = json.load(f)

    # Get all sources with their latest video date
    sources_result = client.table("sources").select("id, handle").execute()
    source_by_handle = {s["handle"]: s["id"] for s in sources_result.data}

    print(f"=== SYNC NEW VIDEOS ===")
    print(f"Channels: {len(channels)}")
    print()

    MIN_DURATION_SECONDS = 20 * 60  # 20 minutes minimum

    total_new = 0
    total_transcripts = 0

    for channel_name, channel_handle in channels.items():
        print(f"\n--- {channel_name} ({channel_handle}) ---")

        # Get source_id for this channel
        source_id = source_by_handle.get(channel_handle)
        if not source_id:
            print(f"  ERROR: Source not found for {channel_handle}")
            continue

        # Get existing video IDs AND the latest video date for this channel
        existing_result = (
            client.table("videos")
            .select("external_id, published_at")
            .eq("source_id", source_id)
            .order("published_at", desc=True)
            .execute()
        )
        existing_ids = {v["external_id"] for v in existing_result.data}

        # Determine if this is a new channel (no videos) or existing
        is_new_channel = len(existing_ids) == 0
        latest_date = None

        if not is_new_channel and existing_result.data[0].get("published_at"):
            latest_date = existing_result.data[0]["published_at"][:10]  # YYYY-MM-DD
            print(f"  Latest video in DB: {latest_date}")
        else:
            print(f"  No videos in DB for this channel (new channel)")

        channel_url = f"https://www.youtube.com/{channel_handle}"

        try:
            # Get video list from YouTube
            _, videos = get_channel_video_ids(channel_url)

            if not videos:
                print("  No videos found")
                continue

            # Filter: duration >= 20 min
            videos = [v for v in videos if (v.get("duration") or 0) >= MIN_DURATION_SECONDS]

            # Find new videos: iterate in order (newest first from YouTube) and stop
            # when we hit an existing video. This ensures we only get truly NEW videos,
            # not old videos that were never synced.
            new_videos = []
            for v in videos:
                if v.get("id") in existing_ids:
                    # Hit an existing video - all subsequent videos are older, stop here
                    break
                new_videos.append(v)

            # For new channels: only take the most recent N videos (avoid backfilling)
            # For existing channels: take up to limit_per_channel new videos
            if is_new_channel:
                # New channel: only get the last few videos
                new_videos = new_videos[:new_channel_limit]
                print(f"  {len(videos)} videos found, taking {len(new_videos)} most recent (new channel)")
            else:
                # Existing channel: limit to most recent N new videos
                new_videos = new_videos[:limit_per_channel]

            if not new_videos:
                print(f"  {len(videos)} videos found, 0 new")
                continue

            if not is_new_channel:
                print(f"  {len(videos)} videos found, {len(new_videos)} new")

            # Process each new video
            for video in new_videos:
                video_id = video.get("id")
                title = video.get("title", "Unknown")[:50]
                print(f"  + {title}...")

                # Fetch rich metadata
                try:
                    metadata = get_video_metadata(video_id)
                    video.update(metadata)
                except Exception as e:
                    print(f"    ✗ metadata failed: {e}")

                # Skip live/upcoming videos (no transcript available)
                live_status = video.get("live_status")
                if live_status in ("is_live", "is_upcoming"):
                    print(f"    - skipping: {live_status}")
                    continue

                # Fetch transcript
                transcript_result = fetch_transcript(video_id)
                if transcript_result.success:
                    video["transcript"] = transcript_result.content
                    video["transcript_language"] = transcript_result.language
                    total_transcripts += 1
                    print(f"    ✓ transcript ({len(transcript_result.content)} chars)")
                else:
                    print(f"    - no transcript: {transcript_result.error}")

                # Save to database
                now = datetime.now(timezone.utc).isoformat()
                db_video = {
                    "source_id": source_id,
                    "external_id": video_id,
                    "url": video.get("url"),
                    "title": video.get("title"),
                    "description": video.get("description"),
                    "duration_seconds": int(video.get("duration", 0)),
                    "duration_string": video.get("duration_string"),
                    "thumbnail_url": video.get("thumbnail"),
                    "view_count": video.get("view_count"),
                    "like_count": video.get("like_count"),
                    "comment_count": video.get("comment_count"),
                    "metadata_scraped_at": now,
                }

                # Parse upload date
                upload_date = video.get("upload_date")
                if upload_date and len(upload_date) == 8:
                    db_video["upload_date"] = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
                    db_video["published_at"] = f"{db_video['upload_date']}T00:00:00Z"

                # Add transcript if available
                if video.get("transcript"):
                    db_video["transcript"] = video["transcript"]
                    db_video["transcript_language"] = video.get("transcript_language", "en")
                    db_video["has_transcript"] = True
                    db_video["transcript_scraped_at"] = now

                client.table("videos").insert(db_video).execute()
                total_new += 1

        except Exception as e:
            print(f"  ERROR: {e}")

    print()
    print(f"=== COMPLETE ===")
    print(f"New videos added: {total_new}")
    print(f"Transcripts fetched: {total_transcripts}")


def main():
    parser = argparse.ArgumentParser(description="Manage video transcripts and summaries")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # status command
    subparsers.add_parser("status", help="Show overall status")

    # sync-new command
    sync_parser = subparsers.add_parser("sync-new", help="Sync new videos from all channels")
    sync_parser.add_argument("--limit", type=int, default=20, help="Max new videos per existing channel")
    sync_parser.add_argument("--new-channel-limit", type=int, default=10, help="Max videos for newly added channels")

    # next-transcript command
    subparsers.add_parser("next-transcript", help="Get next video needing transcript")

    # fetch-transcript command
    fetch_parser = subparsers.add_parser("fetch-transcript", help="Fetch transcript for a video")
    fetch_parser.add_argument("video_id", help="Video ID (UUID)")

    # fetch-all-transcripts command
    fetch_all_parser = subparsers.add_parser("fetch-all-transcripts", help="Fetch all missing transcripts")
    fetch_all_parser.add_argument("--limit", type=int, default=100, help="Max videos to process")

    # next-summary command
    subparsers.add_parser("next-summary", help="Get next video needing summary")

    # list-pending command
    list_parser = subparsers.add_parser("list-pending", help="List videos needing summaries (metadata only)")
    list_parser.add_argument("--limit", type=int, default=5, help="Number of videos to list")

    # get-transcript command
    transcript_parser = subparsers.add_parser("get-transcript", help="Get transcript for a specific video")
    transcript_parser.add_argument("video_id", help="Video ID (UUID)")

    # save-summary command
    save_parser = subparsers.add_parser("save-summary", help="Save summary for a video")
    save_parser.add_argument("video_id", help="Video ID (UUID)")
    save_parser.add_argument("summary", help="Summary text")

    args = parser.parse_args()

    if args.command == "status":
        get_status()
    elif args.command == "sync-new":
        sync_new_videos(args.limit, args.new_channel_limit)
    elif args.command == "next-transcript":
        get_next_transcript()
    elif args.command == "fetch-transcript":
        fetch_and_save_transcript(args.video_id)
    elif args.command == "fetch-all-transcripts":
        fetch_all_transcripts(args.limit)
    elif args.command == "next-summary":
        get_next_summary()
    elif args.command == "list-pending":
        list_pending_summaries(args.limit)
    elif args.command == "get-transcript":
        get_transcript(args.video_id)
    elif args.command == "save-summary":
        save_summary(args.video_id, args.summary)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
