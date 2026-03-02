import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface SourceData {
  externalId: string;
  handle: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
}

export interface VideoData {
  sourceId: string;
  externalId: string;
  url: string;
  title: string;
  description?: string;
  durationSeconds?: number;
  durationString?: string;
  thumbnailUrl?: string;
  uploadDate?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  transcript?: string;
  transcriptLanguage?: string;
  summary?: string;
}

export async function upsertSource(data: SourceData): Promise<string> {
  // Check if source already exists
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("type", "youtube_channel")
    .eq("external_id", data.externalId)
    .single();

  const now = new Date().toISOString();

  const record: Record<string, unknown> = {
    type: "youtube_channel",
    external_id: data.externalId,
    handle: data.handle,
    name: data.name,
    is_active: true,
    last_scraped_at: now,
  };

  if (data.description) record.description = data.description;
  if (data.thumbnailUrl) record.thumbnail_url = data.thumbnailUrl;
  if (data.bannerUrl) record.banner_url = data.bannerUrl;
  if (data.subscriberCount != null)
    record.subscriber_count = data.subscriberCount;
  if (data.videoCount != null) record.video_count = data.videoCount;

  if (existing) {
    const { error } = await supabase
      .from("sources")
      .update(record)
      .eq("id", existing.id);

    if (error) throw new Error(`Failed to update source: ${error.message}`);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("sources")
    .insert(record)
    .select("id")
    .single();

  if (error || !created)
    throw new Error(`Failed to create source: ${error?.message}`);
  return created.id;
}

export async function insertVideo(data: VideoData): Promise<void> {
  const now = new Date().toISOString();

  const record: Record<string, unknown> = {
    source_id: data.sourceId,
    external_id: data.externalId,
    url: data.url,
    title: data.title,
    metadata_scraped_at: now,
  };

  if (data.description != null) record.description = data.description;
  if (data.durationSeconds != null)
    record.duration_seconds = data.durationSeconds;
  if (data.durationString != null)
    record.duration_string = data.durationString;
  if (data.thumbnailUrl != null) record.thumbnail_url = data.thumbnailUrl;
  if (data.uploadDate != null) record.upload_date = data.uploadDate;
  if (data.publishedAt != null) record.published_at = data.publishedAt;
  if (data.viewCount != null) record.view_count = data.viewCount;
  if (data.likeCount != null) record.like_count = data.likeCount;
  if (data.commentCount != null) record.comment_count = data.commentCount;

  if (data.transcript) {
    record.transcript = data.transcript;
    record.has_transcript = true;
    record.transcript_scraped_at = now;
    record.transcript_language = data.transcriptLanguage || "en";
  }

  if (data.summary) {
    record.summary = data.summary;
    record.summary_generated_at = now;
  }

  const { error } = await supabase.from("videos").insert(record);

  if (error) throw new Error(`Failed to insert video: ${error.message}`);
}
