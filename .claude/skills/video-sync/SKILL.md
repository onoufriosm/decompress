---
name: video-sync
description: Sync video transcripts and summaries. Fetches missing transcripts from YouTube and creates AI summaries for videos that have transcripts but no summary.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Grep, Glob
---

# Video Sync Skill

Sync video transcripts and summaries in the database.

## Step 1: Check Status

```bash
cd packages/scraper && uv run python video_tasks.py status
```

## Step 2: Handle Missing Transcripts

```bash
cd packages/scraper && uv run python video_tasks.py fetch-all-transcripts
```

## Step 3: Create Summaries (ONE AT A TIME)

**IMPORTANT**: Process videos ONE AT A TIME to prevent context bleed between transcripts.

### 3a. Get pending videos:
```bash
cd packages/scraper && uv run python video_tasks.py list-pending --limit 5
```

### 3b. For EACH video, complete the full cycle before moving to next:

**Video 1:**
1. Fetch transcript:
```bash
cd packages/scraper && uv run python video_tasks.py get-transcript <id1>
```

2. Read the transcript output carefully

3. Generate summary using format below (focus ONLY on this video's content)

4. Save summary:
```bash
cd packages/scraper && uv run python video_tasks.py save-summary "<id1>" "<summary>"
```

**Video 2:** Repeat steps 1-4 for next video...

### 3c. Repeat until all videos are processed

## Summary Format

**IMPORTANT**: Use bold (`**Summary:**`) NOT markdown headers (`## Summary`). Headers render too large.

```
**Summary:**
[2-3 sentence overview]

**Key Points:**
- **[Topic]:** [2-4 sentence explanation with context and nuance]
- **[Topic]:** [Another detailed point...]

**Notable Quotes:**
- "[Quote]" - Speaker Name

**Actionable Insights:**
- [Practical takeaway]
```

## Guidelines

1. **Length scales with duration** - longer videos need more key points
2. **No repetition** - each section adds NEW information
3. **Go deep** - 6 well-explained points > 12 shallow ones
4. **No filler** - skip "Structure" or "Main Topics" sections
5. **Actionable = practical** - what to DO with the information
