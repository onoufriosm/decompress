import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!supabasePublishableKey) {
  throw new Error("Missing SUPABASE_PUBLISHABLE_KEY environment variable");
}

// Client for public/authenticated user requests
export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey
);

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = supabaseSecretKey
  ? createClient<Database>(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export type { Database };
