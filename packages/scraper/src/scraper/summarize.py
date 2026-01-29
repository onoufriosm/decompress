"""
Generate AI summaries for video transcripts.

Supports OpenAI (default) and Anthropic Claude as providers.
"""

import argparse
import os
from typing import Any, Literal

import anthropic
import openai
from dotenv import load_dotenv

from .db import get_client

load_dotenv()

Provider = Literal["openai", "anthropic"]


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


SYSTEM_PROMPT = """You are an expert at summarizing video content. Your task is to create comprehensive summaries that capture:

1. Main topics and themes discussed
2. Key points and arguments made
3. Notable quotes or statements
4. Any actionable insights or takeaways
5. The overall structure and flow of the discussion

Write in a clear, organized manner using bullet points and sections where appropriate. The summary should be thorough enough that someone could understand the main content without watching the video, while being concise enough to read quickly.

IMPORTANT: Do NOT include a title, header, or preamble at the beginning of your response. Start directly with the summary content. Do not write things like "Comprehensive Summary of Video:" or "Summary:" at the start."""


def generate_summary_openai(transcript: str, title: str = "") -> str:
    """Generate summary using OpenAI."""
    client = get_openai_client()

    # Truncate transcript if too long
    max_chars = 100000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars] + "\n\n[Transcript truncated due to length]"

    user_prompt = f"""Please provide a comprehensive summary of the following video transcript.

{f'Video Title: {title}' if title else ''}

Transcript:
{transcript}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=2000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    return response.choices[0].message.content or ""


def generate_summary_anthropic(transcript: str, title: str = "") -> str:
    """Generate summary using Anthropic Claude."""
    client = get_anthropic_client()

    # Truncate transcript if too long
    max_chars = 100000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars] + "\n\n[Transcript truncated due to length]"

    user_prompt = f"""Please provide a comprehensive summary of the following video transcript.

{f'Video Title: {title}' if title else ''}

Transcript:
{transcript}"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": user_prompt}],
        system=SYSTEM_PROMPT,
    )

    return message.content[0].text


def generate_summary(
    transcript: str, title: str = "", provider: Provider = "openai"
) -> str:
    """
    Generate a comprehensive summary of a video transcript.

    Args:
        transcript: The full transcript text
        title: Optional video title for context
        provider: AI provider to use ("openai" or "anthropic")

    Returns:
        The generated summary
    """
    if provider == "anthropic":
        return generate_summary_anthropic(transcript, title)
    return generate_summary_openai(transcript, title)


def get_videos_without_summary(limit: int = 10) -> list[dict[str, Any]]:
    """Get videos that have transcripts but no summary."""
    client = get_client()

    result = (
        client.table("videos")
        .select("id, external_id, title, transcript")
        .not_.is_("transcript", "null")
        .is_("summary", "null")
        .limit(limit)
        .execute()
    )

    return result.data


def update_video_summary(video_id: str, summary: str) -> None:
    """Update a video's summary in the database."""
    client = get_client()

    client.table("videos").update(
        {"summary": summary, "summary_generated_at": "now()"}
    ).eq("id", video_id).execute()


def summarize_videos(
    limit: int = 10, verbose: bool = True, provider: Provider = "openai"
) -> dict[str, Any]:
    """
    Generate summaries for videos that don't have them yet.

    Args:
        limit: Maximum number of videos to summarize
        verbose: Print progress messages
        provider: AI provider to use ("openai" or "anthropic")

    Returns:
        Stats dict with counts
    """
    stats = {"videos_found": 0, "summaries_generated": 0, "errors": []}

    videos = get_videos_without_summary(limit)
    stats["videos_found"] = len(videos)

    if not videos:
        if verbose:
            print("No videos found that need summaries")
        return stats

    if verbose:
        print(f"Found {len(videos)} videos to summarize (using {provider})\n")

    for i, video in enumerate(videos):
        video_id = video["id"]
        title = video.get("title", "Unknown")
        transcript = video.get("transcript", "")

        if verbose:
            print(f"[{i+1}/{len(videos)}] {title[:60]}...")

        if not transcript:
            stats["errors"].append(f"No transcript for {video_id}")
            continue

        try:
            summary = generate_summary(transcript, title, provider)
            update_video_summary(video_id, summary)
            stats["summaries_generated"] += 1

            if verbose:
                print(f"    ✓ Generated summary ({len(summary)} chars)")

        except Exception as e:
            stats["errors"].append(f"Error for {video_id}: {e}")
            if verbose:
                print(f"    ✗ Failed: {e}")

    if verbose:
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Videos found: {stats['videos_found']}")
        print(f"Summaries generated: {stats['summaries_generated']}")
        if stats["errors"]:
            print(f"Errors: {len(stats['errors'])}")
            for err in stats["errors"][:5]:
                print(f"  - {err}")

    return stats


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate AI summaries for video transcripts"
    )
    parser.add_argument(
        "-n",
        "--limit",
        type=int,
        default=10,
        help="Maximum number of videos to summarize (default: 10)",
    )
    parser.add_argument("-q", "--quiet", action="store_true", help="Minimal output")
    parser.add_argument(
        "--video-id", type=str, help="Summarize a specific video by ID"
    )
    parser.add_argument(
        "--provider",
        type=str,
        choices=["openai", "anthropic"],
        default="openai",
        help="AI provider to use (default: openai)",
    )

    args = parser.parse_args()

    if args.video_id:
        # Single video mode
        client = get_client()
        result = (
            client.table("videos")
            .select("id, title, transcript")
            .eq("id", args.video_id)
            .single()
            .execute()
        )

        video = result.data
        if not video:
            print(f"Video not found: {args.video_id}")
            return

        if not video.get("transcript"):
            print("Video has no transcript")
            return

        print(f"Generating summary for: {video['title']} (using {args.provider})")
        summary = generate_summary(video["transcript"], video["title"], args.provider)
        update_video_summary(args.video_id, summary)
        print(f"\nSummary ({len(summary)} chars):\n")
        print(summary)
    else:
        # Batch mode
        summarize_videos(limit=args.limit, verbose=not args.quiet, provider=args.provider)


if __name__ == "__main__":
    main()
