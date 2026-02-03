import { Hono } from "hono";
import { processAllDigests, type DigestFrequency } from "../services/digest-email.service.js";

const digest = new Hono();

// POST /api/digest/send - Trigger digest processing (for cron/scheduler)
// Protected by API key or Vercel cron secret
// Query params:
//   - frequency: "daily" (default) or "weekly"
digest.get("/send", async (c) => {
  const authHeader = c.req.header("Authorization");
  const expectedCronSecret = process.env.CRON_SECRET;

  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const isValidCronSecret =
    expectedCronSecret && authHeader === `Bearer ${expectedCronSecret}`;

  if (!isValidCronSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const frequencyParam = c.req.query("frequency");
  const frequency: DigestFrequency =
    frequencyParam === "weekly" ? "weekly" : "daily";

  console.log(`Starting ${frequency} digest processing...`);

  const results = await processAllDigests(frequency);

  return c.json({
    success: true,
    frequency,
    stats: results,
  });
});

export default digest;
