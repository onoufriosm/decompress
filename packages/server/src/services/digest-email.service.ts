import { render } from "@react-email/components";
import { supabaseAdmin } from "../lib/supabase.js";
import { resend, RESEND_FROM_EMAIL, RESEND_FROM_NAME } from "../lib/resend.js";
import {
  DailyDigestEmail,
  type ChannelGroup,
  type DigestVideo,
} from "../emails/daily-digest.js";

interface DigestUser {
  user_id: string;
  email: string;
  last_digest_sent_at: string | null;
}

interface DigestVideoRow {
  video_id: string;
  video_title: string;
  video_description: string | null;
  video_thumbnail_url: string | null;
  video_duration_seconds: number | null;
  video_published_at: string;
  video_summary: string | null;
  video_view_count: number | null;
  source_id: string;
  source_name: string;
  source_thumbnail_url: string | null;
}

function groupVideosByChannel(videos: DigestVideoRow[]): ChannelGroup[] {
  const grouped = videos.reduce(
    (acc, video) => {
      const sourceId = video.source_id;
      if (!acc[sourceId]) {
        acc[sourceId] = {
          source_id: video.source_id,
          source_name: video.source_name,
          source_thumbnail_url: video.source_thumbnail_url,
          videos: [],
        };
      }
      acc[sourceId].videos.push({
        video_id: video.video_id,
        video_title: video.video_title,
        video_summary: video.video_summary,
        video_thumbnail_url: video.video_thumbnail_url,
        video_duration_seconds: video.video_duration_seconds,
        video_published_at: video.video_published_at,
      });
      return acc;
    },
    {} as Record<string, ChannelGroup>
  );

  return Object.values(grouped);
}

async function logDigestEmail(
  userId: string,
  email: string,
  videoCount: number,
  channelCount: number,
  status: "sent" | "failed",
  errorMessage?: string,
  resendEmailId?: string
) {
  await supabaseAdmin.from("digest_email_logs").insert({
    user_id: userId,
    recipient_email: email,
    video_count: videoCount,
    channel_count: channelCount,
    status,
    error_message: errorMessage || null,
    resend_email_id: resendEmailId || null,
  });
}

async function updateLastDigestSent(userId: string) {
  await supabaseAdmin.rpc("update_last_digest_sent", {
    check_user_id: userId,
  });
}

export async function sendDigestToUser(user: DigestUser): Promise<{
  success: boolean;
  videoCount: number;
  error?: string;
}> {
  const baseUrl = process.env.APP_URL || "https://decompress.app";

  // 1. Fetch videos for this user (last 24 hours from favorited channels)
  const { data: videos, error: videosError } = await supabaseAdmin.rpc(
    "get_digest_videos",
    { check_user_id: user.user_id, hours_back: 24 }
  );

  if (videosError) {
    console.error(`Error fetching videos for user ${user.user_id}:`, videosError);
    return { success: false, videoCount: 0, error: videosError.message };
  }

  if (!videos || videos.length === 0) {
    // No videos = skip, not an error
    return { success: true, videoCount: 0 };
  }

  // 2. Group videos by channel
  const channelGroups = groupVideosByChannel(videos as DigestVideoRow[]);
  const summaryCount = (videos as DigestVideoRow[]).filter(
    (v) => v.video_summary
  ).length;

  // 3. Render email template
  const emailHtml = await render(
    DailyDigestEmail({
      channelGroups,
      totalVideos: videos.length,
      summaryCount,
      baseUrl,
    })
  );

  // 4. Send via Resend
  if (!resend) {
    console.warn("Resend not configured, skipping email send");
    return {
      success: false,
      videoCount: videos.length,
      error: "Resend not configured",
    };
  }

  const { data, error } = await resend.emails.send({
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
    to: user.email,
    subject: `${videos.length} new video${videos.length === 1 ? "" : "s"} from your channels`,
    html: emailHtml,
  });

  if (error) {
    console.error(`Error sending digest to ${user.email}:`, error);
    await logDigestEmail(
      user.user_id,
      user.email,
      videos.length,
      channelGroups.length,
      "failed",
      error.message
    );
    return { success: false, videoCount: videos.length, error: error.message };
  }

  // 5. Log success and update last_digest_sent_at
  await logDigestEmail(
    user.user_id,
    user.email,
    videos.length,
    channelGroups.length,
    "sent",
    undefined,
    data?.id
  );
  await updateLastDigestSent(user.user_id);

  console.log(`Sent digest to ${user.email}: ${videos.length} videos`);
  return { success: true, videoCount: videos.length };
}

export async function processAllDigests(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  // 1. Get eligible users
  const { data: users, error } = await supabaseAdmin.rpc("get_users_for_digest");

  if (error) {
    console.error("Error fetching users for digest:", error);
    return {
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [error.message],
    };
  }

  if (!users || users.length === 0) {
    console.log("No users eligible for digest");
    return { processed: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
  }

  console.log(`Processing digests for ${users.length} users`);

  const results = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  // 2. Process in batches to respect Resend rate limits
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 1000;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (user: DigestUser) => {
        results.processed++;

        const result = await sendDigestToUser(user);

        if (result.videoCount === 0) {
          results.skipped++;
        } else if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          if (result.error) {
            results.errors.push(`${user.email}: ${result.error}`);
          }
        }
      })
    );

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < users.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log(
    `Digest processing complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`
  );

  return results;
}
