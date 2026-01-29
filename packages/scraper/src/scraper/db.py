"""
Supabase database client for the scraper.

Uses the secret key to bypass RLS for write operations.
"""

import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

_client: Client | None = None


def get_client() -> Client:
    """Get or create the Supabase client."""
    global _client

    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SECRET_KEY")

        if not url:
            raise ValueError("Missing SUPABASE_URL environment variable")
        if not key:
            raise ValueError("Missing SUPABASE_SECRET_KEY environment variable")

        _client = create_client(url, key)

    return _client


# =============================================================================
# SOURCE OPERATIONS
# =============================================================================


def get_or_create_source(
    external_id: str,
    name: str,
    handle: str | None = None,
    source_type: str = "youtube_channel",
    **kwargs: Any,
) -> dict:
    """
    Get an existing source or create a new one.

    Returns the source record.
    """
    client = get_client()

    # Try to find existing
    result = (
        client.table("sources")
        .select("*")
        .eq("type", source_type)
        .eq("external_id", external_id)
        .execute()
    )

    if result.data:
        existing = result.data[0]
        # Update with any new metadata if not already set
        updates = {}
        for key, value in kwargs.items():
            if value is not None and not existing.get(key):
                updates[key] = value
        if updates:
            client.table("sources").update(updates).eq("id", existing["id"]).execute()
            existing.update(updates)
        return existing

    # Create new source
    source_data = {
        "type": source_type,
        "external_id": external_id,
        "name": name,
        "handle": handle,
        **kwargs,
    }

    result = client.table("sources").insert(source_data).execute()
    return result.data[0]


