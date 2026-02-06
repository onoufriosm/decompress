"""
Helper script for Claude Code to manage people extraction.

This script provides commands to:
- List videos needing people extraction
- Get video details (title, description) for extraction
- Search Wikipedia for person pages and images
- Save extracted people to the database

Usage:
    # Show overall status
    uv run python people_tasks.py status

    # List videos pending people extraction
    uv run python people_tasks.py list-pending [--limit N]

    # Get video details for extraction (title + description)
    uv run python people_tasks.py get-video <video_id>

    # Search Wikipedia for a person (returns URL and image)
    uv run python people_tasks.py search-wikipedia "Person Name"

    # Save a guest to a video
    uv run python people_tasks.py save-guest <video_id> "Person Name" [--wikipedia-url URL] [--photo-url URL]

    # Save a host to a channel
    uv run python people_tasks.py save-host <source_id> "Person Name" [--wikipedia-url URL] [--photo-url URL]

    # Mark video as processed (no guests found)
    uv run python people_tasks.py mark-processed <video_id>

    # List channels needing host extraction
    uv run python people_tasks.py list-channels-pending

    # Get channel info for host extraction
    uv run python people_tasks.py get-channel <source_id>
"""

import sys
import re
import argparse
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from src.scraper.db import get_client


def slugify(name: str) -> str:
    """Convert name to URL-safe slug: 'John Doe' -> 'john-doe'."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def search_wikipedia(name: str) -> tuple[str | None, str | None]:
    """Search Wikipedia API for person's page URL and image.

    Returns:
        Tuple of (wikipedia_url, image_url)
    """
    headers = {
        "User-Agent": "DecompressScraper/1.0 (podcast-video-scraper; contact@example.com)"
    }
    wikipedia_url = None
    image_url = None

    try:
        # First, search for the page
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "search",
            "srsearch": name,
            "format": "json",
            "srlimit": 1,
        }
        response = httpx.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        results = response.json().get("query", {}).get("search", [])

        if not results:
            return None, None

        title = results[0]["title"]
        wikipedia_url = f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"

        # Now fetch the page image using pageimages API
        image_params = {
            "action": "query",
            "titles": title,
            "prop": "pageimages",
            "pithumbsize": 500,  # Get a reasonable size thumbnail
            "format": "json",
        }
        image_response = httpx.get(url, params=image_params, headers=headers, timeout=10)
        image_response.raise_for_status()
        pages = image_response.json().get("query", {}).get("pages", {})

        # Get the first (and only) page result
        for page_data in pages.values():
            if "thumbnail" in page_data:
                image_url = page_data["thumbnail"].get("source")
                break

    except Exception as e:
        print(f"Wikipedia search failed for {name}: {e}")

    return wikipedia_url, image_url


def get_status():
    """Show overall status of people extraction."""
    client = get_client()

    # Total videos with metadata
    total_with_metadata = (
        client.table("videos")
        .select("id", count="exact")
        .not_.is_("metadata_scraped_at", "null")
        .execute()
    )

    # Videos with people extracted
    with_people = (
        client.table("videos")
        .select("id", count="exact")
        .not_.is_("people_extracted_at", "null")
        .execute()
    )

    # Videos needing extraction (have metadata but no people extracted)
    needs_extraction = (
        client.table("videos")
        .select("id", count="exact")
        .not_.is_("metadata_scraped_at", "null")
        .is_("people_extracted_at", "null")
        .execute()
    )

    # Total people in database
    total_people = client.table("people").select("id", count="exact").execute()

    # Channels with hosts extracted
    channels_with_hosts = (
        client.table("sources")
        .select("id", count="exact")
        .not_.is_("hosts_extracted_at", "null")
        .execute()
    )

    # Total channels
    total_channels = (
        client.table("sources")
        .select("id", count="exact")
        .eq("type", "youtube_channel")
        .execute()
    )

    print("=== PEOPLE EXTRACTION STATUS ===")
    print()
    print("--- Videos ---")
    print(f"With metadata: {total_with_metadata.count}")
    print(f"People extracted: {with_people.count}")
    print(f"Pending extraction: {needs_extraction.count}")
    print()
    print("--- Channels ---")
    print(f"Total channels: {total_channels.count}")
    print(f"Hosts extracted: {channels_with_hosts.count}")
    print(f"Pending host extraction: {(total_channels.count or 0) - (channels_with_hosts.count or 0)}")
    print()
    print("--- People Database ---")
    print(f"Total people: {total_people.count}")


def list_pending(limit: int = 5):
    """List videos needing people extraction."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, title, description, source:sources(name)")
        .not_.is_("metadata_scraped_at", "null")
        .is_("people_extracted_at", "null")
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
    )

    if not result.data:
        print("NO_MORE_VIDEOS")
        print("All videos with metadata have been processed!")
        return []

    print(f"=== {len(result.data)} VIDEOS PENDING PEOPLE EXTRACTION ===")
    print()
    for i, video in enumerate(result.data, 1):
        source = video.get("source")
        channel_name = source.get("name") if isinstance(source, dict) else (source[0].get("name") if source else "Unknown")
        description_preview = (video.get("description") or "")[:200]

        print(f"{i}. {video['id']}")
        print(f"   Channel: {channel_name}")
        print(f"   Title: {video['title']}")
        print(f"   Description: {description_preview}...")
        print()

    return result.data


