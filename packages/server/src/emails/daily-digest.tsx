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

function truncateSummary(summary: string | null, maxLength = 150): string {
  if (!summary) return "";
  if (summary.length <= maxLength) return summary;
  return summary.substring(0, maxLength).trim() + "...";
}

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

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={h1}>Decompress</Heading>
            <Text style={subtitle}>Your {digestLabel} Digest</Text>
          </Section>

          {/* Stats */}
          <Section style={statsSection}>
            <Text style={statsText}>
              <strong>{totalVideos}</strong> new video
              {totalVideos === 1 ? "" : "s"}
              {summaryCount > 0 && (
                <>
                  {" "}
                  &bull; <strong>{summaryCount}</strong> with summar
                  {summaryCount === 1 ? "y" : "ies"}
                </>
              )}
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Videos by Channel */}
          {channelGroups.map((group) => (
            <Section key={group.source_id} style={channelSection}>
              {/* Channel Header */}
              <Row style={channelHeader}>
                {group.source_thumbnail_url && (
                  <Column style={channelThumbnailCol}>
                    <Img
                      src={group.source_thumbnail_url}
                      width="40"
                      height="40"
                      alt={group.source_name}
                      style={channelThumbnail}
                    />
                  </Column>
                )}
                <Column>
                  <Link
                    href={`${baseUrl}/channels/${group.source_id}`}
                    style={channelName}
                  >
                    {group.source_name}
                  </Link>
                  <Text style={videoCountText}>
                    {group.videos.length} video
                    {group.videos.length === 1 ? "" : "s"}
                  </Text>
                </Column>
              </Row>

              {/* Videos */}
              {group.videos.map((video) => (
                <Row key={video.video_id} style={videoRow}>
                  {video.video_thumbnail_url && (
                    <Column style={videoThumbnailCol}>
                      <Link href={`${baseUrl}/videos/${video.video_id}`}>
                        <Img
                          src={video.video_thumbnail_url}
                          width="120"
                          height="68"
                          alt={video.video_title}
                          style={videoThumbnail}
                        />
                      </Link>
                    </Column>
                  )}
                  <Column style={videoContent}>
                    <Link
                      href={`${baseUrl}/videos/${video.video_id}`}
                      style={videoTitle}
                    >
                      {video.video_title}
                    </Link>
                    {video.video_duration_seconds && (
                      <Text style={videoDuration}>
                        {formatDuration(video.video_duration_seconds)}
                      </Text>
                    )}
                    {video.video_summary && (
                      <Text style={videoSummary}>
                        {truncateSummary(video.video_summary)}
                      </Text>
                    )}
                  </Column>
                </Row>
              ))}

              <Hr style={channelDivider} />
            </Section>
          ))}

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={baseUrl} style={footerLink}>
                Open Decompress
              </Link>
            </Text>
            <Text style={unsubscribeText}>
              You're receiving this because you enabled {frequency} digests.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
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
