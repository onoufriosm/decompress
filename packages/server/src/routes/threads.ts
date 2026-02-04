import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types/hono.js";

const threads = new Hono<AppEnv>();

// Schema for creating a thread
const createThreadSchema = z.object({
  title: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
});

// Schema for updating a thread
const updateThreadSchema = z.object({
  title: z.string().min(1),
});

// Schema for adding a message
const addMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

// GET /threads - List user's threads (optionally filtered by videoId)
threads.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const videoId = c.req.query("videoId");

  // If filtering by video, first get thread IDs that have this video
  let threadIdsToFilter: string[] | null = null;
  if (videoId) {
    const { data: threadVideos } = await supabaseAdmin
      .from("chat_thread_videos")
      .select("thread_id")
      .eq("video_id", videoId);

    if (!threadVideos || threadVideos.length === 0) {
      return c.json([]); // No threads for this video
    }
    threadIdsToFilter = threadVideos.map((tv) => tv.thread_id);
  }

  let query = supabaseAdmin
    .from("chat_threads")
    .select(`
      id,
      title,
      created_at,
      updated_at,
      chat_thread_videos(video_id)
    `)
    .eq("user_id", user.id);

  // Apply video filter if provided
  if (threadIdsToFilter) {
    query = query.in("id", threadIdsToFilter);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    return c.json({ error: "Failed to fetch threads" }, 500);
  }

  // Transform to include video count
  const transformed = (data || []).map((t) => ({
    id: t.id,
    title: t.title,
    created_at: t.created_at,
    updated_at: t.updated_at,
    video_count: t.chat_thread_videos?.length || 0,
  }));

  return c.json(transformed);
});

// POST /threads - Create a new thread
threads.post("/", requireAuth, zValidator("json", createThreadSchema), async (c) => {
  const user = c.get("user");
  const { title, videoIds } = c.req.valid("json");

  // Create the thread
  const { data: thread, error: threadError } = await supabaseAdmin
    .from("chat_threads")
    .insert({
      user_id: user.id,
      title: title || "New Chat",
    })
    .select()
    .single();

  if (threadError || !thread) {
    return c.json({ error: "Failed to create thread" }, 500);
  }

  // Add videos if provided
  if (videoIds && videoIds.length > 0) {
    const videoInserts = videoIds.map((videoId) => ({
      thread_id: thread.id,
      video_id: videoId,
    }));

    await supabaseAdmin.from("chat_thread_videos").insert(videoInserts);
  }

  return c.json(thread, 201);
});

// GET /threads/:id - Get a specific thread with messages
threads.get("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const threadId = c.req.param("id");

  // Get thread
  const { data: thread, error: threadError } = await supabaseAdmin
    .from("chat_threads")
    .select(`
      id,
      title,
      created_at,
      updated_at
    `)
    .eq("id", threadId)
    .eq("user_id", user.id)
    .single();

  if (threadError || !thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Get messages
  const { data: messages } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  // Get associated videos
  const { data: threadVideos } = await supabaseAdmin
    .from("chat_thread_videos")
    .select(`
      video_id,
      video:videos(id, title, source:sources(name))
    `)
    .eq("thread_id", threadId);

  const videos = (threadVideos || []).map((tv) => {
    const video = Array.isArray(tv.video) ? tv.video[0] : tv.video;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = (video as any)?.source;
    const sourceName = Array.isArray(source) ? source[0]?.name : source?.name;
    return {
      id: tv.video_id,
      title: (video as { title?: string })?.title || "Unknown",
      source_name: sourceName || "Unknown",
    };
  });

  return c.json({
    ...thread,
    messages: messages || [],
    videos,
    video_ids: (threadVideos || []).map((tv) => tv.video_id),
  });
});

// PATCH /threads/:id - Update thread title
threads.patch("/:id", requireAuth, zValidator("json", updateThreadSchema), async (c) => {
  const user = c.get("user");
  const threadId = c.req.param("id");
  const { title } = c.req.valid("json");

  const { data, error } = await supabaseAdmin
    .from("chat_threads")
    .update({ title })
    .eq("id", threadId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return c.json({ error: "Thread not found or update failed" }, 404);
  }

  return c.json(data);
});

// DELETE /threads/:id - Delete a thread
threads.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user");
  const threadId = c.req.param("id");

  const { error } = await supabaseAdmin
    .from("chat_threads")
    .delete()
    .eq("id", threadId)
    .eq("user_id", user.id);

  if (error) {
    return c.json({ error: "Failed to delete thread" }, 500);
  }

  return c.json({ success: true });
});

// POST /threads/:id/messages - Add a message to a thread
threads.post("/:id/messages", requireAuth, zValidator("json", addMessageSchema), async (c) => {
  const user = c.get("user");
  const threadId = c.req.param("id");
  const { role, content } = c.req.valid("json");

  // Verify thread belongs to user
  const { data: thread } = await supabaseAdmin
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .single();

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Add message
  const { data: message, error } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      role,
      content,
    })
    .select()
    .single();

  if (error || !message) {
    return c.json({ error: "Failed to add message" }, 500);
  }

  return c.json(message, 201);
});

// PUT /threads/:id/videos - Update videos associated with a thread
threads.put("/:id/videos", requireAuth, zValidator("json", z.object({ videoIds: z.array(z.string()) })), async (c) => {
  const user = c.get("user");
  const threadId = c.req.param("id");
  const { videoIds } = c.req.valid("json");

  // Verify thread belongs to user
  const { data: thread } = await supabaseAdmin
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .single();

  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Delete existing video associations
  await supabaseAdmin
    .from("chat_thread_videos")
    .delete()
    .eq("thread_id", threadId);

  // Add new video associations
  if (videoIds.length > 0) {
    const videoInserts = videoIds.map((videoId) => ({
      thread_id: threadId,
      video_id: videoId,
    }));

    await supabaseAdmin.from("chat_thread_videos").insert(videoInserts);
  }

  return c.json({ success: true });
});

export default threads;