def get_video(video_id: str):
    """Get video details for people extraction."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, title, description, source_id, source:sources(id, name)")
        .eq("id", video_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        print(f"ERROR: Video {video_id} not found")
        return None

    video = result.data[0]
    source = video.get("source")
    channel_name = source.get("name") if isinstance(source, dict) else (source[0].get("name") if source else "Unknown")
    source_id = source.get("id") if isinstance(source, dict) else (source[0].get("id") if source else video.get("source_id"))

    # Get verified hosts for this channel
    hosts_result = (
        client.table("source_people")
        .select("person:people(name)")
        .eq("source_id", source_id)
        .eq("role", "host")
        .eq("verified", True)
        .execute()
    )

    host_names = []
    for h in hosts_result.data or []:
        person = h.get("person")
        if person:
            name = person.get("name") if isinstance(person, dict) else (person[0].get("name") if person else None)
            if name:
                host_names.append(name)

    print(f"VIDEO_ID: {video['id']}")
    print(f"SOURCE_ID: {source_id}")
    print(f"CHANNEL: {channel_name}")
    print(f"HOSTS: {', '.join(host_names) if host_names else 'None verified'}")
    print(f"TITLE: {video['title']}")
    print()
    print("---DESCRIPTION_START---")
    print(video.get("description") or "(no description)")
    print("---DESCRIPTION_END---")

    return video


def search_wikipedia_cmd(name: str):
    """Search Wikipedia and print results."""
    wikipedia_url, image_url = search_wikipedia(name)

    print(f"Searching Wikipedia for: {name}")
    print()
    if wikipedia_url:
        print(f"WIKIPEDIA_URL: {wikipedia_url}")
    else:
        print("WIKIPEDIA_URL: NOT_FOUND")

    if image_url:
        print(f"PHOTO_URL: {image_url}")
    else:
        print("PHOTO_URL: NOT_FOUND")


def upsert_person(
    name: str,
    wikipedia_url: str | None = None,
    photo_url: str | None = None,
) -> dict:
    """Get or create person record."""
    client = get_client()
    slug = slugify(name)

    # Try to find existing person by slug
    result = client.table("people").select("*").eq("slug", slug).execute()

    if result.data:
        person = result.data[0]
        # Update social_links if URLs provided and not already set
        social_links = person.get("social_links") or {}
        updates = {}

        if wikipedia_url and not social_links.get("wikipedia"):
            social_links["wikipedia"] = wikipedia_url
            updates["social_links"] = social_links
        if photo_url and not person.get("photo_url"):
            updates["photo_url"] = photo_url

        if updates:
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            client.table("people").update(updates).eq("id", person["id"]).execute()
            person["social_links"] = social_links
            if "photo_url" in updates:
                person["photo_url"] = photo_url
        return person

    # Create new person
    social_links = {}
    if wikipedia_url:
        social_links["wikipedia"] = wikipedia_url

    new_person = {
        "name": name,
        "slug": slug,
        "social_links": social_links,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if photo_url:
        new_person["photo_url"] = photo_url

    result = client.table("people").insert(new_person).execute()
    return result.data[0]


def save_guest(video_id: str, name: str, wikipedia_url: str | None = None, photo_url: str | None = None):
    """Save a guest to a video."""
    client = get_client()

    # Get or create person
    person = upsert_person(name, wikipedia_url, photo_url)
    person_id = person["id"]

    # Check if link already exists
    existing = (
        client.table("video_people")
        .select("*")
        .eq("video_id", video_id)
        .eq("person_id", person_id)
        .eq("role", "guest")
        .execute()
    )

    if existing.data:
        print(f"Guest '{name}' already linked to video")
        return existing.data[0]

    # Get current max display_order for this video
    max_order = (
        client.table("video_people")
        .select("display_order")
        .eq("video_id", video_id)
        .order("display_order", desc=True)
        .limit(1)
        .execute()
    )
    display_order = (max_order.data[0]["display_order"] + 1) if max_order.data else 0

    # Create link
    link = {
        "video_id": video_id,
        "person_id": person_id,
        "role": "guest",
        "display_order": display_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("video_people").insert(link).execute()

    print(f"SAVED: Guest '{name}' linked to video")
    print(f"PERSON_ID: {person_id}")
    if wikipedia_url:
        print(f"WIKIPEDIA: {wikipedia_url}")
    if photo_url:
        print(f"PHOTO: {photo_url}")

    return result.data[0] if result.data else None


def save_host(source_id: str, name: str, wikipedia_url: str | None = None, photo_url: str | None = None, verified: bool = True):
    """Save a host to a channel."""
    client = get_client()

    # Get or create person
    person = upsert_person(name, wikipedia_url, photo_url)
    person_id = person["id"]

    # Check if link already exists
    existing = (
        client.table("source_people")
        .select("*")
        .eq("source_id", source_id)
        .eq("person_id", person_id)
        .eq("role", "host")
        .execute()
    )

    if existing.data:
        # Update verified status if needed
        if verified and not existing.data[0].get("verified"):
            client.table("source_people").update({"verified": True}).eq("id", existing.data[0]["id"]).execute()
            print(f"Host '{name}' verified for channel")
        else:
            print(f"Host '{name}' already linked to channel")
        return existing.data[0]

    # Create link
    link = {
        "source_id": source_id,
        "person_id": person_id,
        "role": "host",
        "is_primary": True,
        "verified": verified,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("source_people").insert(link).execute()

    print(f"SAVED: Host '{name}' linked to channel")
    print(f"PERSON_ID: {person_id}")
    print(f"VERIFIED: {verified}")
    if wikipedia_url:
        print(f"WIKIPEDIA: {wikipedia_url}")
    if photo_url:
        print(f"PHOTO: {photo_url}")

    return result.data[0] if result.data else None


def mark_processed(video_id: str):
    """Mark a video as processed (even if no guests found)."""
    client = get_client()

    # Also link verified hosts to this video
    video = client.table("videos").select("source_id").eq("id", video_id).single().execute()
    if video.data:
        source_id = video.data["source_id"]

        # Get verified hosts for this channel
        hosts = (
            client.table("source_people")
            .select("person_id")
            .eq("source_id", source_id)
            .eq("role", "host")
            .eq("verified", True)
            .execute()
        )

        for i, host in enumerate(hosts.data or []):
            # Check if already linked
            existing = (
                client.table("video_people")
                .select("id")
                .eq("video_id", video_id)
                .eq("person_id", host["person_id"])
                .execute()
            )
            if not existing.data:
                client.table("video_people").insert({
                    "video_id": video_id,
                    "person_id": host["person_id"],
                    "role": "host",
                    "display_order": i,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()

    # Mark video as processed
    client.table("videos").update({
        "people_extracted_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", video_id).execute()

    print(f"Video {video_id} marked as processed")


def list_channels_pending():
    """List channels needing host extraction."""
    client = get_client()

    result = (
        client.table("sources")
        .select("id, name, handle, description")
        .eq("type", "youtube_channel")
        .is_("hosts_extracted_at", "null")
        .execute()
    )

    if not result.data:
        print("NO_MORE_CHANNELS")
        print("All channels have been processed for host extraction!")
        return []

    print(f"=== {len(result.data)} CHANNELS PENDING HOST EXTRACTION ===")
    print()
    for i, source in enumerate(result.data, 1):
        desc_preview = (source.get("description") or "")[:150]
        print(f"{i}. {source['id']}")
        print(f"   Name: {source['name']}")
        print(f"   Handle: {source['handle']}")
        print(f"   Description: {desc_preview}...")
        print()

    return result.data


def get_channel(source_id: str):
    """Get channel info for host extraction."""
    client = get_client()

    source = client.table("sources").select("*").eq("id", source_id).single().execute()
    if not source.data:
        print(f"ERROR: Channel {source_id} not found")
        return None

    # Get recent video titles and descriptions
    videos = (
        client.table("videos")
        .select("title, description")
        .eq("source_id", source_id)
        .order("published_at", desc=True)
        .limit(10)
        .execute()
    )

    print(f"SOURCE_ID: {source.data['id']}")
    print(f"CHANNEL_NAME: {source.data['name']}")
    print(f"HANDLE: {source.data.get('handle')}")
    print()
    print("---CHANNEL_DESCRIPTION_START---")
    print(source.data.get("description") or "(no description)")
    print("---CHANNEL_DESCRIPTION_END---")
    print()
    print("---RECENT_VIDEOS_START---")
    for v in videos.data or []:
        print(f"Title: {v['title']}")
        desc = v.get("description") or ""
        print(f"Description: {desc[:300]}...")
        print()
    print("---RECENT_VIDEOS_END---")

    return source.data


def mark_channel_processed(source_id: str):
    """Mark a channel as processed for host extraction."""
    client = get_client()

    client.table("sources").update({
        "hosts_extracted_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", source_id).execute()

    print(f"Channel {source_id} marked as processed")


def main():
    parser = argparse.ArgumentParser(description="Manage people extraction")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # status command
    subparsers.add_parser("status", help="Show overall status")

    # list-pending command
    list_parser = subparsers.add_parser("list-pending", help="List videos pending extraction")
    list_parser.add_argument("--limit", type=int, default=5, help="Number of videos to list")

    # get-video command
    video_parser = subparsers.add_parser("get-video", help="Get video details for extraction")
    video_parser.add_argument("video_id", help="Video ID (UUID)")

    # search-wikipedia command
    wiki_parser = subparsers.add_parser("search-wikipedia", help="Search Wikipedia for a person")
    wiki_parser.add_argument("name", help="Person name to search")

    # save-guest command
    guest_parser = subparsers.add_parser("save-guest", help="Save a guest to a video")
    guest_parser.add_argument("video_id", help="Video ID (UUID)")
    guest_parser.add_argument("name", help="Guest name")
    guest_parser.add_argument("--wikipedia-url", help="Wikipedia URL")
    guest_parser.add_argument("--photo-url", help="Photo URL")

    # save-host command
    host_parser = subparsers.add_parser("save-host", help="Save a host to a channel")
    host_parser.add_argument("source_id", help="Source/Channel ID (UUID)")
    host_parser.add_argument("name", help="Host name")
    host_parser.add_argument("--wikipedia-url", help="Wikipedia URL")
    host_parser.add_argument("--photo-url", help="Photo URL")
    host_parser.add_argument("--unverified", action="store_true", help="Mark as unverified")

    # mark-processed command
    mark_parser = subparsers.add_parser("mark-processed", help="Mark video as processed")
    mark_parser.add_argument("video_id", help="Video ID (UUID)")

    # list-channels-pending command
    subparsers.add_parser("list-channels-pending", help="List channels pending host extraction")

    # get-channel command
    channel_parser = subparsers.add_parser("get-channel", help="Get channel info for host extraction")
    channel_parser.add_argument("source_id", help="Source/Channel ID (UUID)")

    # mark-channel-processed command
    mark_channel_parser = subparsers.add_parser("mark-channel-processed", help="Mark channel as processed")
    mark_channel_parser.add_argument("source_id", help="Source/Channel ID (UUID)")

    args = parser.parse_args()

    if args.command == "status":
        get_status()
    elif args.command == "list-pending":
        list_pending(args.limit)
    elif args.command == "get-video":
        get_video(args.video_id)
    elif args.command == "search-wikipedia":
        search_wikipedia_cmd(args.name)
    elif args.command == "save-guest":
        save_guest(args.video_id, args.name, args.wikipedia_url, args.photo_url)
    elif args.command == "save-host":
        save_host(args.source_id, args.name, args.wikipedia_url, args.photo_url, verified=not args.unverified)
    elif args.command == "mark-processed":
        mark_processed(args.video_id)
    elif args.command == "list-channels-pending":
        list_channels_pending()
    elif args.command == "get-channel":
        get_channel(args.source_id)
    elif args.command == "mark-channel-processed":
        mark_channel_processed(args.source_id)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
