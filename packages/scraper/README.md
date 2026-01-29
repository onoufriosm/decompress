# YouTube Channel Scraper

Scrape YouTube channel videos with metadata and transcripts using yt-dlp.

## Installation

```bash
uv sync
```

## Usage

### Scrape to Database (Supabase)

The primary way to use the scraper is to scrape channels defined in `channels.json` directly to the Supabase database.

```bash
cd packages/scraper

# Scrape last 5 videos from ALL channels with full metadata + transcripts
uv run python -m scraper.scrape_to_db -n 5

# Scrape last 10 videos (default) from all channels
uv run python -m scraper.scrape_to_db

# Scrape last 20 videos without transcripts (faster)
uv run python -m scraper.scrape_to_db -n 20 --no-transcripts

# FAST MODE: Skip rich metadata (~10x faster, only gets id/title/duration)
uv run python -m scraper.scrape_to_db -n 50 --fast

# Fast mode + no transcripts (fastest - just ingest video list)
uv run python -m scraper.scrape_to_db -n 100 --fast --no-transcripts

# Scrape specific channels only
uv run python -m scraper.scrape_to_db -n 5 -c "Triggernometry" "Lex Fridman"

# Scrape a single channel by handle (not in channels.json)
uv run python -m scraper.scrape_to_db --single @triggerpod -n 5

# Quiet mode (minimal output)
uv run python -m scraper.scrape_to_db -n 5 -q
```

#### Scraper Options

| Flag | Description |
|------|-------------|
| `-n, --limit` | Number of videos per channel (default: 10) |
| `--fast` | Skip rich metadata (faster, only gets id/title/duration) |
| `--no-transcripts` | Skip fetching transcripts |
| `-c, --channels` | Specific channel names to scrape |
| `--single HANDLE` | Scrape a single channel by handle |
| `-q, --quiet` | Minimal output |

**Performance Notes:**
- Full metadata takes ~2-3 seconds per video (yt-dlp parses full page)
- `--fast` mode is ~10x faster but skips: description, view count, tags, thumbnail
- Videos scraped with `--fast` won't be processed by people extraction (requires description)

### Generate Summaries

Generate AI summaries for videos that have transcripts:

```bash
# Summarize 10 videos (default, using OpenAI)
uv run python -m scraper.summarize

# Summarize 20 videos using Anthropic Claude
uv run python -m scraper.summarize -n 20 --provider anthropic

# Summarize a specific video by ID
uv run python -m scraper.summarize --video-id <uuid>
```

### Extract People (Hosts & Guests)

Extract hosts and guests from videos using AI:

```bash
# Step 1: Extract hosts for all channels (run once per new channel)
uv run python -m scraper.extract_people --channels

# Step 2: Interactively verify extracted hosts
uv run python -m scraper.extract_people --verify-hosts

# Step 3: Extract guests from videos (batch)
uv run python -m scraper.extract_people -n 20

# Extract guests for a specific video
uv run python -m scraper.extract_people --video-id <uuid>

# Use Anthropic instead of OpenAI
uv run python -m scraper.extract_people -n 10 --provider anthropic
```

**Note:** Guest extraction only processes videos that have metadata (`metadata_scraped_at` is set). Videos scraped with `--fast` will be skipped.

### Fetch Transcripts (Standalone)

Fetch transcripts for videos that don't have them:

```bash
# Fetch transcripts for 10 videos without transcripts
uv run python -m scraper.transcript -n 10

# Fetch transcript for a specific video
uv run python -m scraper.transcript --video-id <uuid>
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service role key for database access |
| `SUPADATA_API_KEY` | API key for transcript fetching via [Supadata](https://supadata.ai) |
| `OPENAI_API_KEY` | OpenAI API key (for summaries and people extraction) |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional, alternative to OpenAI) |

## Pipeline Overview

The typical workflow for ingesting new content:

```
1. Scrape videos      → scrape_to_db (gets metadata + transcripts)
2. Generate summaries → summarize (AI summary from transcript)
3. Extract hosts      → extract_people --channels (once per channel)
4. Verify hosts       → extract_people --verify-hosts (interactive)
5. Extract guests     → extract_people (AI extraction from description)
```

**Fast Ingestion (then enrich later):**

```bash
# Quick: Get all video IDs into database
uv run python -m scraper.scrape_to_db -n 100 --fast --no-transcripts

# Later: Run full scrape to enrich with metadata + transcripts
uv run python -m scraper.scrape_to_db -n 100
```

## Scrape to JSON File (without database)

For local testing or exporting to JSON files:

```bash
cd packages/scraper

# Fast mode - just video IDs and titles (instant)
uv run python -m scraper.channel https://www.youtube.com/@triggerpod --fast

# With rich metadata for first 10 videos
uv run python -m scraper.channel https://www.youtube.com/@triggerpod --metadata-limit 10

# With rich metadata + transcripts for first 10
uv run python -m scraper.channel https://www.youtube.com/@triggerpod --metadata-limit 10 --transcripts 10

# Custom output file
uv run python -m scraper.channel https://www.youtube.com/@triggerpod -o output/triggerpod.json

# Add transcripts to existing JSON file
uv run python -m scraper.channel --input output/videos.json --transcripts 10
```

## Python API

```python
from pathlib import Path
from scraper.channel import (
    fetch_channel_videos,
    add_transcripts,
    load_videos,
    save_videos,
)

# Fetch all videos with rich metadata for first 20
videos = fetch_channel_videos(
    "https://www.youtube.com/@triggerpod",
    output_file=Path("output/triggerpod.json"),
    enrich_metadata=True,
    metadata_limit=20,
)

# Add transcripts to first 10 videos
add_transcripts(videos, limit=10, output_file=Path("output/triggerpod.json"))

# Or load existing file and add transcripts
videos = load_videos(Path("output/triggerpod.json"))
add_transcripts(videos, limit=5, output_file=Path("output/triggerpod.json"))
```

### Low-level functions

```python
from scraper.channel import (
    get_channel_video_ids,
    get_video_metadata,
    get_transcript,
)

# Get all video IDs (fast)
channel_title, videos = get_channel_video_ids("https://www.youtube.com/@triggerpod")

# Get rich metadata for a single video
metadata = get_video_metadata("dQw4w9WgXcQ")

# Get transcript for a single video
transcript = get_transcript("dQw4w9WgXcQ", lang="en")
```

## Output Format

Videos are saved as JSON with the following fields:

```json
{
  "id": "video_id",
  "title": "Video Title",
  "description": "Full description...",
  "upload_date": "20240115",
  "duration": 3600,
  "duration_string": "1:00:00",
  "channel": "Channel Name",
  "channel_id": "UC...",
  "thumbnail": "https://...",
  "tags": ["tag1", "tag2"],
  "categories": ["Entertainment"],
  "url": "https://www.youtube.com/watch?v=...",
  "transcript": "Full transcript text..."
}
```
