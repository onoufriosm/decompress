import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FavoriteButton } from "@/components/favorite-button";
import { ArrowLeft, ExternalLink, Users, Video as VideoIcon, Mic } from "lucide-react";

interface Channel {
  id: string;
  external_id: string;
  name: string;
  handle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  video_count: number | null;
  last_scraped_at: string | null;
}

interface Video {
  id: string;
  external_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  view_count: number | null;
}

interface Host {
  id: string;
  person_id: string;
  role: string;
  is_primary: boolean;
  verified: boolean;
  person: {
    id: string;
    name: string;
    photo_url: string | null;
    slug: string;
  };
}

function formatSubscriberCount(count: number | null): string {
  if (!count) return "0";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatViewCount(count: number | null): string {
  if (!count) return "";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M views`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChannelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      setLoading(true);

      const [channelResult, videosResult, hostsResult] = await Promise.all([
        supabase.from("sources").select("*").eq("id", id).single(),
        supabase
          .from("videos")
          .select("id, external_id, title, thumbnail_url, duration_seconds, published_at, view_count")
          .eq("source_id", id)
          .not("thumbnail_url", "is", null)
          .order("published_at", { ascending: false })
          .limit(20),
        supabase
          .from("source_people")
          .select(`
            id,
            person_id,
            role,
            is_primary,
            verified,
            person:people(id, name, photo_url, slug)
          `)
          .eq("source_id", id)
          .eq("role", "host"),
      ]);

      if (channelResult.error) {
        console.error("Error fetching channel:", channelResult.error);
      } else {
        setChannel(channelResult.data);
      }

      if (videosResult.error) {
        console.error("Error fetching videos:", videosResult.error);
      } else {
        setVideos(videosResult.data || []);
      }

      if (hostsResult.error) {
        console.error("Error fetching hosts:", hostsResult.error);
      } else {
        // Transform person from array to object
        const transformedHosts = (hostsResult.data || []).map((h) => ({
          ...h,
          person: Array.isArray(h.person) ? h.person[0] : h.person,
        })) as Host[];
        // Sort by is_primary (primary hosts first)
        transformedHosts.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        setHosts(transformedHosts);
      }

      setLoading(false);
    }

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="flex items-start gap-6 mb-8">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="p-6">
        <Link to="/channels">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Channels
          </Button>
        </Link>
        <p className="text-muted-foreground">Channel not found.</p>
      </div>
    );
  }

  const youtubeUrl = channel.handle
    ? `https://www.youtube.com/${channel.handle}`
    : `https://www.youtube.com/channel/${channel.external_id}`;

  return (
    <div className="p-6">
      <Link to="/channels">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Channels
        </Button>
      </Link>

      <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
        <Avatar className="h-24 w-24">
          <AvatarImage src={channel.thumbnail_url || undefined} alt={channel.name} />
          <AvatarFallback className="text-2xl">{getInitials(channel.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">{channel.name}</h1>
          {channel.handle && (
            <p className="text-muted-foreground mb-3">{channel.handle}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {channel.subscriber_count && (
              <div className="flex items-center gap-1 text-sm">
                <Users className="h-4 w-4" />
                <span>{formatSubscriberCount(channel.subscriber_count)} subscribers</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm">
              <VideoIcon className="h-4 w-4" />
              <span>{videos.length} videos in database</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                View on YouTube
              </Button>
            </a>
            <FavoriteButton sourceId={channel.id} variant="button" size="sm" />
          </div>
        </div>
      </div>

      {channel.description && (
        <Card className="mb-8">
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">{channel.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Hosts Section */}
      {hosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Hosts
          </h2>
          <div className="flex flex-wrap gap-4">
            {hosts.map((host) => (
              <Link key={host.id} to={`/people/${host.person.id}`}>
                <Card className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={host.person.photo_url || undefined}
                        alt={host.person.name}
                      />
                      <AvatarFallback>
                        {getInitials(host.person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold hover:underline">
                        {host.person.name}
                      </h3>
                      {host.is_primary && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Primary Host
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">Videos</h2>

      {videos.length === 0 ? (
        <p className="text-muted-foreground">No videos found for this channel.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Link key={video.id} to={`/videos/${video.id}`}>
              <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                <div className="relative aspect-video bg-muted">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No thumbnail
                    </div>
                  )}
                  {video.duration_seconds && (
                    <Badge
                      variant="secondary"
                      className="absolute bottom-2 right-2 bg-black/80 text-white"
                    >
                      {formatDuration(video.duration_seconds)}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold line-clamp-2 mb-1">{video.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatViewCount(video.view_count)}
                    {video.published_at && (
                      <> · {new Date(video.published_at).toLocaleDateString()}</>
                    )}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
