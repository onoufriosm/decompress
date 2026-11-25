# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decompress is a tool that reduces information overload from podcasts and YouTube videos by generating AI summaries, email digests, and enabling AI-powered chat over transcripts. Users subscribe to channels, get automatic summaries, and can chat with video content.

## Repository Structure

This is a monorepo under `packages/` with no workspace manager — each package is independent with its own `package.json` or `pyproject.toml`.

| Package | Stack | Purpose |
|---------|-------|---------|
| `web` | React 19, Vite, Tailwind CSS 4, shadcn/ui | SPA frontend |
| `server` | Hono, Vercel AI SDK, Node.js | API server: AI chat, email digests, channel management |
| `api` | Hono, Supabase CLI | Database migrations, Supabase Edge Functions (Stripe checkout/webhooks) |
| `scraper` | Python 3.13, uv, yt-dlp | YouTube scraping, transcript fetching, AI summarization |
| `trigger` | Trigger.dev v4 | Background job: `process-channel` task (fetch → transcript → summarize → save) |
| `e2e` | Playwright | End-to-end tests against the web frontend |

## Commands

### Web (frontend)
```bash
cd packages/web
npm run dev          # Vite dev server on :5173
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
```

### Server (API)
```bash
cd packages/server
npm run dev          # tsx watch on :3001
npm run build        # tsc
```

### Scraper (Python)
```bash
cd packages/scraper
uv sync                                              # Install deps
uv run python video_tasks.py sync-new                # Discover new videos from all channels
uv run python video_tasks.py status                  # Check video/transcript/summary counts
uv run python video_tasks.py fetch-all-transcripts   # Fetch missing transcripts
uv run python video_tasks.py list-pending --limit 5  # Videos needing summaries
uv run python video_tasks.py get-transcript <id>     # Get single transcript
uv run python video_tasks.py save-summary "<id>" "<summary>"
uv run python people_tasks.py status                 # People extraction status
uv run python -m scraper.scrape_to_db -n 5           # Scrape last N videos per channel
uv run python -m scraper.summarize                   # Generate AI summaries
```

### Database (Supabase)
```bash
cd packages/api
npm run db:migrate           # Push migrations to Supabase
npm run db:migrate:new       # Create new migration file
npm run db:generate-types    # Regenerate database.ts from schema
npm run deploy:functions     # Deploy Edge Functions
```

### Trigger.dev
```bash
cd packages/trigger
npm run dev      # Local dev with Trigger.dev CLI
npm run deploy   # Deploy tasks to Trigger.dev cloud
```

### E2E Tests
```bash
cd packages/e2e
npm test                    # Run all Playwright tests (auto-starts web dev server)
npx playwright test <file>  # Run a single test file
```

## Architecture

### Data Flow
1. **Ingestion**: Scraper (Python) or Trigger.dev task discovers videos from YouTube channels listed in `packages/scraper/channels.json`
2. **Enrichment**: Transcripts fetched via Supadata API, then AI generates summaries (OpenAI or Anthropic)
3. **People extraction**: AI identifies hosts/guests from video metadata, links to Wikipedia
4. **Storage**: Everything stored in Supabase (Postgres with RLS)
5. **Delivery**: Server sends daily/weekly email digests via Resend (Vercel cron triggers `/api/digest/send`)
6. **Frontend**: SPA reads directly from Supabase (client SDK with RLS), hits the server only for AI chat

### Auth Pattern
- Supabase Auth (Google OAuth) in the frontend
- Frontend uses `supabase-js` with the publishable key (RLS enforces row-level access)
- Server receives the user's JWT in `Authorization` header, creates a per-request Supabase client to validate it
- Edge Functions (Stripe) use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS

### Two Hono Servers
- **`packages/server`**: The main API — AI chat streaming, threads, email digest processing, channel management. Runs locally on :3001, deployed to Vercel as a serverless function. The Vercel entry point is `api/index.ts` which imports from `dist/` (compiled).
- **`packages/api`**: Lightweight server for local dev/testing against Supabase. Mainly houses migrations and Edge Functions. Not deployed as a standalone service.

### Web Frontend Conventions
- Uses `@` path alias mapped to `src/` (configured in `vite.config.ts`)
- UI components from shadcn/ui (new-york style) in `src/components/ui/`
- PostHog analytics with manual pageview capture (auto-capture disabled). Feature flags use UPPERCASE_WITH_UNDERSCORE enums. Consult existing naming before creating new events.
- Supabase client in `src/lib/supabase.ts`, auth context in `src/lib/auth.tsx`
- Routes defined in `src/main.tsx` — public routes (landing, terms, privacy, weekly-digest) and protected routes wrapped in `ProtectedRoute`

### Database Schema (key tables)
- `sources` — YouTube channels
- `videos` — Videos with transcript, summary, metadata
- `people` / `source_people` / `video_people` — Hosts and guests linked to channels/videos
- `profiles` — User profiles (created on auth signup)
- `ai_queries` — Tracks per-user AI chat usage for monthly rate limiting
- `notifications` — User notifications (realtime enabled)
- `digests` — Weekly digest content
- `categories` / `source_categories` — Channel categorization

Migrations live in `packages/api/supabase/migrations/`. Regenerate TypeScript types with `npm run db:generate-types` after schema changes.

### Trigger.dev v4
Uses `@trigger.dev/sdk` (v4), never the deprecated `client.defineJob` (v2). The `process-channel` task filters videos to >= 20 minutes, processes max 10 per channel. `triggerAndWait()` returns a `Result` object — always check `result.ok` before accessing `result.output`. Never wrap `triggerAndWait` or `wait.*` calls in `Promise.all`.

### Scraper CLI (`video_tasks.py`)
The `full-sync` skill runs the complete pipeline: `sync-new` → `status` → `fetch-all-transcripts` → generate summaries one at a time. Summaries must be processed ONE AT A TIME to prevent context bleed between transcripts.

### Environment Variables
Each package has a `.env.example`. The scraper uses `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPADATA_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`. The server needs AI provider keys and `RESEND_API_KEY` for email digests. The web frontend uses `VITE_`-prefixed vars.

### Summary Format
Summaries use bold (`**Summary:**`) not markdown headers (`## Summary`) — headers render too large in the UI. Structure: Summary → Key Points → Notable Quotes → Actionable Insights. Length scales with video duration.
