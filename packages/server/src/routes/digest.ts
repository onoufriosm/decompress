import { Hono } from "hono";
import { processAllDigests } from "../services/digest-email.service.js";

const digest = new Hono();

// POST /api/digest/send - Trigger digest processing (for cron/scheduler)
// Protected by API key or Vercel cron secret
digest.post("/send", async (c) => {
  const authHeader = c.req.header("Authorization");
  const vercelCronSecret = c.req.header("x-vercel-cron-secret");
  const expectedKey = process.env.DIGEST_API_KEY;
  const expectedCronSecret = process.env.CRON_SECRET;

  // Allow access if:
  // 1. Valid DIGEST_API_KEY in Authorization header, OR
  // 2. Valid CRON_SECRET from Vercel cron (set in Vercel dashboard)
  const isValidApiKey = expectedKey && authHeader === `Bearer ${expectedKey}`;
  const isValidCronSecret = expectedCronSecret && vercelCronSecret === expectedCronSecret;

  if (!isValidApiKey && !isValidCronSecret) {
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
