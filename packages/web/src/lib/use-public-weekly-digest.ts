import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

export interface PublicWeeklyDigest {
  id: string;
  week_start: string;
  content: string;
  created_at: string;
}

export interface PublicDigestVideoThumbnail {
  video_id: string;
  video_thumbnail_url: string | null;
  video_title: string;
}

export function usePublicWeeklyDigest() {
  const [digest, setDigest] = useState<PublicWeeklyDigest | null>(null);
  const [videos, setVideos] = useState<PublicDigestVideoThumbnail[]>([]);
  const [totalVideoCount, setTotalVideoCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeeklyDigest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch the most recent digest (RLS allows public read)
      const { data: digestData, error: digestError } = await supabase
        .from("digests")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(1)
        .single();

      if (digestError) {
        if (digestError.code === "PGRST116") {
          // No digest found
          setDigest(null);
          setVideos([]);
          setTotalVideoCount(0);
          return;
        }
        throw digestError;
      }

      setDigest(digestData);

      // Calculate week end (week_start + 6 days)
      const weekStart = new Date(digestData.week_start);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Fetch videos from that week for thumbnails (public read via RLS)
      const { data: videoData, error: videoError, count } = await supabase
        .from("videos")
        .select("id, thumbnail_url, title", { count: "exact" })
        .gte("published_at", weekStart.toISOString())
        .lt("published_at", weekEnd.toISOString())
        .not("thumbnail_url", "is", null)
        .order("published_at", { ascending: false })
        .limit(10);

      if (videoError) throw videoError;

      const thumbnails: PublicDigestVideoThumbnail[] = (videoData || []).map((v) => ({
        video_id: v.id,
        video_thumbnail_url: v.thumbnail_url,
        video_title: v.title,
      }));

      setVideos(thumbnails);
      setTotalVideoCount(count || 0);
    } catch (err) {
      console.error("Error fetching public weekly digest:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch weekly digest");
      setDigest(null);
      setVideos([]);
      setTotalVideoCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeeklyDigest();
  }, [fetchWeeklyDigest]);

  // Format week range for display (e.g., "Feb 3 - Feb 9, 2026")
  const weekRange = digest
    ? formatWeekRange(digest.week_start)
    : null;

  return {
    digest,
    videos,
    totalVideoCount,
    weekRange,
    loading,
    error,
    refetch: fetchWeeklyDigest,
  };
}

export function formatWeekRange(weekStartStr: string): string {
  const weekStart = new Date(weekStartStr);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
  const endMonth = weekEnd.toLocaleDateString("en-US", { month: "short" });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const year = weekEnd.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}
