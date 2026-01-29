import { Hono } from "hono";
import { streamText, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  getModel,
  getProviderFromEnv,
  type AIProvider,
} from "../lib/ai-providers.js";
import { supabaseAdmin } from "../lib/supabase.js";
import {
  requireAuth,
  getQueryUsage,
  recordQuery,
  type AuthUser,
} from "../middleware/auth.js";

const chat = new Hono();

// Schema for chat request - supports both v5 (content string) and v6 (parts array) formats
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().optional(),
  parts: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
    })
  ).optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema),
  videoIds: z.array(z.string()).optional(),
  provider: z.enum(["anthropic", "openai", "google"]).optional(),
});

// Convert messages to standard format for AI SDK
function normalizeMessages(messages: z.infer<typeof messageSchema>[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.map((msg) => {
    // If content exists, use it directly
    if (msg.content) {
      return { role: msg.role, content: msg.content };
    }
    // If parts exist, extract text from text parts
    if (msg.parts) {
      const textContent = msg.parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("");
      return { role: msg.role, content: textContent };
    }
    return { role: msg.role, content: "" };
  });
}

// Get query usage for current user
chat.get("/usage", requireAuth, async (c) => {
  const user = c.get("user") as AuthUser;
  const usage = await getQueryUsage(user.id);

  return c.json(usage);
});

// Stream chat endpoint
chat.post("/", requireAuth, zValidator("json", chatRequestSchema), async (c) => {
  const user = c.get("user") as AuthUser;
  const { messages, videoIds, provider: requestedProvider } = c.req.valid("json");

  // Check query limit
  const usage = await getQueryUsage(user.id);
  if (usage.limitReached) {
    return c.json(
      {
        error: "Monthly query limit reached",
        queriesUsed: usage.queriesUsed,
        queriesRemaining: 0,
      },
      429
    );
  }

  // Get provider config
  const envConfig = getProviderFromEnv();
  const provider: AIProvider = requestedProvider || envConfig.provider;
  const model = getModel({
    provider,
    model: envConfig.model,
  });

  // Fetch video transcripts if video IDs provided
  let transcriptContext = "";
  console.log("Received videoIds:", videoIds);

  if (videoIds && videoIds.length > 0) {
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("videos")
      .select("title, transcript")
      .in("id", videoIds);

    console.log("Fetched videos:", videos?.length, "Error:", videosError);

    if (videos) {
      const withTranscripts = videos.filter((v) => v.transcript);
      console.log("Videos with transcripts:", withTranscripts.length);

      transcriptContext = withTranscripts
        .map((v) => `## Video: ${v.title}\n\n${v.transcript}`)
        .join("\n\n---\n\n");
    }
  }

  // Build system prompt
  const systemPrompt = transcriptContext
    ? `You are a helpful assistant that answers questions about video content. Use the following video transcripts to answer the user's questions. If the answer isn't in the transcripts, say so.

IMPORTANT: When answering questions, paraphrase and explain in your own words rather than quoting large portions of the transcript verbatim. You may use brief direct quotes (1-2 sentences) when they add value, but your responses should primarily be original explanations based on the content. Always attribute information to the video (e.g., "According to the video..." or "The speaker explains that...").

${transcriptContext}`
    : "You are a helpful assistant that answers questions about video content.";

  // Normalize messages to standard format
  const normalizedMessages = normalizeMessages(messages);

  // Stream the response
  const result = streamText({
    model,
    system: systemPrompt,
    messages: normalizedMessages,
    maxOutputTokens: 1024,
    onFinish: async ({ usage: tokenUsage }) => {
      // Record the query after completion
      await recordQuery(user.id, {
        provider,
        model: envConfig.model,
        inputTokens: tokenUsage.promptTokens,
        outputTokens: tokenUsage.completionTokens,
        videoIds,
      });
    },
  });

  // Return streaming response using AI SDK v6 UIMessageStream format
  const messageId = crypto.randomUUID();
  const textPartId = crypto.randomUUID();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Write message start
      writer.write({ type: "start", messageId });

      // Write text part start
      writer.write({ type: "text-start", id: textPartId });

      // Stream text chunks
      for await (const chunk of result.textStream) {
        writer.write({ type: "text-delta", id: textPartId, delta: chunk });
      }

      // Write text part end
      writer.write({ type: "text-end", id: textPartId });

      // Write finish
      writer.write({ type: "finish", finishReason: await result.finishReason });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "X-Queries-Remaining": String(usage.queriesRemaining - 1),
    },
  });
});

export default chat;
