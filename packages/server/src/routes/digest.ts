import { Hono } from "hono";
import { processAllDigests } from "../services/digest-email.service.js";

const digest = new Hono();

// POST /api/digest/send - Trigger digest processing (for cron/scheduler)
// Protected by API key, not user auth
digest.post("/send", async (c) => {
  const authHeader = c.req.header("Authorization");
  const expectedKey = process.env.DIGEST_API_KEY;

  if (!expectedKey) {
    return c.json({ error: "DIGEST_API_KEY not configured" }, 500);
  }

  if (authHeader !== `Bearer ${expectedKey}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log("Starting digest processing...");

  const results = await processAllDigests();

  return c.json({
    success: true,
    stats: results,
  });
});

export default digest;
