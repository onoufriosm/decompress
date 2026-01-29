# Plan: User Channel Import with Progress Tracking

## Overview
Allow users to import YouTube channels via the web UI. When a user submits a channel URL/handle, the system scrapes the channel's videos, metadata, and transcripts in the background while showing real-time progress.

## Current Infrastructure

### What Exists
- **Scraper**: Full yt-dlp-based scraping in `packages/scraper/` with `scrape_to_db.py`
- **Scrape Logs**: `scrape_logs` table tracks scraping sessions (status, videos_found, etc.)
- **Realtime**: Supabase realtime subscriptions already used for notifications
- **Server**: Hono API server at `packages/server/` (port 3001)
- **UI Components**: Dialog, Progress, Input, Button all available

### What's Missing
- No user-facing "Add Channel" UI
- No API endpoint to trigger scraping
- No way to run Python scraper from Node.js server
- No user-specific job tracking

---

## Architecture Decision

**Option A: Server spawns Python subprocess**
- Server API receives request → spawns `python -m scraper.scrape_to_db`
- Pros: Simple, reuses existing scraper
- Cons: Long-running HTTP request, subprocess management complexity

**Option B: Database job queue + separate worker** ✅ RECOMMENDED
- Server API creates job record in database
- Separate Python worker polls for jobs and processes them
- Progress updates written to database → Supabase realtime to frontend
- Pros: Decoupled, scalable, resilient to restarts
- Cons: Requires new worker process

---

## Implementation Plan

### Phase 1: Database Schema

**Migration: `00011_channel_import_jobs.sql`**

```sql
-- Job queue for channel imports
CREATE TABLE channel_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_url TEXT NOT NULL,
    channel_handle TEXT,
    channel_name TEXT,
    source_id UUID REFERENCES sources(id),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending → processing → scraping_metadata → scraping_transcripts → completed/failed

    -- Progress metrics
    total_videos INTEGER DEFAULT 0,
    videos_processed INTEGER DEFAULT 0,
    transcripts_processed INTEGER DEFAULT 0,
    current_step TEXT,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_channel_import_jobs_user ON channel_import_jobs(user_id);
CREATE INDEX idx_channel_import_jobs_status ON channel_import_jobs(status);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE channel_import_jobs;

-- RLS policies
ALTER TABLE channel_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
    ON channel_import_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create jobs"
    ON channel_import_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

### Phase 2: Server API Endpoint

**File: `packages/server/src/routes/channels.ts`**

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthUser } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabase";

const channels = new Hono();

const importChannelSchema = z.object({
  channelUrl: z.string().min(1).refine(
    (url) => {
      // Accept: @handle, channel URL, or full YouTube URL
      return (
        url.startsWith("@") ||
        url.includes("youtube.com/") ||
        url.includes("youtu.be/")
      );
    },
    { message: "Must be a YouTube channel URL or @handle" }
  ),
});

// POST /api/channels/import - Create import job
channels.post(
  "/import",
  requireAuth,
  zValidator("json", importChannelSchema),
  async (c) => {
    const user = c.get("user") as AuthUser;
    const { channelUrl } = c.req.valid("json");

    // Normalize the channel URL/handle
    let normalizedUrl = channelUrl.trim();
    if (normalizedUrl.startsWith("@")) {
      normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
    }

    // Check for duplicate pending/processing jobs
    const { data: existingJob } = await supabaseAdmin
      .from("channel_import_jobs")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("channel_url", normalizedUrl)
      .in("status", ["pending", "processing", "scraping_metadata", "scraping_transcripts"])
      .single();

    if (existingJob) {
      return c.json({ error: "Import already in progress", jobId: existingJob.id }, 409);
    }

    // Create the import job
    const { data: job, error } = await supabaseAdmin
      .from("channel_import_jobs")
      .insert({
        user_id: user.id,
        channel_url: normalizedUrl,
      })
      .select()
      .single();

    if (error) {
      return c.json({ error: "Failed to create import job" }, 500);
    }

    return c.json({ jobId: job.id, status: job.status }, 201);
  }
);

// GET /api/channels/import/:jobId - Get job status
channels.get("/import/:jobId", requireAuth, async (c) => {
  const user = c.get("user") as AuthUser;
  const jobId = c.req.param("jobId");

  const { data: job, error } = await supabaseAdmin
    .from("channel_import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (error || !job) {
    return c.json({ error: "Job not found" }, 404);
  }

  return c.json(job);
});

// GET /api/channels/import - List user's jobs
channels.get("/import", requireAuth, async (c) => {
  const user = c.get("user") as AuthUser;

  const { data: jobs } = await supabaseAdmin
    .from("channel_import_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return c.json(jobs || []);
});

export { channels };
```

**Update `packages/server/src/index.ts`:**
```typescript
import { channels } from "./routes/channels";
// ...
app.route("/api/channels", channels);
```

### Phase 3: Python Worker

**File: `packages/scraper/src/scraper/import_worker.py`**

