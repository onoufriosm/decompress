import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from "@react-email/components";
import { marked } from "marked";

export interface DigestVideo {
  video_id: string;
  video_title: string;
  video_summary: string | null;
  video_thumbnail_url: string | null;
  video_duration_seconds: number | null;
  video_published_at: string;
}

export interface ChannelGroup {
  source_id: string;
  source_name: string;
  source_thumbnail_url: string | null;
  videos: DigestVideo[];
}

export type DigestFrequency = "daily" | "weekly";

export interface DailyDigestEmailProps {
  channelGroups: ChannelGroup[];
  totalVideos: number;
  summaryCount: number;
  baseUrl: string;
  frequency?: DigestFrequency;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Configure marked for email-safe HTML (no dangerous tags)
marked.setOptions({
  gfm: true,
  breaks: true,
});

function markdownToHtml(text: string): string {
  // Convert markdown to HTML, then strip paragraph tags for inline use
  const html = marked.parse(text, { async: false }) as string;
  // Remove wrapping <p> tags for cleaner inline display
  return html.replace(/^<p>|<\/p>$/g, "").trim();
}

function formatSummary(summary: string | null, frequency: DigestFrequency): string {
  if (!summary) return "";
  // Weekly digest: truncate to snippet
  // Daily digest: show full summary
  let text = summary;
  if (frequency === "weekly") {
    const maxLength = 150;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength).trim() + "...";
    }
  }
  // Convert markdown to HTML
  return markdownToHtml(text);
}

const e = React.createElement;

export function DailyDigestEmail({
  channelGroups,
  totalVideos,
  summaryCount,
  baseUrl,
  frequency = "daily",
}: DailyDigestEmailProps) {
  const periodLabel = frequency === "weekly" ? "this week" : "yesterday";
  const digestLabel = frequency === "weekly" ? "Weekly" : "Daily";
  const previewText = `${totalVideos} new video${totalVideos === 1 ? "" : "s"} ${periodLabel}`;

  return e(Html, null,
    e(Head, null),
    e(Preview, null, previewText),
    e(Body, { style: main },
      e(Container, { style: container },
        // Header
        e(Section, { style: header },
          e(Heading, { style: h1 }, "Decompress"),
          e(Text, { style: subtitle }, `Your ${digestLabel} Digest`)
        ),
        // Stats
        e(Section, { style: statsSection },
          e(Text, { style: statsText },
            e("strong", null, totalVideos),
            ` new video${totalVideos === 1 ? "" : "s"}`,
            summaryCount > 0 ? [
              " • ",
              e("strong", { key: "count" }, summaryCount),
              ` with summar${summaryCount === 1 ? "y" : "ies"}`
            ] : null
          )
        ),
        e(Hr, { style: divider }),
        // Videos by Channel
        channelGroups.map((group) =>
          e(Section, { key: group.source_id, style: channelSection },
            // Channel Header
            e(Row, { style: channelHeader, children: [
              group.source_thumbnail_url ? e(Column, { key: "thumb", style: channelThumbnailCol },
                e(Img, {
                  src: group.source_thumbnail_url,
                  width: "40",
                  height: "40",
                  alt: group.source_name,
                  style: channelThumbnail
                })
              ) : null,
              e(Column, { key: "info" },
                e(Link, { href: `${baseUrl}/channels/${group.source_id}`, style: channelName },
                  group.source_name
                ),
                e(Text, { style: videoCountText },
                  `${group.videos.length} video${group.videos.length === 1 ? "" : "s"}`
                )
              )
            ]}),
            // Videos
            group.videos.map((video) =>
              e(Row, { key: video.video_id, style: videoRow, children: [
                video.video_thumbnail_url ? e(Column, { key: "thumb", style: videoThumbnailCol },
                  e(Link, { href: `${baseUrl}/videos/${video.video_id}` },
                    e(Img, {
                      src: video.video_thumbnail_url,
                      width: "120",
                      height: "68",
                      alt: video.video_title,
                      style: videoThumbnail
                    })
                  )
                ) : null,
                e(Column, { key: "content", style: videoContent },
                  e(Link, { href: `${baseUrl}/videos/${video.video_id}`, style: videoTitle },
                    video.video_title
                  ),
                  video.video_duration_seconds ? e(Text, { style: videoDuration },
                    formatDuration(video.video_duration_seconds)
                  ) : null,
                  video.video_summary ? e("div", {
                    style: videoSummary,
                    dangerouslySetInnerHTML: { __html: formatSummary(video.video_summary, frequency) }
                  }) : null
                )
              ]}
            )),
            e(Hr, { style: channelDivider })
          )
        ),
        // Footer
        e(Section, { style: footer },
          e(Text, { style: footerText },
            e(Link, { href: baseUrl, style: footerLink }, "Open Decompress")
          ),
          e(Text, { style: unsubscribeText },
            `You're receiving this because you enabled ${frequency} digests.`
          )
        )
      )
    )
  );
}

export default DailyDigestEmail;

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "24px 32px",
  textAlign: "center" as const,
};

const h1 = {
  color: "#1a1a1a",
  fontSize: "28px",
  fontWeight: "700",
  margin: "0 0 8px",
  padding: "0",
};

const subtitle = {
  color: "#666666",
  fontSize: "16px",
  margin: "0",
};

const statsSection = {
  padding: "0 32px",
  textAlign: "center" as const,
};

const statsText = {
  color: "#1a1a1a",
  fontSize: "16px",
  margin: "0",
};

const divider = {
  borderColor: "#e6ebf1",
  margin: "24px 32px",
};

const channelSection = {
  padding: "0 32px",
};

const channelHeader = {
  marginBottom: "16px",
};

const channelThumbnailCol = {
  width: "48px",
  verticalAlign: "middle" as const,
};

const channelThumbnail = {
  borderRadius: "50%",
};

const channelName = {
  color: "#1a1a1a",
  fontSize: "18px",
  fontWeight: "600",
  textDecoration: "none",
};

const videoCountText = {
  color: "#666666",
  fontSize: "14px",
  margin: "4px 0 0",
};

const videoRow = {
  marginBottom: "16px",
};

const videoThumbnailCol = {
  width: "128px",
  verticalAlign: "top" as const,
  paddingRight: "12px",
};

const videoThumbnail = {
  borderRadius: "4px",
};

const videoContent = {
  verticalAlign: "top" as const,
};

const videoTitle = {
  color: "#1a1a1a",
  fontSize: "15px",
  fontWeight: "500",
  textDecoration: "none",
  lineHeight: "1.4",
  display: "block",
};

const videoDuration = {
  color: "#666666",
  fontSize: "13px",
  margin: "4px 0",
};

const videoSummary = {
  color: "#4a4a4a",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "8px 0 0",
};

const channelDivider = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const footer = {
  padding: "0 32px",
  textAlign: "center" as const,
};

const footerText = {
  margin: "0 0 8px",
};

const footerLink = {
  color: "#5469d4",
  fontSize: "14px",
  textDecoration: "none",
};

const unsubscribeText = {
  color: "#8898aa",
  fontSize: "12px",
  margin: "16px 0 0",
};
