import { Hono } from "hono";
import { timingSafeEqual } from "crypto";
import { processAllDigests, type DigestFrequency } from "../services/digest-email.service.js";

const digest = new Hono();

// GET /api/digest/send - Trigger digest processing (for Vercel cron)
// Protected by CRON_SECRET
// Query params:
//   - frequency: "daily" (default) or "weekly"
digest.get("/send", async (c) => {
  const authHeader = c.req.header("Authorization");
  const expectedCronSecret = process.env.CRON_SECRET;

  // Fail if CRON_SECRET not configured
  if (!expectedCronSecret) {
    console.error("CRON_SECRET environment variable not configured");
    return c.json({ error: "Server configuration error" }, 500);
  }

  // Use timing-safe comparison to prevent timing attacks
  const expectedAuth = `Bearer ${expectedCronSecret}`;
  const isValidCronSecret =
    authHeader &&
    authHeader.length === expectedAuth.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));

  if (!isValidCronSecret) {
    console.warn("Unauthorized digest trigger attempt");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const frequencyParam = c.req.query("frequency");
  const frequency: DigestFrequency =
    frequencyParam === "weekly" ? "weekly" : "daily";

  console.log(`Digest cron triggered: frequency=${frequency}`);

  const results = await processAllDigests(frequency);

  return c.json({
    success: true,
    frequency,
    stats: results,
  });
});

export default digest;
