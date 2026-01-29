import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  ExternalLink,
  Mic,
  Users,
  Video as VideoIcon,
  Radio,
} from "lucide-react";

interface Person {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  social_links: Record<string, string> | null;
}

interface ChannelAppearance {
  id: string;
  source_id: string;
  role: string;
  is_primary: boolean;
  verified: boolean;
  source: {
    id: string;
    name: string;
    handle: string | null;
    thumbnail_url: string | null;
  };
}

interface VideoAppearance {
  id: string;
  video_id: string;
  role: string;
  video: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    published_at: string | null;
    source: {
      id: string;
      name: string;
    } | null;
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}


export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<Person | null>(null);
  const [channelAppearances, setChannelAppearances] = useState<
    ChannelAppearance[]
  >([]);
  const [videoAppearances, setVideoAppearances] = useState<VideoAppearance[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;

      setLoading(true);

      const [personResult, channelsResult, videosResult] = await Promise.all([
        supabase.from("people").select("*").eq("id", id).single(),
        supabase
          .from("source_people")
          .select(
            `
            id,
            source_id,
            role,
            is_primary,
            verified,
            source:sources(id, name, handle, thumbnail_url)
          `
          )
          .eq("person_id", id),
        supabase
          .from("video_people")
          .select(
            `
            id,
            video_id,
            role,
            video:videos(id, title, thumbnail_url, published_at, source:sources(id, name))
          `
          )
          .eq("person_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (personResult.error) {
        console.error("Error fetching person:", personResult.error);
      } else {
        setPerson(personResult.data);
      }

      if (channelsResult.error) {
        console.error("Error fetching channel appearances:", channelsResult.error);
      } else {
        // Transform source from array to object
        const transformed = (channelsResult.data || []).map((item) => ({
          ...item,
          source: Array.isArray(item.source) ? item.source[0] : item.source,
        })) as ChannelAppearance[];
        setChannelAppearances(transformed);
      }

      if (videosResult.error) {
        console.error("Error fetching video appearances:", videosResult.error);
      } else {
        // Transform video.source from array to object
        const transformed = (videosResult.data || []).map((item) => {
          const video = Array.isArray(item.video) ? item.video[0] : item.video;
          return {
            ...item,
            video: video
              ? {
                  ...video,
                  source: Array.isArray(video.source)
                    ? video.source[0]
                    : video.source,
                }
              : null,
          };
        }) as VideoAppearance[];
        setVideoAppearances(transformed.filter((v) => v.video));
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
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="p-6">
        <Link to="/people">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to People
          </Button>
        </Link>
        <p className="text-muted-foreground">Person not found.</p>
      </div>
    );
  }

  const hostChannels = channelAppearances.filter((c) => c.role === "host");
  const guestVideos = videoAppearances.filter((v) => v.role === "guest");

  return (
    <div className="p-6">
      <Link to="/people">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to People
        </Button>
      </Link>

      {/* Person Header */}
      <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
        <Avatar className="h-24 w-24">
          <AvatarImage src={person.photo_url || undefined} alt={person.name} />
          <AvatarFallback className="text-2xl">
            {getInitials(person.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-2">{person.name}</h1>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {hostChannels.length > 0 && (
              <Badge variant="default">
                <Mic className="h-3 w-3 mr-1" />
                Host of {hostChannels.length} channel
                {hostChannels.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {guestVideos.length > 0 && (
              <Badge variant="secondary">
                <Users className="h-3 w-3 mr-1" />
                {guestVideos.length} guest appearance
                {guestVideos.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Social Links */}
          {person.social_links &&
            Object.keys(person.social_links).length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {person.social_links.wikipedia && (
                  <a
                    href={person.social_links.wikipedia}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Wikipedia
                    </Button>
                  </a>
                )}
                {person.social_links.website && (
                  <a
                    href={person.social_links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Website
                    </Button>
                  </a>
                )}
                {person.social_links.twitter && (
                  <a
                    href={person.social_links.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Twitter
                    </Button>
                  </a>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Bio */}
      {person.bio && (
        <Card className="mb-8">
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">{person.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Channels (as host) */}
      {hostChannels.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Channels
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hostChannels.map((appearance) => (
              <Link
                key={appearance.id}
                to={`/channels/${appearance.source.id}`}
              >
                <Card className="p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={appearance.source.thumbnail_url || undefined}
                        alt={appearance.source.name}
                      />
                      <AvatarFallback>
                        {getInitials(appearance.source.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate hover:underline">
                        {appearance.source.name}
                      </h3>
                      {appearance.source.handle && (
                        <p className="text-sm text-muted-foreground truncate">
                          {appearance.source.handle}
                        </p>
                      )}
                      <Badge
                        variant={appearance.is_primary ? "default" : "outline"}
                        className="mt-1 text-xs"
                      >
                        {appearance.is_primary ? "Primary Host" : "Host"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Guest Appearances */}
      {guestVideos.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <VideoIcon className="h-5 w-5" />
            Guest Appearances ({guestVideos.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guestVideos.map((appearance) => (
              <Link
                key={appearance.id}
                to={`/videos/${appearance.video.id}`}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative aspect-video bg-muted">
                    {appearance.video.thumbnail_url ? (
                      <img
                        src={appearance.video.thumbnail_url}
                        alt={appearance.video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No thumbnail
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold line-clamp-2 mb-1">
                      {appearance.video.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {appearance.video.source?.name}
                      {appearance.video.published_at && (
                        <>
                          {" "}
                          ·{" "}
                          {new Date(
                            appearance.video.published_at
                          ).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {hostChannels.length === 0 && guestVideos.length === 0 && (
        <p className="text-muted-foreground">
          No appearances recorded for this person yet.
        </p>
      )}
    </div>
  );
}
