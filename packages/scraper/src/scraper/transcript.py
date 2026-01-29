"""
Transcript fetching utilities.

This module provides a unified interface for fetching video transcripts
from various providers. Currently supports:
- Supadata API (primary)
- YouTube Transcript API (fallback, if enabled)
"""

import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

# Set up logging
logger = logging.getLogger(__name__)

load_dotenv()


class TranscriptResult:
    """Result of a transcript fetch operation."""

    def __init__(
        self,
        content: str | None,
        language: str | None = None,
        provider: str | None = None,
        error: str | None = None,
    ):
        self.content = content
        self.language = language
        self.provider = provider
        self.error = error

    @property
    def success(self) -> bool:
        return self.content is not None and len(self.content) > 0


def fetch_transcript_supadata(video_id: str) -> TranscriptResult:
    """
    Fetch transcript using Supadata API.

    Args:
        video_id: YouTube video ID

    Returns:
        TranscriptResult with content and metadata
    """
    api_key = os.getenv("SUPADATA_API_KEY")

    if not api_key:
        return TranscriptResult(
            content=None,
            error="SUPADATA_API_KEY not configured",
        )

    video_url = f"https://youtu.be/{video_id}"
    api_url = f"https://api.supadata.ai/v1/transcript?url={video_url}"

    try:
        response = httpx.get(
            api_url,
            headers={"x-api-key": api_key},
            timeout=30.0,
        )

        if response.status_code == 200:
            data = response.json()
            content = data.get("content")

            # Content is an array of segments with text, offset, duration
            # Extract and join just the text for LLM consumption
            if isinstance(content, list):
                text = " ".join(segment.get("text", "") for segment in content)
                # Clean up whitespace
                text = " ".join(text.split())
                # Get language from first segment if available
                lang = content[0].get("lang") if content else None
            else:
                # Fallback if content is already a string
                text = content
                lang = data.get("lang")

            # Verify we have meaningful content (not just whitespace or very short)
            if text and len(text) > 10:
                return TranscriptResult(
                    content=text,
                    language=lang,
                    provider="supadata",
                )
            else:
                return TranscriptResult(
                    content=None,
                    error="Supadata returned empty or too short transcript",
                )
        else:
            return TranscriptResult(
                content=None,
                error=f"Supadata API error: {response.status_code} - {response.text}",
            )

    except httpx.TimeoutException:
        return TranscriptResult(
            content=None,
            error="Supadata API timeout",
        )
    except Exception as e:
        return TranscriptResult(
            content=None,
            error=f"Supadata API error: {str(e)}",
        )


def fetch_transcript_youtube_api(video_id: str, lang: str = "en") -> TranscriptResult:
    """
    Fetch transcript using YouTube Transcript API (fallback).

    Args:
        video_id: YouTube video ID
        lang: Preferred language code

    Returns:
        TranscriptResult with content and metadata
    """
    try:
        import re
        from youtube_transcript_api import YouTubeTranscriptApi

        ytt_api = YouTubeTranscriptApi()

        # Try to get transcript in preferred language order
        languages_to_try = [lang, f"{lang}-US", f"{lang}-GB", "en", "en-US", "en-GB"]

        transcript = ytt_api.fetch(video_id, languages=languages_to_try)

        # Join all text segments
        text = " ".join([entry.text for entry in transcript])

        # Clean up the text
        text = re.sub(r"\s+", " ", text).strip()

        # Verify we have meaningful content (not just whitespace or very short)
        if text and len(text) > 10:
            return TranscriptResult(
                content=text,
                language=lang,
                provider="youtube_transcript_api",
            )
        else:
            return TranscriptResult(
                content=None,
                error="Empty transcript",
            )

    except Exception as e:
        return TranscriptResult(
            content=None,
            error=f"YouTube Transcript API error: {str(e)}",
        )


# Available transcript providers
PROVIDERS = {
    "supadata": fetch_transcript_supadata,
    "youtube_api": fetch_transcript_youtube_api,
}

# Default provider order: try free youtube_api first, then paid supadata as fallback
DEFAULT_PROVIDERS = ["youtube_api", "supadata"]


def fetch_transcript(
    video_id: str,
    providers: list[str] | None = None,
) -> TranscriptResult:
    """
    Fetch transcript using configured providers in order.

    Args:
        video_id: YouTube video ID
        providers: List of provider names to try in order.
                   Available: "supadata", "youtube_api"
                   Default: ["youtube_api", "supadata"] (free first, paid fallback)

    Returns:
        TranscriptResult from the first successful provider

    Examples:
        # Use default (youtube_api first, supadata fallback)
        fetch_transcript("dQw4w9WgXcQ")

        # Use only supadata
        fetch_transcript("dQw4w9WgXcQ", providers=["supadata"])

        # Use only youtube_api
        fetch_transcript("dQw4w9WgXcQ", providers=["youtube_api"])
    """
    if providers is None:
        providers = DEFAULT_PROVIDERS

    errors = []

    for provider in providers:
        if provider not in PROVIDERS:
            logger.warning(f"[{video_id}] Unknown provider: {provider}")
            continue

        logger.debug(f"[{video_id}] Trying provider: {provider}")
        result = PROVIDERS[provider](video_id)

        if result.success:
            logger.info(f"[{video_id}] Success with {provider} ({len(result.content)} chars)")
            return result

        if result.error:
            logger.debug(f"[{video_id}] {provider} failed: {result.error}")
            errors.append(f"{provider}: {result.error}")

    # All providers failed
    logger.warning(f"[{video_id}] All providers failed: {'; '.join(errors)}")
    return TranscriptResult(
        content=None,
        error="; ".join(errors) if errors else "No providers available",
    )
