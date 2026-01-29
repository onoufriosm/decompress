import "dotenv/config";
import { Hono } from "hono";
import { supabase } from "./lib/supabase.js";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ message: "Decompress API", version: "0.1.0" });
});

app.get("/health", async (c) => {
  // Test database connection
  const { error } = await supabase.from("sources").select("id").limit(1);

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine
    return c.json({ status: "unhealthy", error: error.message }, 500);
  }

  return c.json({ status: "healthy" });
});

const port = process.env.PORT || 3000;
console.log(`Server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
