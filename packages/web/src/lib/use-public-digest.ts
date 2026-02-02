import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export interface PublicDigestVideo {
  video_id: string;
  video_title: string;
  video_thumbnail_url: string | null;
  video_duration_seconds: number | null;
  video_published_at: string | null;
  video_summary: string | null;
  source_id: string;
  source_name: string;
  source_thumbnail_url: string | null;
}

interface VideoWithSource {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  summary: string | null;
  source_id: string;
  source: {
    id: string;
    name: string;
    thumbnail_url: string | null;
  } | null;
}


function transformVideo(video: VideoWithSource): PublicDigestVideo {
  return {
    video_id: video.id,
    video_title: video.title,
    video_thumbnail_url: video.thumbnail_url,
    video_duration_seconds: video.duration_seconds,
    video_published_at: video.published_at,
    video_summary: video.summary,
    source_id: video.source_id,
    source_name: video.source?.name || "Unknown",
    source_thumbnail_url: video.source?.thumbnail_url || null,
  };
}

export function usePublicDigest(limit: number = 6) {
  const [videos, setVideos] = useState<PublicDigestVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the latest videos with summaries, regardless of date
      const { data, error: fetchError } = await supabase
        .from("videos")
        .select(`
          id,
          title,
          thumbnail_url,
          duration_seconds,
          published_at,
          summary,
          source_id,
          source:sources(id, name, thumbnail_url)
        `)
        .not("thumbnail_url", "is", null)
        .not("summary", "is", null) // Only show videos with summaries
        .order("published_at", { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      const transformed = (data || []).map((v) => {
        const video = {
          ...v,
          source: Array.isArray(v.source) ? v.source[0] : v.source,
        } as VideoWithSource;
        return transformVideo(video);
      });

      setVideos(transformed);
    } catch (err) {
      console.error("Error fetching public digest:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch digest");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  return {
    videos,
    loading,
    error,
    refetch: fetchDigest,
  };
}
