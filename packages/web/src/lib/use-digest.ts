import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { useFavorites } from "./use-favorites";

export type DigestPeriod = "day" | "week";

interface VideoWithSource {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  summary: string | null;
  view_count: number | null;
  source_id: string;
  source: {
    id: string;
    name: string;
    thumbnail_url: string | null;
  } | null;
}

export interface DigestVideo {
  video_id: string;
  video_title: string;
  video_description: string | null;
  video_thumbnail_url: string | null;
  video_duration_seconds: number | null;
  video_published_at: string | null;
  video_summary: string | null;
  video_view_count: number | null;
  source_id: string;
  source_name: string;
  source_thumbnail_url: string | null;
}

export interface DigestStats {
  videos_today: number;
  videos_this_week: number;
  summaries_today: number;
  summaries_this_week: number;
}

function getCutoffDate(period: DigestPeriod): string {
  const now = new Date();
  if (period === "day") {
    now.setDate(now.getDate() - 1);
  } else {
    now.setDate(now.getDate() - 7);
  }
  return now.toISOString();
}

function transformVideo(video: VideoWithSource): DigestVideo {
  return {
    video_id: video.id,
    video_title: video.title,
    video_description: video.description,
    video_thumbnail_url: video.thumbnail_url,
    video_duration_seconds: video.duration_seconds,
    video_published_at: video.published_at,
    video_summary: video.summary,
    video_view_count: video.view_count,
    source_id: video.source_id,
    source_name: video.source?.name || "Unknown",
    source_thumbnail_url: video.source?.thumbnail_url || null,
  };
}

export function useDigest(period: DigestPeriod = "day") {
  const { favoriteIds, loading: favoritesLoading } = useFavorites();
  const [videos, setVideos] = useState<DigestVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    // Wait for favorites to load first
    if (favoritesLoading) return;

    setLoading(true);
    setError(null);

    const cutoff = getCutoffDate(period);

    try {
      // Build query - filter by favorites if user has any, otherwise show all
      let query = supabase
        .from("videos")
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          duration_seconds,
          published_at,
          summary,
          view_count,
          source_id,
          source:sources(id, name, thumbnail_url)
        `)
        .gte("published_at", cutoff)
        .not("thumbnail_url", "is", null)
        .order("published_at", { ascending: false })
        .limit(100);

      // Filter by favorites if user has favorited channels
      if (favoriteIds.size > 0) {
        query = query.in("source_id", Array.from(favoriteIds));
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Transform and handle Supabase's array return for joins
      const transformed = (data || []).map((v) => {
        const video = {
          ...v,
          source: Array.isArray(v.source) ? v.source[0] : v.source,
        } as VideoWithSource;
        return transformVideo(video);
      });

      setVideos(transformed);
    } catch (err) {
      console.error("Error fetching digest:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch digest");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [period, favoriteIds, favoritesLoading]);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  // Group videos by source for better display
  const videosBySource = videos.reduce(
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
      acc[sourceId].videos.push(video);
      return acc;
    },
    {} as Record<
      string,
      {
        source_id: string;
        source_name: string;
        source_thumbnail_url: string | null;
        videos: DigestVideo[];
      }
    >
  );

  // Count summaries
  const summaryCount = videos.filter((v) => v.video_summary).length;

  return {
    videos,
    videosBySource: Object.values(videosBySource),
    summaryCount,
    totalCount: videos.length,
    loading: loading || favoritesLoading,
    error,
    refetch: fetchDigest,
  };
}

export function useDigestStats() {
  const { favoriteIds, loading: favoritesLoading } = useFavorites();
  const [stats, setStats] = useState<DigestStats>({
    videos_today: 0,
    videos_this_week: 0,
    summaries_today: 0,
    summaries_this_week: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (favoritesLoading) return;

    setLoading(true);

    const dayAgo = getCutoffDate("day");
    const weekAgo = getCutoffDate("week");

    try {
      // Build base queries
      let todayQuery = supabase
        .from("videos")
        .select("id, summary", { count: "exact", head: false })
        .gte("published_at", dayAgo);

      let weekQuery = supabase
        .from("videos")
        .select("id, summary", { count: "exact", head: false })
        .gte("published_at", weekAgo);

      // Filter by favorites if user has favorited channels
      if (favoriteIds.size > 0) {
        const sourceIds = Array.from(favoriteIds);
        todayQuery = todayQuery.in("source_id", sourceIds);
        weekQuery = weekQuery.in("source_id", sourceIds);
      }

      const [todayResult, weekResult] = await Promise.all([todayQuery, weekQuery]);

      const todayVideos = todayResult.data || [];
      const weekVideos = weekResult.data || [];

      setStats({
        videos_today: todayVideos.length,
        videos_this_week: weekVideos.length,
        summaries_today: todayVideos.filter((v) => v.summary).length,
        summaries_this_week: weekVideos.filter((v) => v.summary).length,
      });
    } catch (err) {
      console.error("Error fetching digest stats:", err);
    } finally {
      setLoading(false);
    }
  }, [favoriteIds, favoritesLoading]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading: loading || favoritesLoading,
    refetch: fetchStats,
  };
}
