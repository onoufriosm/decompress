import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth, type AuthUser } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { resend, RESEND_FROM_EMAIL, RESEND_FROM_NAME } from "../lib/resend.js";

const channels = new Hono();

const requestChannelSchema = z.object({
  channelInput: z.string().min(1).max(500),
});

// POST /api/channels/request - Submit a channel request
channels.post(
  "/request",
  requireAuth,
  zValidator("json", requestChannelSchema),
  async (c) => {
    const user = c.get("user") as AuthUser;
    const { channelInput } = c.req.valid("json");

    // Insert the request
    const { data: request, error } = await supabaseAdmin
      .from("channel_requests")
      .insert({
        user_id: user.id,
        channel_input: channelInput,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating channel request:", error);
      return c.json({ error: "Failed to create request" }, 500);
    }

    // Send email notification
    const adminEmail = process.env.ADMIN_EMAIL;
    if (resend && adminEmail) {
      try {
        await resend.emails.send({
          from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
          to: adminEmail,
          subject: `Channel request`,
          html: `
            <p><strong>User:</strong> ${user.email}</p>
            <p><strong>Input:</strong> ${channelInput}</p>
            <p><strong>Request ID:</strong> ${request.id}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          `,
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn("Email notification skipped - RESEND or ADMIN_EMAIL not configured");
    }

    return c.json({
      success: true,
      request: {
        id: request.id,
        channel_input: request.channel_input,
        status: request.status,
      },
    });
  }
);

export default channels;
