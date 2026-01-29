"""
Extract people (hosts, guests) from videos and channels using AI.

Supports:
- Channel host extraction from multiple video titles
- Video guest extraction from title/description
- Wikipedia URL lookup
- Host verification workflow
"""

import argparse
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import quote

import httpx
import openai
import anthropic
from dotenv import load_dotenv

from .db import get_client
from .channel import get_channel_metadata

load_dotenv()

Provider = Literal["openai", "anthropic"]


# =============================================================================
# AI Client Setup
# =============================================================================

def get_openai_client() -> openai.OpenAI:
    """Get OpenAI client."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("Missing OPENAI_API_KEY environment variable")
    return openai.OpenAI(api_key=api_key)


def get_anthropic_client() -> anthropic.Anthropic:
    """Get Anthropic client."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("Missing ANTHROPIC_API_KEY environment variable")
    return anthropic.Anthropic(api_key=api_key)


# =============================================================================
# Utility Functions
# =============================================================================

def slugify(name: str) -> str:
    """Convert name to URL-safe slug: 'John Doe' -> 'john-doe'."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def search_wikipedia(name: str) -> str | None:
    """Search Wikipedia API for person's page URL."""
    try:
        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query",
            "list": "search",
            "srsearch": name,
            "format": "json",
            "srlimit": 1,
        }
        headers = {
            "User-Agent": "DecompressScraper/1.0 (podcast-video-scraper; contact@example.com)"
        }
        response = httpx.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        results = response.json().get("query", {}).get("search", [])
        if results:
            title = results[0]["title"]
            return f"https://en.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}"
    except Exception as e:
        print(f"    Wikipedia search failed for {name}: {e}")
    return None


# =============================================================================
# AI Extraction Functions
# =============================================================================

HOST_EXTRACTION_PROMPT = """YouTube Channel: {channel_name}

Channel Description/About:
{channel_description}

Recent video titles and descriptions:
{videos_info}

Identify the HOST(s) of this channel - people who appear in most/all videos as interviewers, presenters, or show runners. Hosts are typically the consistent faces of the channel, not the guests being interviewed.

IMPORTANT:
1. The channel description often explicitly states who the hosts are - check it carefully!
2. Look for patterns like "hosted by X", "X and Y discuss", "your hosts X and Y"
3. Video descriptions often mention "In this episode, [HOST] talks to [GUEST]" - the host is the consistent name across videos
4. For podcast channels, there are usually 1-3 regular hosts

Return ONLY a JSON array (no other text) with the hosts:
[{{"name": "Full Name", "confidence": "high|medium|low"}}]

If you cannot identify any hosts with reasonable confidence, return an empty array: []
"""

GUEST_EXTRACTION_PROMPT = """Channel: {channel_name}
{hosts_context}

Video title: {title}

Video description:
{description}

Your task: Extract the GUEST(s) appearing in this video - people being interviewed, featured, or having a conversation with the host(s).

IMPORTANT RULES:
1. FOCUS ON THE DESCRIPTION - The description usually contains the guest's name and bio. Titles are often clickbait and may mention famous people who are NOT actually guests.
2. Look for patterns like "X joins us", "X breaks down", "X is a [profession]", "conversation with X", "X discusses" - these indicate the actual guest.
3. DO NOT extract people who are merely MENTIONED or DISCUSSED in the video - only extract people who actually APPEAR as guests.
4. If this appears to be a NEWS CHANNEL (reporting news, not interviews), return an empty array - news segments don't have "guests" in the podcast sense.
5. Do NOT include the hosts listed above.
6. Only include real people (not fictional characters, brands, or organizations).
7. Use the person's full name as it appears in the description.

Return ONLY a JSON array (no other text):
[{{"name": "Full Name", "role": "guest"}}]

If no guests can be identified or this is a news channel, return: []
"""


