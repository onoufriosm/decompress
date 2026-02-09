# Weekly Digest Skill

Generate a synthesized weekly digest from video summaries in the database.

## Overview

This skill creates a comprehensive weekly digest by:
1. Fetching all video summaries from the past 7 days
2. Processing summaries in batches to extract key insights
3. Synthesizing a final digest with structured sections
4. Saving the digest to the database

## Prerequisites

- Videos must have summaries (the `summary` column populated)
- Access to the Supabase database

## Commands

### 1. Check Available Summaries

First, see how many videos have summaries from the past week:

```bash
cd packages/scraper && uv run python -c "
from supabase import create_client
import os
from datetime import datetime, timedelta

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

result = supabase.table('videos').select('id, title, summary, published_at').gte('published_at', week_ago).not_.is_('summary', 'null').order('published_at', desc=True).execute()

print(f'Found {len(result.data)} videos with summaries from the past week')
for v in result.data[:5]:
    print(f'  - {v[\"title\"][:60]}...')
"
```

### 2. Fetch All Summaries

Export summaries to a file for processing:

```bash
cd packages/scraper && uv run python -c "
from supabase import create_client
import os, json
from datetime import datetime, timedelta

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
week_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()

result = supabase.table('videos').select('id, title, summary, published_at, sources(name)').gte('published_at', week_ago).not_.is_('summary', 'null').order('published_at', desc=True).execute()

with open('weekly_summaries.json', 'w') as f:
    json.dump(result.data, f, indent=2)

print(f'Exported {len(result.data)} summaries to weekly_summaries.json')
"
```

### 3. Process Summaries in Batches

Read the summaries and process them. For large volumes (30+ summaries), process in batches of 10:

**Batch processing approach:**
1. Split summaries into batches of ~10
2. For each batch, extract: key news, contrarian views, investor insights, founder insights, tech insights
3. Combine batch outputs into a master list

### 4. Generate Final Digest

Using all extracted insights, generate the final digest following this structure:

```markdown
# Weekly Tech & Investing Digest

## Executive Summary
[2-3 paragraph overview of the week's dominant themes]

---

## Top News This Week

### Mega Deals & Market Moves
[Major funding, acquisitions, IPOs, market movements]

### Product Launches
[New products, features, releases]

### Viral Phenomena
[Things that captured attention this week]

---

## Contrarian Views
| View | Speaker/Source |
|------|----------------|
[Table of surprising or contrarian takes with attribution]

---

## Key Contradictions Between Speakers
[Tables showing where experts disagree]

---

## Insights for Investors
### Bullish Signals
### Bearish Signals
### Actionable Opportunities

---

## Insights for Founders
### Product Development
### Go-to-Market
### Capital & Fundraising
### Leadership & Culture

---

## Insights for Tech Enthusiasts
### AI Agents & Architecture
### Hardware Developments
### Security Warnings

---

## Emerging Trends
[Major themes emerging across multiple sources]

---

## Other Important Topics
[Miscellaneous important items]

---

## Quote of the Week
> [Most memorable quote]
> — [Speaker]

---

*Compiled from N video summaries across: [Source breakdown]*
```

### 5. Save to Database

Once the digest is finalized, save it:

```bash
cd packages/scraper && uv run python -c "
from supabase import create_client
import os
from datetime import datetime, timedelta

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

# Calculate week_start (Monday of the current week)
today = datetime.utcnow().date()
week_start = today - timedelta(days=today.weekday())

content = '''
[PASTE YOUR FINAL DIGEST MARKDOWN HERE]
'''

result = supabase.table('digests').upsert({
    'week_start': str(week_start),
    'content': content.strip()
}, on_conflict='week_start').execute()

print(f'Saved digest for week starting {week_start}')
"
```

## Tips

1. **Quality over speed** - Take time to identify truly important insights vs noise
2. **Attribution matters** - Always credit the source/speaker for each insight
3. **Contradictions are gold** - When experts disagree, highlight both perspectives
4. **Actionable > interesting** - Prioritize insights people can act on
5. **Skip promotional content** - Ignore self-promotion and ads in summaries

## Example Batch Processing Prompt

When processing a batch of summaries, use this prompt structure:

```
I have the following video summaries. Extract:
1. Major news/announcements (deals, launches, market moves)
2. Contrarian or surprising views (with speaker name)
3. Actionable insights for investors
4. Actionable insights for founders
5. Technical insights for AI/tech enthusiasts

[PASTE BATCH OF SUMMARIES]

Format as bullet points with source attribution.
```

Then combine all batch outputs to create the final digest.
