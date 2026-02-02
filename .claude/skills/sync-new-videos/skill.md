# Sync New Videos Skill

Fetch new videos from all YouTube channels and add them to the database with transcripts.

## What it does

1. Reads all channels from `channels.json`
2. For each channel, finds the latest video date already in the database
3. Fetches recent videos from YouTube
4. **Only adds videos newer than the latest stored video** for that channel
5. Filters out short videos (< 20 minutes)
6. Fetches metadata and transcripts for each new video
7. Saves to the database

## Usage

```bash
cd packages/scraper && uv run python video_tasks.py sync-new
```

### Options

- `--limit N` - Max new videos per channel (default: 20)

```bash
cd packages/scraper && uv run python video_tasks.py sync-new --limit 5
```

## Example Output

```
=== SYNC NEW VIDEOS ===
Channels: 12

--- 20 VC (@20VC) ---
  Latest video in DB: 2024-01-15
  45 videos found, 3 new
  + Interview with Sam Altman on AI...
    ✓ transcript (45032 chars)
  + The Future of Venture Capital...
    ✓ transcript (38291 chars)

--- a16z (@a16z) ---
  32 videos found, 0 new

=== COMPLETE ===
New videos added: 3
Transcripts fetched: 3
```

## When to Use

Use this command when you want to:
- Add latest videos from all channels
- Keep the database up to date with new content
- Avoid re-processing existing videos

## Related Commands

- `video_tasks.py status` - Check current video/transcript/summary counts
- `video_tasks.py fetch-all-transcripts` - Fetch transcripts for videos already in DB that are missing them
