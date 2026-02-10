import type { Context, Next } from "hono";
import { createUserClient, supabaseAdmin } from "../lib/supabase.js";
import { MONTHLY_QUERY_LIMIT } from "../lib/ai-providers.js";

export interface AuthUser {
  id: string;
  email: string | undefined;
}

export interface QueryUsage {
  queriesUsed: number;
  queriesRemaining: number;
  limitReached: boolean;
}

// Middleware to authenticate user (optional - allows anonymous)
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader) {
    const userClient = createUserClient(authHeader);
    if (userClient) {
      const {
        data: { user },
        error,
      } = await userClient.auth.getUser();

      if (!error && user) {
        c.set("user", { id: user.id, email: user.email } as AuthUser);
      }
    }
  }

  await next();
}

// Middleware to require authentication
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const userClient = createUserClient(authHeader);
  if (!userClient) {
    return c.json({ error: "Invalid authorization" }, 401);
  }

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", { id: user.id, email: user.email } as AuthUser);
  await next();
}

// Check user's query usage for the current month
export async function getQueryUsage(userId: string): Promise<QueryUsage> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from("ai_queries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    // Fail closed: deny access on database error rather than granting unlimited access
    console.error("Error fetching query usage:", error);
    return {
      queriesUsed: MONTHLY_QUERY_LIMIT,
      queriesRemaining: 0,
      limitReached: true,
    };
  }

  const queriesUsed = count || 0;
  const queriesRemaining = Math.max(0, MONTHLY_QUERY_LIMIT - queriesUsed);

  return {
    queriesUsed,
    queriesRemaining,
    limitReached: queriesRemaining <= 0,
  };
}

// Record a query
export async function recordQuery(
  userId: string,
  data: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    videoIds?: string[];
  }
) {
  const { error } = await supabaseAdmin.from("ai_queries").insert({
    user_id: userId,
    provider: data.provider,
    model: data.model,
    input_tokens: data.inputTokens || 0,
    output_tokens: data.outputTokens || 0,
    video_ids: data.videoIds || [],
  });

  if (error) {
    console.error("Error recording query:", error);
  }
}
