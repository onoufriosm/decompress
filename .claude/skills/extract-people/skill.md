# Extract People Skill

Extract hosts and guests from videos using Claude's intelligence, then find their Wikipedia pages.

## Overview

This skill replaces the Python AI-based extraction with Claude Code's direct analysis. You will:
1. Read video/channel information (title, description)
2. Identify the people (hosts/guests) using your understanding
3. Search Wikipedia for each person to get their URL and photo
4. Save the results to the database

## Commands

All commands run from the scraper directory:
```bash
cd packages/scraper
```

### Check Status
```bash
uv run python people_tasks.py status
```

### Extract Hosts (Run First for New Channels)

1. List channels needing host extraction:
```bash
uv run python people_tasks.py list-channels-pending
```

2. Get channel info:
```bash
uv run python people_tasks.py get-channel <source_id>
```

3. **Analyze the channel description and video titles/descriptions to identify the HOST(s)**
   - Hosts are the consistent faces who appear in most/all videos
   - Look for patterns like "hosted by X", "X and Y discuss", "In this episode, [HOST] talks to..."
   - Podcasts typically have 1-3 regular hosts

4. For each host found, search Wikipedia:
```bash
uv run python people_tasks.py search-wikipedia "Host Name"
```

5. Save each host:
```bash
uv run python people_tasks.py save-host <source_id> "Host Name" --wikipedia-url "URL" --photo-url "URL"
```

6. Mark channel as processed:
```bash
uv run python people_tasks.py mark-channel-processed <source_id>
```

### Extract Guests (After Hosts are Set)

1. List videos needing people extraction:
```bash
uv run python people_tasks.py list-pending --limit 5
```

2. Get video details:
```bash
uv run python people_tasks.py get-video <video_id>
```

3. **Analyze the title and description to identify GUEST(s)**

   IMPORTANT RULES:
   - Focus on the DESCRIPTION - it usually contains the guest's name and bio
   - Titles are often clickbait and may mention famous people who are NOT actually guests
   - Look for patterns like "X joins us", "X breaks down", "conversation with X"
   - DO NOT include people merely MENTIONED or DISCUSSED - only actual guests
   - DO NOT include the hosts (they're already linked)
   - If it's a news segment or commentary video, there may be NO guests

4. For each guest found, search Wikipedia:
```bash
uv run python people_tasks.py search-wikipedia "Guest Name"
```

5. Save each guest:
```bash
uv run python people_tasks.py save-guest <video_id> "Guest Name" --wikipedia-url "URL" --photo-url "URL"
```

6. Mark video as processed (this also links verified hosts):
```bash
uv run python people_tasks.py mark-processed <video_id>
```

## Example Workflow

### Extracting Hosts for a New Channel

```bash
# 1. Check status
cd packages/scraper && uv run python people_tasks.py status

# 2. Get pending channels
uv run python people_tasks.py list-channels-pending

# 3. Get channel details
uv run python people_tasks.py get-channel abc123-def456

# Output shows channel description mentions "Hosted by John Smith and Jane Doe"
# Recent videos show pattern: "John and Jane talk to [GUEST]"

# 4. Search Wikipedia for hosts
uv run python people_tasks.py search-wikipedia "John Smith"
# WIKIPEDIA_URL: https://en.wikipedia.org/wiki/John_Smith_(podcaster)
# PHOTO_URL: https://upload.wikimedia.org/...

uv run python people_tasks.py search-wikipedia "Jane Doe"
# WIKIPEDIA_URL: NOT_FOUND
# PHOTO_URL: NOT_FOUND

# 5. Save hosts
uv run python people_tasks.py save-host abc123-def456 "John Smith" \
  --wikipedia-url "https://en.wikipedia.org/wiki/John_Smith_(podcaster)" \
  --photo-url "https://upload.wikimedia.org/..."

uv run python people_tasks.py save-host abc123-def456 "Jane Doe"

# 6. Mark channel done
uv run python people_tasks.py mark-channel-processed abc123-def456
```

### Extracting Guests from a Video

```bash
# 1. List pending videos
cd packages/scraper && uv run python people_tasks.py list-pending --limit 3

# 2. Get video details
uv run python people_tasks.py get-video xyz789

# Output:
# TITLE: The Future of AI with Sam Altman
# HOSTS: John Smith, Jane Doe
# DESCRIPTION: In this episode, John and Jane sit down with Sam Altman,
# CEO of OpenAI, to discuss the future of artificial intelligence...

# 3. Analysis: Sam Altman is the guest (mentioned by name + role in description)

# 4. Search Wikipedia
uv run python people_tasks.py search-wikipedia "Sam Altman"
# WIKIPEDIA_URL: https://en.wikipedia.org/wiki/Sam_Altman
# PHOTO_URL: https://upload.wikimedia.org/...

# 5. Save guest
uv run python people_tasks.py save-guest xyz789 "Sam Altman" \
  --wikipedia-url "https://en.wikipedia.org/wiki/Sam_Altman" \
  --photo-url "https://upload.wikimedia.org/..."

# 6. Mark video processed (links hosts automatically)
uv run python people_tasks.py mark-processed xyz789
```

## Tips

1. **Wikipedia may return wrong person** - Verify the Wikipedia page matches (e.g., "Sam Altman" returns the OpenAI CEO, not some other Sam Altman)

2. **No Wikipedia page is fine** - Many podcast guests won't have Wikipedia pages. Just save without URLs.

3. **Skip commentary videos** - If it's just hosts discussing news/topics without a guest, mark it processed with no guests.

4. **Use full names** - "Sam Altman" not just "Sam" for better Wikipedia results.

5. **One video at a time** - Complete extraction for one video before moving to the next to avoid confusion.
