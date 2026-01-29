// @ts-nocheck - URL imports require Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24";
import type { Database } from "../_shared/database.types.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token costs in USD (per 1M tokens)
const COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
};

const MONTHLY_LIMIT_USD = 4.0;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth user
    const supabaseClient = createClient<Database>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SECRET_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient<Database>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check subscription
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!subscription) {
      return new Response(JSON.stringify({ error: "Subscription required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check monthly usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usageData } = await supabaseAdmin
      .from("token_usage")
      .select("cost_usd")
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth.toISOString());

    const totalCost = usageData?.reduce((sum, u) => sum + Number(u.cost_usd), 0) || 0;

    if (totalCost >= MONTHLY_LIMIT_USD) {
      return new Response(JSON.stringify({ error: "Monthly AI budget exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, video_ids, message } = await req.json();

    // Fetch video transcripts - typed!
    let transcriptContext = "";
    if (video_ids?.length > 0) {
      const { data: videos } = await supabaseAdmin
        .from("videos")
        .select("title, transcript")
        .in("id", video_ids);

      if (videos) {
        transcriptContext = videos
          .filter((v) => v.transcript)
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

    // Call Claude
    const model = "claude-sonnet-4-20250514";
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user" as const, content: message }],
    });

    const assistantMessage = response.content[0].type === "text"
      ? response.content[0].text
      : "";

    // Calculate cost
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = COSTS[model];
    const costUsd = (inputTokens / 1_000_000) * cost.input + (outputTokens / 1_000_000) * cost.output;

    // Record usage - typed!
    await supabaseAdmin.from("token_usage").insert({
      user_id: user.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model,
      cost_usd: costUsd,
      request_type: "chat",
      conversation_id,
    });

    // Save messages if conversation exists - typed!
    if (conversation_id) {
      await supabaseAdmin.from("ai_messages").insert([
        { conversation_id, role: "user", content: message },
        { conversation_id, role: "assistant", content: assistantMessage },
      ]);
    }

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: costUsd,
          remaining_budget: MONTHLY_LIMIT_USD - totalCost - costUsd,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