```python
"""Background worker that processes channel import jobs."""
import time
import signal
import sys
from datetime import datetime, timezone

from .db import get_client
from .channel import get_channel_video_ids, get_video_metadata, get_channel_metadata
from .transcript import get_transcript

# Graceful shutdown
shutdown_requested = False

def signal_handler(sig, frame):
    global shutdown_requested
    print("\nShutdown requested, finishing current job...")
    shutdown_requested = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def update_job(client, job_id: str, **kwargs):
    """Update job status and progress."""
    client.table("channel_import_jobs").update(kwargs).eq("id", job_id).execute()


def process_job(job: dict) -> None:
    """Process a single channel import job."""
    client = get_client()
    job_id = job["id"]
    channel_url = job["channel_url"]

    try:
        # Mark as processing
        update_job(client, job_id,
            status="processing",
            started_at=datetime.now(timezone.utc).isoformat(),
            current_step="Fetching channel info"
        )

        # Get channel metadata
        metadata = get_channel_metadata(channel_url)
        channel_name = metadata.get("name", "Unknown")
        channel_handle = metadata.get("channel_id")

        update_job(client, job_id,
            channel_name=channel_name,
            channel_handle=channel_handle,
            current_step="Fetching video list"
        )

        # Create or get source record
        source_result = client.table("sources").upsert({
            "external_id": metadata.get("channel_id"),
            "name": channel_name,
            "handle": channel_handle,
            "type": "youtube_channel",
            "description": metadata.get("description"),
            "thumbnail_url": metadata.get("thumbnail_url"),
            "subscriber_count": metadata.get("subscriber_count"),
        }, on_conflict="external_id").select().single().execute()

        source_id = source_result.data["id"]
        update_job(client, job_id, source_id=source_id)

        # Get video list
        videos = get_channel_video_ids(channel_url, limit=50)
        total_videos = len(videos)

        update_job(client, job_id,
            status="scraping_metadata",
            total_videos=total_videos,
            current_step=f"Scraping {total_videos} videos"
        )

        # Process each video
        for i, video in enumerate(videos):
            if shutdown_requested:
                update_job(client, job_id,
                    status="pending",  # Allow resume
                    current_step="Paused - will resume"
                )
                return

            # Fetch metadata
            video_metadata = get_video_metadata(video["url"])

            # Upsert video
            client.table("videos").upsert({
                "external_id": video["id"],
                "source_id": source_id,
                "title": video_metadata.get("title"),
                "description": video_metadata.get("description"),
                "thumbnail_url": video_metadata.get("thumbnail"),
                "duration_seconds": video_metadata.get("duration"),
                "published_at": video_metadata.get("upload_date"),
                "view_count": video_metadata.get("view_count"),
                "like_count": video_metadata.get("like_count"),
            }, on_conflict="external_id").execute()

            update_job(client, job_id,
                videos_processed=i + 1,
                current_step=f"Processed {i + 1}/{total_videos} videos"
            )

        # Fetch transcripts
        update_job(client, job_id,
            status="scraping_transcripts",
            current_step="Fetching transcripts"
        )

        videos_result = client.table("videos").select("id, external_id").eq("source_id", source_id).is_("transcript", None).execute()

        for i, video in enumerate(videos_result.data or []):
            if shutdown_requested:
                update_job(client, job_id,
                    status="pending",
                    current_step="Paused - will resume"
                )
                return

            try:
                transcript = get_transcript(video["external_id"])
                if transcript:
                    client.table("videos").update({"transcript": transcript}).eq("id", video["id"]).execute()
            except Exception as e:
                print(f"  Transcript error for {video['external_id']}: {e}")

            update_job(client, job_id,
                transcripts_processed=i + 1,
                current_step=f"Transcripts: {i + 1}/{len(videos_result.data)}"
            )

        # Complete
        update_job(client, job_id,
            status="completed",
            completed_at=datetime.now(timezone.utc).isoformat(),
            current_step="Import complete"
        )

    except Exception as e:
        update_job(client, job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
            error_message=str(e),
            current_step="Failed"
        )
        raise


def run_worker(poll_interval: int = 5):
    """Main worker loop - polls for pending jobs."""
    client = get_client()
    print(f"Import worker started. Polling every {poll_interval}s...")

    while not shutdown_requested:
        # Fetch next pending job
        result = client.table("channel_import_jobs").select("*").eq("status", "pending").order("created_at").limit(1).execute()

        if result.data:
            job = result.data[0]
            print(f"\nProcessing job {job['id']}: {job['channel_url']}")
            try:
                process_job(job)
                print(f"  Completed!")
            except Exception as e:
                print(f"  Failed: {e}")

        time.sleep(poll_interval)

    print("Worker stopped.")


if __name__ == "__main__":
    run_worker()
```

**Add to `pyproject.toml`:**
```toml
[project.scripts]
import-worker = "scraper.import_worker:run_worker"
```

### Phase 4: Frontend UI

**File: `packages/web/src/components/add-channel-dialog.tsx`**

