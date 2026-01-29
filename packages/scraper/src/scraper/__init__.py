"""YouTube scraper package."""

from .channel import (
    add_transcripts,
    fetch_channel_videos,
    get_channel_video_ids,
    get_channel_metadata,
    get_transcript,
    get_video_metadata,
    load_videos,
    save_videos,
)

from .db import (
    get_client,
    get_or_create_source,
    update_source_scraped_at,
    upsert_video,
    upsert_videos_batch,
    get_videos_without_transcript,
    update_video_transcript,
    get_or_create_tag,
    add_video_tags,
    create_scrape_log,
    complete_scrape_log,
)

from .extract_people import (
    extract_hosts_for_channel,
    extract_guests_for_video,
    upsert_person,
    search_wikipedia,
    link_person_to_source,
    link_person_to_video,
    get_verified_hosts,
)

__all__ = [
    # Channel scraping
    "add_transcripts",
    "fetch_channel_videos",
    "get_channel_video_ids",
    "get_channel_metadata",
    "get_transcript",
    "get_video_metadata",
    "load_videos",
    "save_videos",
    # Database operations
    "get_client",
    "get_or_create_source",
    "update_source_scraped_at",
    "upsert_video",
    "upsert_videos_batch",
    "get_videos_without_transcript",
    "update_video_transcript",
    "get_or_create_tag",
    "add_video_tags",
    "create_scrape_log",
    "complete_scrape_log",
    # People extraction
    "extract_hosts_for_channel",
    "extract_guests_for_video",
    "upsert_person",
    "search_wikipedia",
    "link_person_to_source",
    "link_person_to_video",
    "get_verified_hosts",
]
