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

## Step 3: Create Summaries (Batch of 5)

### 3a. Get pending videos:
```bash
cd packages/scraper && uv run python video_tasks.py list-pending --limit 5
```

### 3b. Fetch all 5 transcripts in PARALLEL:

Call these simultaneously (5 parallel Bash tool calls):
```bash
cd packages/scraper && uv run python video_tasks.py get-transcript <id1>
cd packages/scraper && uv run python video_tasks.py get-transcript <id2>
cd packages/scraper && uv run python video_tasks.py get-transcript <id3>
cd packages/scraper && uv run python video_tasks.py get-transcript <id4>
cd packages/scraper && uv run python video_tasks.py get-transcript <id5>
```

For large transcripts (>50K), save to scratchpad:
```bash
cat /path/to/output.txt | sed 's/\. /\.\n/g' > $SCRATCHPAD/t1.txt
```

### 3c. Generate all 5 summaries

Read all transcripts, then generate summaries using the format below.

### 3d. Save all 5 summaries:
```bash
cd packages/scraper && uv run python video_tasks.py save-summary "<id1>" "<summary1>"
cd packages/scraper && uv run python video_tasks.py save-summary "<id2>" "<summary2>"
# ... etc
```

### 3e. Repeat until done

## Summary Format

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
