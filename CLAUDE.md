# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decompress is a tool that reduces information overload from podcasts and video content. Users subscribe to YouTube channels, get AI-generated summaries, daily/weekly digests, and can chat with video transcripts using AI.

## Repository Structure

This is a monorepo with independent packages (no workspace manager — each package has its own `package-lock.json`):

- **`packages/web`** — React 19 SPA (Vite + Tailwind CSS v4 + shadcn/ui). Auth via Supabase magic links. Analytics via PostHog.
- **`packages/server`** — Hono API server deployed to Vercel as a serverless function. Handles AI chat (streaming via Vercel AI SDK v6), digest email sending, chat threads, and channel requests. The Vercel entry point is `api/index.ts` which imports from `dist/` (compiled output).
- **`packages/api`** — Supabase project: database migrations, Edge Functions (Deno runtime for Stripe webhooks and checkout), and deploy tooling.
- **`packages/trigger`** — Trigger.dev v4 background jobs for processing channels (fetch metadata, transcripts, generate summaries).
- **`packages/scraper`** — Python (requires Python 3.13+, managed with `uv`) scraper using yt-dlp. Handles video ingestion, transcript fetching (via Supadata API), AI summarization, and people extraction.
- **`packages/e2e`** — Playwright end-to-end tests.

## Build & Dev Commands

Each package is operated independently from its own directory.

### Web (frontend)
```bash
cd packages/web
npm install
npm run dev          # Vite dev server on :5173
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
```

### Server (API)
```bash
cd packages/server
npm install
npm run dev          # tsx watch on :3001
npm run build        # tsc (compiles to dist/)
```

### Scraper (Python)
```bash
cd packages/scraper
uv sync                                          # Install deps
uv run python -m scraper.scrape_to_db -n 5       # Scrape 5 videos per channel
uv run python -m scraper.summarize               # Generate AI summaries
uv run python -m scraper.extract_people --channels  # Extract hosts
uv run python -m scraper.transcript -n 10        # Fetch transcripts standalone
```

### Trigger.dev (background jobs)
```bash
cd packages/trigger
npm install
npx trigger.dev@latest dev      # Local dev
npx trigger.dev@latest deploy   # Deploy to Trigger.dev cloud
```

### Supabase (database & edge functions)
```bash
cd packages/api
npm install
npm run db:migrate               # Push migrations
npm run deploy                   # Full deploy (migrations + functions + types)
npm run deploy:function <name>   # Deploy single edge function
npm run db:generate-types        # Regenerate TypeScript types from DB
```

### E2E Tests
```bash
cd packages/e2e
npm install
npx playwright test              # Run all tests
npx playwright test tests/chat.spec.ts  # Run single test file
npx playwright test --headed     # Run with browser visible
```

## Architecture

### Data Flow

1. **Ingestion**: The Python scraper (or Trigger.dev job) fetches YouTube channel videos, transcripts, and metadata, writing directly to Supabase using the service role key (bypasses RLS).
2. **Enrichment**: AI summarization (OpenAI or Anthropic) runs over transcripts. People extraction identifies hosts/guests from video descriptions.
3. **Serving**: The web frontend reads directly from Supabase (public read via RLS policies). Authenticated features (chat, threads, digests) go through the Hono server.
4. **Digests**: Vercel cron triggers `GET /api/digest/send` (daily at 8am UTC, weekly on Sundays). The server compiles and sends digest emails via Resend.

### Database

Supabase (Postgres). Migrations live in `packages/api/supabase/migrations/` numbered sequentially (`00001_`, `00002_`, etc.). Core tables: `sources` (channels), `videos`, `people`, `source_people`, `video_people`, `tags`, `subscriptions`, `chat_threads`, `chat_messages`, `ai_queries`, `digests`, `channel_requests`.

All content tables have public read RLS policies. Write operations use the service role key to bypass RLS.

### Auth

Supabase Auth with magic link (OTP) sign-in. The web app's `AuthProvider` (`packages/web/src/lib/auth.tsx`) wraps the app. The server validates JWTs via `requireAuth` middleware (`packages/server/src/middleware/auth.ts`). Test mode bypass is available in development via `VITE_TEST_MODE=true`.

### AI Chat

The server uses Vercel AI SDK v6 with streaming (`createUIMessageStream`). Supports Anthropic (default), OpenAI, and Google as providers — configured via `AI_PROVIDER` and `AI_MODEL` env vars. Monthly query limit of 200 per user, tracked in `ai_queries` table.

### Payments

Stripe integration via Supabase Edge Functions (Deno). `stripe-webhook` handles subscription lifecycle events. `create-checkout-session` and `create-portal-session` manage the checkout flow.

### Deployment

- **Web**: Likely Vercel (Vite SPA)
- **Server**: Vercel serverless (`vercel.json` with rewrites and cron config)
- **Edge Functions**: Supabase (Deno runtime, deployed via `supabase functions deploy`)
- **Trigger.dev**: Trigger.dev cloud

## Key Conventions

- The web app uses `@` path alias mapping to `src/` (configured in `vite.config.ts` and `vitest.config.ts`).
- UI components use shadcn/ui pattern — primitives in `packages/web/src/components/ui/`, composed in feature components.
- Server routes are Hono routers mounted at `/api/<route>` in `packages/server/src/index.ts`.
- Supabase Edge Functions use Deno imports (`https://deno.land/`, `https://esm.sh/`).
- Trigger.dev tasks must use `@trigger.dev/sdk` v4 (`task()` / `schemaTask()`), never the deprecated v2 `client.defineJob` pattern.
- The scraper's `channels.json` defines which channels to scrape. Use `--single @handle` for ad-hoc channel scraping.
- Generated types from Supabase are output to both `packages/api/src/types/database.ts` and `packages/api/supabase/functions/_shared/database.types.ts`.

## Environment Variables

### Server (`packages/server`)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `CORS_ORIGIN`, `RESEND_API_KEY`, `ADMIN_EMAIL`, `CRON_SECRET`

### Web (`packages/web`)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL`, `VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST`, `VITE_STRIPE_PUBLISHABLE_KEY`

### Scraper (`packages/scraper`)
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPADATA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

### API/Supabase (`packages/api`)
`SUPABASE_PROJECT_REF`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