def update_source_scraped_at(source_id: str) -> None:
    """Update the last_scraped_at timestamp for a source."""
    client = get_client()
    client.table("sources").update(
        {"last_scraped_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", source_id).execute()


# =============================================================================
# VIDEO OPERATIONS
# =============================================================================


def upsert_video(source_id: str, video_data: dict) -> dict:
    """
    Insert or update a video.

    video_data should contain the scraped video metadata.
    Returns the upserted video record.

    Note: Only non-None fields are included in the upsert to prevent
    overwriting existing data with None values.
    """
    client = get_client()

    # Required fields
    db_video = {
        "source_id": source_id,
        "external_id": video_data["id"],
        "url": video_data["url"],
        "title": video_data["title"],
        "metadata_scraped_at": datetime.now(timezone.utc).isoformat(),
    }

    # Optional fields - only include if not None
    if video_data.get("description") is not None:
        db_video["description"] = video_data["description"]

    duration = video_data.get("duration")
    if duration is not None:
        db_video["duration_seconds"] = int(duration)

    if video_data.get("duration_string") is not None:
        db_video["duration_string"] = video_data["duration_string"]

    if video_data.get("thumbnail") is not None:
        db_video["thumbnail_url"] = video_data["thumbnail"]

    upload_date = _parse_upload_date(video_data.get("upload_date"))
    if upload_date is not None:
        db_video["upload_date"] = upload_date
        db_video["published_at"] = f"{upload_date}T00:00:00Z"

    if video_data.get("view_count") is not None:
        db_video["view_count"] = video_data["view_count"]

    if video_data.get("like_count") is not None:
        db_video["like_count"] = video_data["like_count"]

    if video_data.get("comment_count") is not None:
        db_video["comment_count"] = video_data["comment_count"]

    # Handle transcript if present
    if video_data.get("transcript"):
        db_video["transcript"] = video_data["transcript"]
        db_video["has_transcript"] = True
        db_video["transcript_scraped_at"] = datetime.now(timezone.utc).isoformat()

    # Upsert based on source_id + external_id
    result = (
        client.table("videos")
        .upsert(db_video, on_conflict="source_id,external_id")
        .execute()
    )

    return result.data[0]


def upsert_videos_batch(
    source_id: str,
    videos: list[dict],
    has_rich_metadata: bool = True,
) -> list[dict]:
    """
    Batch upsert multiple videos.

    Args:
        source_id: The source/channel ID
        videos: List of video data dictionaries
        has_rich_metadata: If True, sets metadata_scraped_at (indicates full metadata was fetched)

    Returns the upserted video records.

    Note: Only non-None fields are included in the upsert to prevent
    overwriting existing data with None values.
    """
    client = get_client()

    db_videos = []
    now = datetime.now(timezone.utc).isoformat()

    for video_data in videos:
        # Required fields
        db_video = {
            "source_id": source_id,
            "external_id": video_data["id"],
            "url": video_data["url"],
            "title": video_data["title"],
        }

        # Optional fields - only include if not None
        if video_data.get("description") is not None:
            db_video["description"] = video_data["description"]

        duration = video_data.get("duration")
        if duration is not None:
            db_video["duration_seconds"] = int(duration)

        if video_data.get("duration_string") is not None:
            db_video["duration_string"] = video_data["duration_string"]

        if video_data.get("thumbnail") is not None:
            db_video["thumbnail_url"] = video_data["thumbnail"]

        upload_date = _parse_upload_date(video_data.get("upload_date"))
        if upload_date is not None:
            db_video["upload_date"] = upload_date
            db_video["published_at"] = f"{upload_date}T00:00:00Z"

        if video_data.get("view_count") is not None:
            db_video["view_count"] = video_data["view_count"]

        if video_data.get("like_count") is not None:
            db_video["like_count"] = video_data["like_count"]

        if video_data.get("comment_count") is not None:
            db_video["comment_count"] = video_data["comment_count"]

        # Only set metadata_scraped_at if we actually fetched rich metadata
        if has_rich_metadata:
            db_video["metadata_scraped_at"] = now

        # Handle transcript if present
        if video_data.get("transcript"):
            db_video["transcript"] = video_data["transcript"]
            db_video["has_transcript"] = True
            db_video["transcript_scraped_at"] = now
            if video_data.get("transcript_language") is not None:
                db_video["transcript_language"] = video_data["transcript_language"]

        db_videos.append(db_video)

    result = (
        client.table("videos")
        .upsert(db_videos, on_conflict="source_id,external_id")
        .execute()
    )

    return result.data


def get_videos_without_transcript(source_id: str, limit: int = 100) -> list[dict]:
    """Get videos that don't have transcripts yet."""
    client = get_client()

    result = (
        client.table("videos")
        .select("*")
        .eq("source_id", source_id)
        .eq("has_transcript", False)
        .limit(limit)
        .execute()
    )

    return result.data


def video_has_transcript(external_id: str) -> bool:
    """
    Check if a video already has a transcript in the database.

    Args:
        external_id: YouTube video ID

    Returns:
        True if the video exists and has a non-empty transcript
    """
    client = get_client()

    result = (
        client.table("videos")
        .select("transcript")
        .eq("external_id", external_id)
        .eq("has_transcript", True)
        .not_.is_("transcript", "null")
        .limit(1)
        .execute()
    )

    # Also verify transcript is not empty
    if result.data and result.data[0].get("transcript"):
        return len(result.data[0]["transcript"]) > 0
    return False


def update_video_transcript(video_id: str, transcript: str, language: str = "en") -> None:
    """Update the transcript for a video."""
    client = get_client()

    client.table("videos").update(
        {
            "transcript": transcript,
            "transcript_language": language,
            "has_transcript": True,
            "transcript_scraped_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", video_id).execute()


# =============================================================================
# TAG OPERATIONS
# =============================================================================


def get_or_create_tag(name: str, tag_type: str = "general") -> dict:
    """Get an existing tag or create a new one."""
    client = get_client()
    slug = _slugify(name)

    # Try to find existing
    result = client.table("tags").select("*").eq("slug", slug).execute()

    if result.data:
        return result.data[0]

    # Create new tag
    result = (
        client.table("tags")
        .insert({"name": name, "slug": slug, "type": tag_type})
        .execute()
    )

    return result.data[0]


def add_video_tags(video_id: str, tag_names: list[str], source: str = "youtube") -> None:
    """Add tags to a video."""
    client = get_client()

    for tag_name in tag_names:
        tag = get_or_create_tag(tag_name)

        # Insert ignore duplicates
        try:
            client.table("video_tags").insert(
                {"video_id": video_id, "tag_id": tag["id"], "source": source}
            ).execute()
        except Exception:
            # Ignore duplicate key errors
            pass


# =============================================================================
# SCRAPE LOG OPERATIONS
# =============================================================================


def create_scrape_log(source_id: str) -> dict:
    """Create a new scrape log entry."""
    client = get_client()

    result = (
        client.table("scrape_logs")
        .insert(
            {
                "source_id": source_id,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "status": "running",
            }
        )
        .execute()
    )

    return result.data[0]


def complete_scrape_log(
    log_id: str,
    status: str = "completed",
    videos_found: int = 0,
    videos_new: int = 0,
    videos_updated: int = 0,
    transcripts_added: int = 0,
    error_message: str | None = None,
) -> None:
    """Complete a scrape log entry."""
    client = get_client()

    client.table("scrape_logs").update(
        {
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "videos_found": videos_found,
            "videos_new": videos_new,
            "videos_updated": videos_updated,
            "transcripts_added": transcripts_added,
            "error_message": error_message,
        }
    ).eq("id", log_id).execute()


# =============================================================================
# HELPERS
# =============================================================================


def _parse_upload_date(date_str: str | None) -> str | None:
    """Parse YYYYMMDD format to ISO date."""
    if not date_str or len(date_str) != 8:
        return None

    try:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    except Exception:
        return None


def _slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    import re

    # Lowercase
    slug = text.lower()
    # Replace spaces and special chars with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    # Remove leading/trailing hyphens
    slug = slug.strip("-")
    # Collapse multiple hyphens
    slug = re.sub(r"-+", "-", slug)

    return slug