```typescript
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Loader2, CheckCircle, XCircle } from "lucide-react";

interface ImportJob {
  id: string;
  status: string;
  channel_name: string | null;
  total_videos: number;
  videos_processed: number;
  transcripts_processed: number;
  current_step: string | null;
  error_message: string | null;
}

export function AddChannelDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [channelUrl, setChannelUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);

  // Subscribe to job updates via Supabase Realtime
  useEffect(() => {
    if (!activeJob || !user) return;

    const channel = supabase
      .channel(`import-job:${activeJob.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "channel_import_jobs",
          filter: `id=eq.${activeJob.id}`,
        },
        (payload) => {
          setActiveJob(payload.new as ImportJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJob?.id, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/channels/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ channelUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start import");
      }

      // Fetch the full job to start tracking
      const { data: job } = await supabase
        .from("channel_import_jobs")
        .select("*")
        .eq("id", data.jobId)
        .single();

      setActiveJob(job);
      setChannelUrl("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => {
    if (!activeJob || activeJob.total_videos === 0) return 0;

    if (activeJob.status === "scraping_transcripts") {
      // Metadata done (50%) + transcripts progress (50%)
      const transcriptProgress = activeJob.total_videos > 0
        ? (activeJob.transcripts_processed / activeJob.total_videos) * 50
        : 0;
      return 50 + transcriptProgress;
    }

    // Metadata progress (0-50%)
    return (activeJob.videos_processed / activeJob.total_videos) * 50;
  };

  const isComplete = activeJob?.status === "completed";
  const isFailed = activeJob?.status === "failed";
  const isProcessing = activeJob && !isComplete && !isFailed;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import YouTube Channel</DialogTitle>
          <DialogDescription>
            Enter a YouTube channel URL or @handle to import all videos.
          </DialogDescription>
        </DialogHeader>

        {!activeJob ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="@channelhandle or youtube.com/..."
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              disabled={loading}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || !channelUrl.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Import
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {isComplete && <CheckCircle className="h-5 w-5 text-green-500" />}
              {isFailed && <XCircle className="h-5 w-5 text-destructive" />}
              {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
              <span className="font-medium">
                {activeJob.channel_name || "Loading..."}
              </span>
            </div>

            <Progress value={getProgress()} />

            <p className="text-sm text-muted-foreground">
              {activeJob.current_step}
            </p>

            {activeJob.error_message && (
              <p className="text-sm text-destructive">{activeJob.error_message}</p>
            )}

            {isComplete && (
              <div className="text-sm">
                <p>Videos imported: {activeJob.videos_processed}</p>
                <p>Transcripts fetched: {activeJob.transcripts_processed}</p>
              </div>
            )}

            {(isComplete || isFailed) && (
              <Button
                variant="outline"
                onClick={() => {
                  setActiveJob(null);
                  if (isComplete) setOpen(false);
                }}
              >
                {isComplete ? "Done" : "Try Again"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Update `packages/web/src/routes/channels.tsx`:**
Add the dialog to the channels page header:
```typescript
import { AddChannelDialog } from "@/components/add-channel-dialog";

// In the component JSX, after the search input:
<div className="flex items-center gap-4 mb-4">
  <div className="relative flex-1 max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input ... />
  </div>
  <AddChannelDialog />
</div>
```

---

## Files to Create/Modify

**New Files:**
- `packages/api/supabase/migrations/00011_channel_import_jobs.sql`
- `packages/server/src/routes/channels.ts`
- `packages/scraper/src/scraper/import_worker.py`
- `packages/web/src/components/add-channel-dialog.tsx`

**Modify:**
- `packages/server/src/index.ts` - Add channels route
- `packages/scraper/pyproject.toml` - Add import-worker script
- `packages/web/src/routes/channels.tsx` - Add dialog button

---

## Running the System

1. **Start the worker (run locally/manually):**
   ```bash
   cd packages/scraper
   uv run python -m scraper.import_worker
   ```

2. **User flow:**
   - User clicks "Add Channel" on channels page
   - Enters `@triggerpod` or YouTube URL
   - Clicks "Start Import"
   - Sees real-time progress (videos scraped, transcripts fetched)
   - Channel appears in list when complete

---

## Verification

1. **Database:**
   - Run migration
   - Verify `channel_import_jobs` table exists
   - Check realtime is enabled: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`

2. **API:**
   - Start server: `cd packages/server && npm run dev`
   - Test endpoint: `curl -X POST http://localhost:3001/api/channels/import -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"channelUrl": "@triggerpod"}'`

3. **Worker:**
   - Start worker: `cd packages/scraper && uv run python -m scraper.import_worker`
   - Watch for job pickup and progress updates

4. **Frontend:**
   - Open channels page
   - Click "Add Channel"
   - Enter a channel handle
   - Watch progress bar update in real-time
   - Verify channel appears in list after completion

---

## Alternative: CLI-Only (Simpler)

If you don't want to run a background worker, you can continue using the existing CLI:

```bash
# Import a channel manually
uv run python -m scraper.scrape_to_db --single @channelhandle

# Or add to channels.json and run
uv run python -m scraper.scrape_to_db -c "Channel Name"
```

This keeps the current workflow where channels are imported by running CLI commands.
