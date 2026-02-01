"""
Helper script for Claude Code to summarize videos one by one.

Usage:
    # Get next video to summarize
    uv run python claude_summarize.py next

    # Save a summary for a video
    uv run python claude_summarize.py save <video_id> "<summary>"

    # Get progress
    uv run python claude_summarize.py progress
"""

import sys
import json
from src.scraper.db import get_client


def get_next_video():
    """Get the next video that needs a summary."""
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
        print("No more videos to summarize!")
        return None

    video = result.data[0]
    print(f"VIDEO_ID: {video['id']}")
    print(f"TITLE: {video['title']}")
    print(f"TRANSCRIPT_LENGTH: {len(video['transcript'])} chars")
    print("---TRANSCRIPT_START---")
    print(video['transcript'])
    print("---TRANSCRIPT_END---")
    return video


def save_summary(video_id: str, summary: str):
    """Save a summary to the database."""
    client = get_client()
    client.table("videos").update({
        "summary": summary,
        "summary_generated_at": "now()"
    }).eq("id", video_id).execute()
    print(f"Saved summary for video {video_id} ({len(summary)} chars)")


def get_progress():
    """Show summarization progress."""
    client = get_client()

    # Count videos with transcripts
    with_transcript = client.table("videos").select("id", count="exact").not_.is_("transcript", "null").execute()

    # Count videos with summaries
    with_summary = client.table("videos").select("id", count="exact").not_.is_("summary", "null").execute()

    # Count remaining
    remaining = client.table("videos").select("id", count="exact").not_.is_("transcript", "null").is_("summary", "null").execute()

    print(f"Videos with transcripts: {with_transcript.count}")
    print(f"Videos with summaries: {with_summary.count}")
    print(f"Remaining to summarize: {remaining.count}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "next":
        get_next_video()
    elif command == "save" and len(sys.argv) >= 4:
        video_id = sys.argv[2]
        summary = sys.argv[3]
        save_summary(video_id, summary)
    elif command == "progress":
        get_progress()
    else:
        print(__doc__)
        sys.exit(1)
