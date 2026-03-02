const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not configured");
  return key;
}

export interface ChannelMetadata {
  id: string;
  name: string;
  description: string;
  subscriberCount?: number;
  thumbnailUrl?: string;
  bannerUrl?: string;
  videoCount?: number;
}

export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: number;
  durationString: string;
  uploadDate: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export async function getChannelMetadata(
  handle: string
): Promise<ChannelMetadata> {
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  const params = new URLSearchParams({
    part: "snippet,statistics,brandingSettings",
    forHandle: cleanHandle,
    key: getApiKey(),
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params}`);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const channel = data.items?.[0];
  if (!channel) throw new Error(`Channel not found for handle: ${handle}`);

  return {
    id: channel.id,
    name: channel.snippet.title,
    description: channel.snippet.description || "",
    subscriberCount: parseInt(channel.statistics.subscriberCount) || undefined,
    thumbnailUrl: channel.snippet.thumbnails?.high?.url,
    bannerUrl: channel.brandingSettings?.image?.bannerExternalUrl,
    videoCount: parseInt(channel.statistics.videoCount) || undefined,
  };
}

export async function getChannelVideos(
  channelId: string,
  maxResults: number = 50
): Promise<VideoMetadata[]> {
  // Step 1: Search for recent videos from the channel
  const searchParams = new URLSearchParams({
    part: "snippet",
    channelId,
    type: "video",
    order: "date",
    maxResults: String(maxResults),
    key: getApiKey(),
  });

  const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${searchParams}`);
  if (!searchRes.ok)
    throw new Error(`YouTube search API error: ${searchRes.status} ${await searchRes.text()}`);

  const searchData = await searchRes.json();
  const videoIds: string[] = searchData.items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?.map((item: any) => item.id?.videoId)
    .filter(Boolean) || [];

  if (videoIds.length === 0) return [];

  // Step 2: Get full details for all videos in one batch request
  return getVideosMetadata(videoIds);
}

export async function getVideosMetadata(
  videoIds: string[]
): Promise<VideoMetadata[]> {
  // YouTube API allows up to 50 IDs per request
  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: videoIds.join(","),
    key: getApiKey(),
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);
  if (!res.ok) throw new Error(`YouTube videos API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items || []).map((item: any) => {
    const duration = parseISO8601Duration(item.contentDetails?.duration || "");
    const uploadDate = item.snippet?.publishedAt?.split("T")[0] || "";

    return {
      id: item.id,
      title: item.snippet?.title || "",
      description: item.snippet?.description || "",
      url: `https://www.youtube.com/watch?v=${item.id}`,
      duration,
      durationString: formatDuration(duration),
      uploadDate,
      publishedAt: item.snippet?.publishedAt || "",
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        "",
      viewCount: parseInt(item.statistics?.viewCount) || 0,
      likeCount: parseInt(item.statistics?.likeCount) || 0,
      commentCount: parseInt(item.statistics?.commentCount) || 0,
    } as VideoMetadata;
  });
}

/** Parse ISO 8601 duration (e.g. "PT1H23M45S") to seconds */
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

/** Format seconds as "H:MM:SS" or "M:SS" */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