def extract_with_openai(prompt: str) -> list[dict]:
    """Extract people using OpenAI."""
    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1000,
        messages=[
            {
                "role": "system",
                "content": "You are an expert at identifying people mentioned in video content. Always respond with valid JSON arrays only.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content or "[]"
    # Extract JSON from response (handle markdown code blocks)
    if "```" in content:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if match:
            content = match.group(1)
    return json.loads(content.strip())


def extract_with_anthropic(prompt: str) -> list[dict]:
    """Extract people using Anthropic Claude."""
    client = get_anthropic_client()
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
        system="You are an expert at identifying people mentioned in video content. Always respond with valid JSON arrays only.",
    )
    content = message.content[0].text or "[]"
    # Extract JSON from response (handle markdown code blocks)
    if "```" in content:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if match:
            content = match.group(1)
    return json.loads(content.strip())


def extract_people(prompt: str, provider: Provider = "openai") -> list[dict]:
    """Extract people using specified AI provider."""
    if provider == "anthropic":
        return extract_with_anthropic(prompt)
    return extract_with_openai(prompt)


# =============================================================================
# Database Operations
# =============================================================================

def upsert_person(
    name: str,
    wikipedia_url: str | None = None,
    website_url: str | None = None,
) -> dict:
    """Get or create person record.

    URLs are stored in the social_links JSONB column.
    """
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
        if website_url and not social_links.get("website"):
            social_links["website"] = website_url
            updates["social_links"] = social_links

        if updates:
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            client.table("people").update(updates).eq("id", person["id"]).execute()
            person["social_links"] = social_links
        return person

    # Create new person
    social_links = {}
    if wikipedia_url:
        social_links["wikipedia"] = wikipedia_url
    if website_url:
        social_links["website"] = website_url

    new_person = {
        "name": name,
        "slug": slug,
        "social_links": social_links,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("people").insert(new_person).execute()
    return result.data[0]


def link_person_to_source(
    source_id: str,
    person_id: str,
    role: str = "host",
    is_primary: bool = True,
    verified: bool = False,
    ai_confidence: str | None = None,
) -> dict | None:
    """Link person to source/channel via source_people."""
    client = get_client()

    # Check if link already exists
    existing = (
        client.table("source_people")
        .select("*")
        .eq("source_id", source_id)
        .eq("person_id", person_id)
        .eq("role", role)
        .execute()
    )

    if existing.data:
        return existing.data[0]

    # Create new link
    link = {
        "source_id": source_id,
        "person_id": person_id,
        "role": role,
        "is_primary": is_primary,
        "verified": verified,
        "ai_confidence": ai_confidence,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("source_people").insert(link).execute()
    return result.data[0] if result.data else None


def link_person_to_video(
    video_id: str,
    person_id: str,
    role: str,
    display_order: int = 0,
) -> dict | None:
    """Link person to video via video_people."""
    client = get_client()

    # Check if link already exists
    existing = (
        client.table("video_people")
        .select("*")
        .eq("video_id", video_id)
        .eq("person_id", person_id)
        .eq("role", role)
        .execute()
    )

    if existing.data:
        return existing.data[0]

    # Create new link
    link = {
        "video_id": video_id,
        "person_id": person_id,
        "role": role,
        "display_order": display_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = client.table("video_people").insert(link).execute()
    return result.data[0] if result.data else None


def get_verified_hosts(source_id: str) -> list[dict]:
    """Get verified hosts for a channel."""
    client = get_client()
    result = (
        client.table("source_people")
        .select("*, person:people(*)")
        .eq("source_id", source_id)
        .eq("role", "host")
        .eq("verified", True)
        .execute()
    )
    return result.data or []


def get_unverified_hosts() -> list[dict]:
    """Get all unverified hosts grouped by channel."""
    client = get_client()
    result = (
        client.table("source_people")
        .select("*, person:people(*), source:sources(id, name)")
        .eq("role", "host")
        .eq("verified", False)
        .execute()
    )
    return result.data or []


# =============================================================================
# Channel Description Fetching
# =============================================================================

def fetch_channel_descriptions(verbose: bool = True) -> dict[str, Any]:
    """Fetch and update channel descriptions from YouTube."""
    client = get_client()
    stats = {"updated": 0, "skipped": 0, "errors": []}

    # Get channels without descriptions
    sources = (
        client.table("sources")
        .select("id, name, handle, description")
        .eq("type", "youtube_channel")
        .execute()
    )

    if not sources.data:
        if verbose:
            print("No channels found")
        return stats

    for source in sources.data:
        # Skip if already has description
        if source.get("description"):
            stats["skipped"] += 1
            continue

        handle = source.get("handle")
        if not handle:
            continue

        if verbose:
            print(f"Fetching description for {source['name']}...")

        try:
            channel_url = f"https://www.youtube.com/{handle}"
            metadata = get_channel_metadata(channel_url)

            if metadata.get("description"):
                client.table("sources").update({
                    "description": metadata["description"],
                    "subscriber_count": metadata.get("subscriber_count"),
                }).eq("id", source["id"]).execute()
                stats["updated"] += 1
                if verbose:
                    print(f"  ✓ Updated ({len(metadata['description'])} chars)")
            else:
                if verbose:
                    print(f"  - No description found")
        except Exception as e:
            stats["errors"].append(f"{source['name']}: {e}")
            if verbose:
                print(f"  ✗ Error: {e}")

    return stats


# =============================================================================
# Channel Host Extraction
# =============================================================================

def extract_hosts_for_channel(
    source_id: str,
    provider: Provider = "openai",
    lookup_wikipedia: bool = True,
    verbose: bool = True,
) -> list[dict]:
    """Extract hosts for a channel by analyzing channel description and video info."""
    client = get_client()

    # Get channel info including description
    source = client.table("sources").select("*").eq("id", source_id).single().execute()
    if not source.data:
        raise ValueError(f"Source not found: {source_id}")

    channel_name = source.data["name"]
    channel_description = source.data.get("description") or "No description available"

    # Get recent video titles AND descriptions
    videos = (
        client.table("videos")
        .select("title, description")
        .eq("source_id", source_id)
        .order("published_at", desc=True)
        .limit(10)
        .execute()
    )

    if not videos.data:
        if verbose:
            print(f"  No videos found for {channel_name}")
        return []

    # Format videos with title and truncated description
    videos_info_parts = []
    for v in videos.data:
        title = v.get("title", "")
        desc = v.get("description") or ""
        # Take first 300 chars of description to keep prompt manageable
        desc_preview = desc[:300] + "..." if len(desc) > 300 else desc
        videos_info_parts.append(f"Title: {title}\nDescription: {desc_preview}")

    videos_info = "\n\n".join(videos_info_parts)

    if verbose:
        print(f"  Analyzing {len(videos.data)} videos for {channel_name}...")

    # Extract hosts using AI
    prompt = HOST_EXTRACTION_PROMPT.format(
        channel_name=channel_name,
        channel_description=channel_description[:1000],  # Limit description length
        videos_info=videos_info,
    )
    extracted = extract_people(prompt, provider)

    if verbose and not extracted:
        print(f"    No hosts identified by AI")

    hosts = []
    for item in extracted:
        name = item.get("name", "").strip()
        confidence = item.get("confidence", "medium")

        if not name:
            continue

        if verbose:
            print(f"    Found host: {name} (confidence: {confidence})")

        # Search Wikipedia
        wikipedia_url = None
        if lookup_wikipedia:
            wikipedia_url = search_wikipedia(name)
            if verbose and wikipedia_url:
                print(f"      Wikipedia: {wikipedia_url}")

        # Create/get person record
        person = upsert_person(name, wikipedia_url=wikipedia_url)

        # Link to source
        link_person_to_source(
            source_id=source_id,
            person_id=person["id"],
            role="host",
            is_primary=True,
            verified=False,
            ai_confidence=confidence,
        )

        hosts.append({"person": person, "confidence": confidence})

    # Mark channel as processed
    client.table("sources").update(
        {"hosts_extracted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", source_id).execute()

    return hosts


def extract_hosts_all_channels(
    provider: Provider = "openai",
    lookup_wikipedia: bool = True,
    verbose: bool = True,
    force: bool = False,
) -> dict[str, Any]:
    """Extract hosts for all channels that haven't been processed."""
    client = get_client()
    stats = {"channels_processed": 0, "hosts_found": 0, "errors": []}

    # Get channels - either all (force) or only unprocessed
    query = client.table("sources").select("id, name")
    if not force:
        query = query.is_("hosts_extracted_at", "null")
    sources = query.execute()

    if not sources.data:
        if verbose:
            print("No channels need host extraction")
        return stats

    if verbose:
        print(f"Found {len(sources.data)} channels to process\n")

    for source in sources.data:
        if verbose:
            print(f"[{source['name']}]")

        try:
            hosts = extract_hosts_for_channel(
                source["id"],
                provider=provider,
                lookup_wikipedia=lookup_wikipedia,
                verbose=verbose,
            )
            stats["channels_processed"] += 1
            stats["hosts_found"] += len(hosts)
        except Exception as e:
            stats["errors"].append(f"{source['name']}: {e}")
            if verbose:
                print(f"  Error: {e}")

        if verbose:
            print()

    return stats


# =============================================================================
# Host Verification
# =============================================================================

def verify_hosts_interactive(verbose: bool = True) -> dict[str, Any]:
    """Interactive verification of AI-extracted hosts."""
    stats = {"verified": 0, "removed": 0, "skipped": 0}

    unverified = get_unverified_hosts()

    if not unverified:
        if verbose:
            print("No unverified hosts found")
        return stats

    # Group by source
    by_source: dict[str, list] = {}
    for item in unverified:
        source_name = item["source"]["name"] if item.get("source") else "Unknown"
        source_id = item["source_id"]
        key = f"{source_id}|{source_name}"
        if key not in by_source:
            by_source[key] = []
        by_source[key].append(item)

    client = get_client()

    for key, hosts in by_source.items():
        source_id, source_name = key.split("|", 1)
        host_names = [h["person"]["name"] for h in hosts if h.get("person")]

        print(f"\nChannel: {source_name}")
        print(f"Detected hosts: {', '.join(host_names)}")
        print("Options: [y]es all correct, [n]o remove all, [e]dit individually, [s]kip")

        choice = input("Choice: ").strip().lower()

        if choice == "y":
            # Verify all
            for host in hosts:
                client.table("source_people").update({"verified": True}).eq(
                    "id", host["id"]
                ).execute()
                stats["verified"] += 1
            print(f"  ✓ Verified {len(hosts)} host(s)")

        elif choice == "n":
            # Remove all
            for host in hosts:
                client.table("source_people").delete().eq("id", host["id"]).execute()
                stats["removed"] += 1
            print(f"  ✗ Removed {len(hosts)} host(s)")

        elif choice == "e":
            # Edit individually
            for host in hosts:
                person_name = host["person"]["name"] if host.get("person") else "Unknown"
                print(f"  {person_name} - [y]es verify, [n]o remove, [s]kip")
                sub_choice = input("  Choice: ").strip().lower()

                if sub_choice == "y":
                    client.table("source_people").update({"verified": True}).eq(
                        "id", host["id"]
                    ).execute()
                    stats["verified"] += 1
                    print(f"    ✓ Verified")
                elif sub_choice == "n":
                    client.table("source_people").delete().eq("id", host["id"]).execute()
                    stats["removed"] += 1
                    print(f"    ✗ Removed")
                else:
                    stats["skipped"] += 1
                    print(f"    - Skipped")
        else:
            stats["skipped"] += len(hosts)
            print(f"  - Skipped {len(hosts)} host(s)")

    return stats


# =============================================================================
# Video Guest Extraction
# =============================================================================

def extract_guests_for_video(
    video_id: str,
    provider: Provider = "openai",
    lookup_wikipedia: bool = True,
    verbose: bool = True,
) -> list[dict]:
    """Extract guests for a single video."""
    client = get_client()

    # Get video info
    video = (
        client.table("videos")
        .select("*, source:sources(id, name)")
        .eq("id", video_id)
        .single()
        .execute()
    )

    if not video.data:
        raise ValueError(f"Video not found: {video_id}")

    video_data = video.data
    source_id = video_data["source_id"]
    source_data = video_data.get("source")
    if isinstance(source_data, list):
        source_data = source_data[0] if source_data else {}
    channel_name = source_data.get("name", "Unknown") if source_data else "Unknown"
    title = video_data.get("title", "")
    description = video_data.get("description", "") or ""

    # Get verified hosts for this channel
    verified_hosts = get_verified_hosts(source_id)
    host_names = [h["person"]["name"] for h in verified_hosts if h.get("person")]

    # Build hosts context for prompt
    hosts_context = ""
    if host_names:
        hosts_context = f"Known hosts (DO NOT include these): {', '.join(host_names)}"

    if verbose:
        print(f"  Extracting guests from: {title[:60]}...")

    # Extract guests using AI
    prompt = GUEST_EXTRACTION_PROMPT.format(
        channel_name=channel_name,
        hosts_context=hosts_context,
        title=title,
        description=description[:2000],  # Limit description length
    )
    extracted = extract_people(prompt, provider)

    guests = []
    for i, item in enumerate(extracted):
        name = item.get("name", "").strip()
        role = item.get("role", "guest")

        if not name:
            continue

        # Skip if name matches a host
        if any(name.lower() == h.lower() for h in host_names):
            continue

        if verbose:
            print(f"    Found guest: {name} (role: {role})")

        # Search Wikipedia
        wikipedia_url = None
        if lookup_wikipedia:
            wikipedia_url = search_wikipedia(name)
            if verbose and wikipedia_url:
                print(f"      Wikipedia: {wikipedia_url}")

        # Create/get person record
        person = upsert_person(name, wikipedia_url=wikipedia_url)

        # Link to video
        link_person_to_video(
            video_id=video_id,
            person_id=person["id"],
            role=role,
            display_order=i,
        )

        guests.append({"person": person, "role": role})

    # Also link verified hosts to this video
    for i, host in enumerate(verified_hosts):
        if host.get("person"):
            link_person_to_video(
                video_id=video_id,
                person_id=host["person"]["id"],
                role="host",
                display_order=i,
            )

    # Mark video as processed
    client.table("videos").update(
        {"people_extracted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", video_id).execute()

    return guests


def extract_guests_batch(
    limit: int = 10,
    provider: Provider = "openai",
    lookup_wikipedia: bool = True,
    verbose: bool = True,
) -> dict[str, Any]:
    """Extract guests for videos that haven't been processed.

    Only processes videos that have metadata (metadata_scraped_at is set),
    since guest extraction relies on video descriptions.
    """
    client = get_client()
    stats = {"videos_processed": 0, "guests_found": 0, "errors": []}

    # Get videos without people_extracted_at that HAVE metadata
    # (metadata_scraped_at is not null - ensures we have description)
    videos = (
        client.table("videos")
        .select("id, title")
        .is_("people_extracted_at", "null")
        .not_.is_("metadata_scraped_at", "null")
        .limit(limit)
        .execute()
    )

    if not videos.data:
        if verbose:
            print("No videos need people extraction (with metadata)")
        return stats

    if verbose:
        print(f"Found {len(videos.data)} videos to process (using {provider})\n")

    for video in videos.data:
        try:
            guests = extract_guests_for_video(
                video["id"],
                provider=provider,
                lookup_wikipedia=lookup_wikipedia,
                verbose=verbose,
            )
            stats["videos_processed"] += 1
            stats["guests_found"] += len(guests)

            if verbose:
                print(f"    ✓ Found {len(guests)} guest(s)\n")

        except Exception as e:
            stats["errors"].append(f"{video['title'][:50]}: {e}")
            if verbose:
                print(f"    ✗ Error: {e}\n")

    if verbose:
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Videos processed: {stats['videos_processed']}")
        print(f"Guests found: {stats['guests_found']}")
        if stats["errors"]:
            print(f"Errors: {len(stats['errors'])}")
            for err in stats["errors"][:5]:
                print(f"  - {err}")

    return stats


# =============================================================================
# CLI
# =============================================================================

def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Extract people (hosts, guests) from videos and channels"
    )
    parser.add_argument(
        "-n",
        "--limit",
        type=int,
        default=10,
        help="Maximum number of videos to process (default: 10)",
    )
    parser.add_argument(
        "--channels",
        action="store_true",
        help="Extract hosts for all channels (run first)",
    )
    parser.add_argument(
        "--verify-hosts",
        action="store_true",
        help="Interactively verify extracted hosts",
    )
    parser.add_argument(
        "--video-id",
        type=str,
        help="Extract people for a specific video",
    )
    parser.add_argument(
        "--provider",
        type=str,
        choices=["openai", "anthropic"],
        default="openai",
        help="AI provider to use (default: openai)",
    )
    parser.add_argument(
        "--no-wikipedia",
        action="store_true",
        help="Skip Wikipedia URL lookup",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Minimal output",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process channels/videos even if already processed",
    )
    parser.add_argument(
        "--fetch-descriptions",
        action="store_true",
        help="Fetch channel descriptions from YouTube (for channels missing them)",
    )

    args = parser.parse_args()
    verbose = not args.quiet
    lookup_wikipedia = not args.no_wikipedia

    if args.fetch_descriptions:
        # Fetch channel descriptions from YouTube
        stats = fetch_channel_descriptions(verbose=verbose)
        if verbose:
            print(f"\nChannels updated: {stats['updated']}")
            print(f"Channels skipped (already have description): {stats['skipped']}")
            if stats["errors"]:
                print(f"Errors: {len(stats['errors'])}")

    elif args.channels:
        # Extract hosts for all channels
        stats = extract_hosts_all_channels(
            provider=args.provider,
            lookup_wikipedia=lookup_wikipedia,
            verbose=verbose,
            force=args.force,
        )
        if verbose:
            print(f"\nChannels processed: {stats['channels_processed']}")
            print(f"Hosts found: {stats['hosts_found']}")
            if stats["errors"]:
                print(f"Errors: {len(stats['errors'])}")

    elif args.verify_hosts:
        # Interactive host verification
        stats = verify_hosts_interactive(verbose=verbose)
        if verbose:
            print(f"\nVerified: {stats['verified']}")
            print(f"Removed: {stats['removed']}")
            print(f"Skipped: {stats['skipped']}")

    elif args.video_id:
        # Process single video
        guests = extract_guests_for_video(
            args.video_id,
            provider=args.provider,
            lookup_wikipedia=lookup_wikipedia,
            verbose=verbose,
        )
        if verbose:
            print(f"\nGuests found: {len(guests)}")

    else:
        # Batch process videos
        extract_guests_batch(
            limit=args.limit,
            provider=args.provider,
            lookup_wikipedia=lookup_wikipedia,
            verbose=verbose,
        )


if __name__ == "__main__":
    main()
