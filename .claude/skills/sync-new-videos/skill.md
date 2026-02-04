# Sync New Videos Skill

Fetch new videos from all YouTube channels and add them to the database with transcripts.

## What it does

1. Reads all channels from `channels.json`
2. For each channel, checks which videos already exist in the database
3. Fetches recent videos from YouTube (sorted by most recent first)
4. **Only adds videos not already in the database**
5. For **new channels** (no existing videos): limits to the **last 10 videos** only
6. For **existing channels**: limits to the most recent N new videos (default: 20)
7. Filters out short videos (< 20 minutes)
8. Fetches metadata and transcripts for each new video
9. Saves to the database

## Usage

```bash
cd packages/scraper && uv run python video_tasks.py sync-new
```

### Options

- `--limit N` - Max new videos per existing channel (default: 20)
- `--new-channel-limit N` - Max videos for newly added channels (default: 10)

```bash
# Sync with defaults
cd packages/scraper && uv run python video_tasks.py sync-new

# Limit to 5 new videos per existing channel
cd packages/scraper && uv run python video_tasks.py sync-new --limit 5

# For new channels, only get the last 5 videos
cd packages/scraper && uv run python video_tasks.py sync-new --new-channel-limit 5
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

--- NewPodcast (@newpodcast) ---
  No videos in DB for this channel (new channel)
  50 videos found, taking 10 most recent (new channel)
  + Latest Episode...
    ✓ transcript (32000 chars)

=== COMPLETE ===
New videos added: 12
Transcripts fetched: 12
```

## When to Use

Use this command when you want to:
- Add latest videos from all channels
- Keep the database up to date with new content
- Avoid re-processing existing videos
- Add a new channel without backfilling its entire history

## Related Commands

- `video_tasks.py status` - Check current video/transcript/summary counts
- `video_tasks.py fetch-all-transcripts` - Fetch transcripts for videos already in DB that are missing them
