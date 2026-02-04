import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, ExternalLink, Clock, Eye, Calendar, Sparkles, Mic, Users, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChatPage } from "./chat";

interface VideoDetail {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  view_count: number | null;
  like_count: number | null;
  summary: string | null;
  source: {
    id: string;
    name: string;
    handle: string | null;
  } | null;
}

interface VideoPerson {
  id: string;
  role: string;
  person: {
    id: string;
    name: string;
    photo_url: string | null;
    slug: string;
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "Unknown";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

function formatNumber(num: number | null): string {
  if (!num) return "0";
  return num.toLocaleString();
}

const MAX_DESCRIPTION_LINES = 10;

function ExpandableDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);

  const lines = description.split('\n');
  const needsTruncation = lines.length > MAX_DESCRIPTION_LINES;
  const truncatedDescription = needsTruncation
    ? lines.slice(0, MAX_DESCRIPTION_LINES).join('\n')
    : description;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Description</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm leading-relaxed">
          <Markdown>{expanded ? description : truncatedDescription}</Markdown>
        </div>
        {needsTruncation && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 p-0 h-auto text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show more
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  if (diffDays < 730) return "1 year ago";
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [people, setPeople] = useState<VideoPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideo() {
      if (!id) return;

      setLoading(true);

      const [videoResult, peopleResult] = await Promise.all([
        supabase
          .from("videos")
          .select(`
            id,
            external_id,
            title,
            description,
            thumbnail_url,
            duration_seconds,
            published_at,
            view_count,
            like_count,
            summary,
            source:sources(id, name, handle)
          `)
          .eq("id", id)
          .single(),
        supabase
          .from("video_people")
          .select(`
            id,
            role,
            person:people(id, name, photo_url, slug)
          `)
          .eq("video_id", id)
          .order("display_order", { ascending: true }),
      ]);

      if (videoResult.error) {
        console.error("Error fetching video:", videoResult.error);
      } else if (videoResult.data) {
        // Transform source from array to single object (Supabase returns arrays for joins)
        const transformed = {
          ...videoResult.data,
          source: Array.isArray(videoResult.data.source) ? videoResult.data.source[0] : videoResult.data.source,
        } as VideoDetail;
        setVideo(transformed);
      }

      if (peopleResult.error) {
        console.error("Error fetching people:", peopleResult.error);
      } else {
        // Transform person from array to object
        const transformedPeople = (peopleResult.data || []).map((p) => ({
          ...p,
          person: Array.isArray(p.person) ? p.person[0] : p.person,
        })) as VideoPerson[];
        // Sort: hosts first, then guests
        transformedPeople.sort((a, b) => {
          if (a.role === "host" && b.role !== "host") return -1;
          if (a.role !== "host" && b.role === "host") return 1;
          return 0;
        });
        setPeople(transformedPeople);
      }

      setLoading(false);
    }

    fetchVideo();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="aspect-video w-full mb-4" />
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="p-6">
        <Link to="/videos">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Videos
          </Button>
        </Link>
        <p className="text-muted-foreground">Video not found.</p>
      </div>
    );
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${video.external_id}`;

  return (
    <div className="p-6">
      <Link to="/videos">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Videos
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-4 max-w-md">
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
          </div>

          <h1 className="text-2xl font-bold mb-2">{video.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {video.source && (
              <Link
                to={`/channels/${video.source.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {video.source.name}
              </Link>
            )}
            {video.view_count && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {formatNumber(video.view_count)} views
              </span>
            )}
            {video.duration_seconds && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(video.duration_seconds)}
              </span>
            )}
            {video.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatRelativeDate(video.published_at)}
              </span>
            )}
          </div>

          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="mb-6">
              <ExternalLink className="mr-2 h-4 w-4" />
              Watch on YouTube
            </Button>
          </a>

          {/* People Section */}
          {people.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  People in this video
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {people.map((p) => (
                    <Link key={p.id} to={`/people/${p.person.id}`}>
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={p.person.photo_url || undefined}
                            alt={p.person.name}
                          />
                          <AvatarFallback>
                            {getInitials(p.person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm hover:underline">
                            {p.person.name}
                          </p>
                          <Badge
                            variant={p.role === "host" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {p.role === "host" ? (
                              <><Mic className="h-3 w-3 mr-1" />Host</>
                            ) : (
                              "Guest"
                            )}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {video.summary && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm leading-relaxed">
                  <Markdown>{video.summary}</Markdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ask Questions CTA - hidden for now, re-enable later */}
          {/* <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="mb-6 w-full sm:w-auto">
                <MessageSquare className="mr-2 h-4 w-4" />
                Ask questions about this video
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-[600px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Chat about {video.title}</SheetTitle>
              </SheetHeader>
              <ChatPage videoId={video.id} />
            </SheetContent>
          </Sheet> */}

          {/* {video.description && (
            <ExpandableDescription description={video.description} />
          )} */}
        </div>

      </div>
    </div>
  );
}
