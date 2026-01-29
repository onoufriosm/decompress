import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FilterPanel } from "@/components/filter-panel";
import { Search, Mic } from "lucide-react";

interface VideoPerson {
  id: string;
  role: string;
  person: {
    id: string;
    name: string;
    photo_url: string | null;
  };
}

interface Video {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  view_count: number | null;
  source: {
    id: string;
    name: string;
  } | null;
  people: VideoPerson[];
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

export function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    async function fetchVideos() {
      setLoading(true);

      // If we have category filters, we need to get the video IDs first
      let filteredVideoIds: string[] | null = null;

      if (selectedCategories.length > 0) {
        const { data: categorizedVideos } = await supabase
          .from("video_categories")
          .select("video_id")
          .in("category_id", selectedCategories);

        const categoryVideoIds =
          categorizedVideos?.map((v) => v.video_id) || [];
        filteredVideoIds = categoryVideoIds;
      }

      // If filters returned no results, show empty
      if (
        filteredVideoIds !== null &&
        filteredVideoIds.length === 0
      ) {
        setVideos([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("videos")
        .select(
          `
          id,
          external_id,
          title,
          description,
          thumbnail_url,
          duration_seconds,
          published_at,
          view_count,
          source:sources(id, name),
          video_people(id, role, person:people(id, name, photo_url))
        `
        )
        .not("thumbnail_url", "is", null)
        .order("published_at", { ascending: false })
        .limit(50);

      // Apply video ID filter from categories
      if (filteredVideoIds !== null) {
        query = query.in("id", filteredVideoIds);
      }

      // Apply text search
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching videos:", error);
        setVideos([]);
      } else {
        // Transform source and people from arrays
        const transformed = (data || []).map((v) => {
          // Transform video_people - each person is an array too
          const people = (v.video_people || []).map((vp: { id: string; role: string; person: unknown }) => ({
            ...vp,
            person: Array.isArray(vp.person) ? vp.person[0] : vp.person,
          })).filter((vp: { person: unknown }) => vp.person) as VideoPerson[];

          // Sort: hosts first
          people.sort((a, b) => {
            if (a.role === "host" && b.role !== "host") return -1;
            if (a.role !== "host" && b.role === "host") return 1;
            return 0;
          });

          return {
            ...v,
            source: Array.isArray(v.source) ? v.source[0] : v.source,
            people,
          };
        }) as Video[];
        setVideos(transformed);
      }
      setLoading(false);
    }

    const debounce = setTimeout(fetchVideos, 300);
    return () => clearTimeout(debounce);
  }, [search, selectedCategories]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Videos</h1>
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <FilterPanel
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          entityType="video"
        />
      </div>

      {loading ? (
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
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground">No videos found.</p>
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
                  <h3 className="font-semibold line-clamp-2 mb-1">
                    {video.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {video.source?.name}
                  </p>
                  {video.people.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <div className="flex -space-x-2">
                        {video.people.slice(0, 4).map((p) => (
                          <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage
                              src={p.person.photo_url || undefined}
                              alt={p.person.name}
                            />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(p.person.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">
                        {video.people.slice(0, 2).map((p, i) => (
                          <span key={p.id}>
                            {i > 0 && ", "}
                            {p.role === "host" && <Mic className="h-3 w-3 inline mr-0.5" />}
                            {p.person.name}
                          </span>
                        ))}
                        {video.people.length > 2 && ` +${video.people.length - 2}`}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.published_at && formatRelativeDate(video.published_at)}

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
