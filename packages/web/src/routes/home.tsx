import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/Markdown";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/use-favorites";
import { useDigest, useDigestStats, type DigestPeriod, type DigestVideo } from "@/lib/use-digest";
import {
  Video,
  Radio,
  Sparkles,
  Star,
  Check,
  ArrowRight,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
} from "lucide-react";

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

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatViewCount(count: number | null): string {
  if (!count) return "";
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
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

function truncateSummary(summary: string, maxLength: number = 300): string {
  if (summary.length <= maxLength) return summary;
  return summary.slice(0, maxLength).trim() + "...";
}

interface VideoCardProps {
  video: DigestVideo;
  showSummary?: boolean;
}

function VideoCard({ video, showSummary = false }: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSummary = !!video.video_summary;
  const summaryPreview = video.video_summary ? truncateSummary(video.video_summary) : null;
  const isLongSummary = video.video_summary && video.video_summary.length > 300;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col md:flex-row md:items-start">
        {/* Thumbnail */}
        <Link to={`/videos/${video.video_id}`} className="md:w-64 flex-shrink-0">
          <div className="relative aspect-video bg-muted">
            {video.video_thumbnail_url ? (
              <img
                src={video.video_thumbnail_url}
                alt={video.video_title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No thumbnail
              </div>
            )}
            {video.video_duration_seconds && (
              <Badge
                variant="secondary"
                className="absolute bottom-2 right-2 bg-black/80 text-white"
              >
                {formatDuration(video.video_duration_seconds)}
              </Badge>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Link to={`/videos/${video.video_id}`} className="flex-1">
              <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">
                {video.video_title}
              </h3>
            </Link>
            {hasSummary && (
              <Badge className="bg-purple-600 text-white flex-shrink-0">
                <Sparkles className="h-3 w-3 mr-1" />
                Summary
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(video.video_published_at)}
            </span>
            {video.video_view_count && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {formatViewCount(video.video_view_count)}
              </span>
            )}
          </div>

          {/* Summary Preview */}
          {showSummary && hasSummary && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-sm text-muted-foreground">
                <Markdown>
                  {expanded ? video.video_summary! : summaryPreview!}
                </Markdown>
              </div>
              {isLongSummary && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-0 text-primary"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      Show less <ChevronUp className="ml-1 h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Read more <ChevronDown className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {!hasSummary && showSummary && (
            <p className="text-sm text-muted-foreground italic mt-3 pt-3 border-t">
              Summary not yet available
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface ChannelGroupProps {
  source: {
    source_id: string;
    source_name: string;
    source_thumbnail_url: string | null;
    videos: DigestVideo[];
  };
  showSummaries: boolean;
}

function ChannelGroup({ source, showSummaries }: ChannelGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const summaryCount = source.videos.filter((v) => v.video_summary).length;

  return (
    <div className="mb-8">
      <div
        className="flex items-center gap-3 mb-4 cursor-pointer group"
        onClick={() => setCollapsed(!collapsed)}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={source.source_thumbnail_url || undefined} alt={source.source_name} />
          <AvatarFallback>{getInitials(source.source_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Link
            to={`/channels/${source.source_id}`}
            className="font-semibold hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {source.source_name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {source.videos.length} video{source.videos.length !== 1 ? "s" : ""}
            {summaryCount > 0 && ` · ${summaryCount} with summaries`}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="space-y-4 ml-0 md:ml-13">
          {source.videos.map((video) => (
            <VideoCard key={video.video_id} video={video} showSummary={showSummaries} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { favorites, loading: favoritesLoading } = useFavorites();
  const [period, setPeriod] = useState<DigestPeriod>("day");
  const [showSummaries, setShowSummaries] = useState(true);
  const { videos, videosBySource, summaryCount, totalCount, loading: digestLoading } = useDigest(period);
  const { stats, loading: statsLoading } = useDigestStats();

  // Not logged in - show welcome page
  if (!authLoading && !user) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Welcome to Decompress</h1>
          <p className="text-muted-foreground mb-8">
            Your personal podcast and video digest. Sign in to favorite channels and get
            personalized digests of new content.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-4">
              <Video className="h-8 w-8 mb-2 mx-auto text-primary" />
              <h3 className="font-semibold">Browse Videos</h3>
              <p className="text-sm text-muted-foreground">
                Explore videos with AI-generated summaries
              </p>
            </Card>
            <Card className="p-4">
              <Star className="h-8 w-8 mb-2 mx-auto text-yellow-500" />
              <h3 className="font-semibold">Favorite Channels</h3>
              <p className="text-sm text-muted-foreground">
                Star your favorite channels for quick access
              </p>
            </Card>
            <Card className="p-4">
              <Sparkles className="h-8 w-8 mb-2 mx-auto text-purple-500" />
              <h3 className="font-semibold">AI Summaries</h3>
              <p className="text-sm text-muted-foreground">
                Get concise summaries of lengthy videos
              </p>
            </Card>
          </div>
          <div className="flex gap-4 justify-center">
            <Link to="/videos">
              <Button>
                <Video className="mr-2 h-4 w-4" />
                Browse Videos
              </Button>
            </Link>
            <Link to="/channels">
              <Button variant="outline">
                <Radio className="mr-2 h-4 w-4" />
                View Channels
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = authLoading || favoritesLoading || digestLoading || statsLoading;

  // Logged in - show digest
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Your Digest</h1>
        <p className="text-muted-foreground">
          Catch up on the latest from your favorite channels.
        </p>
      </div>

      {/* Stats & Period Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as DigestPeriod)}>
            <TabsList>
              <TabsTrigger value="day" className="gap-2">
                <Calendar className="h-4 w-4" />
                Today
                {!statsLoading && stats.videos_today > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {stats.videos_today}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="week" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                This Week
                {!statsLoading && stats.videos_this_week > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {stats.videos_this_week}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-4">
          {totalCount > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{totalCount}</span> videos
              {summaryCount > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-purple-600">{summaryCount}</span> with summaries
                </>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSummaries(!showSummaries)}
            className={showSummaries ? "bg-purple-50 border-purple-200" : ""}
          >
            <Sparkles className={`h-4 w-4 mr-2 ${showSummaries ? "text-purple-600" : ""}`} />
            {showSummaries ? "Summaries On" : "Summaries Off"}
          </Button>
        </div>
      </div>

      {/* No favorites prompt */}
      {!isLoading && favorites.length === 0 && (
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No favorite channels yet</h3>
            <p className="text-muted-foreground mb-4">
              Star some channels to see their videos in your digest.
            </p>
            <Link to="/channels">
              <Button>
                <Radio className="mr-2 h-4 w-4" />
                Browse Channels
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-4">
                {[...Array(2)].map((_, j) => (
                  <Card key={j}>
                    <div className="flex flex-col md:flex-row">
                      <Skeleton className="aspect-video md:w-64 md:h-36" />
                      <div className="p-4 flex-1">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2 mb-4" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && favorites.length > 0 && videos.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
            <p className="text-muted-foreground">
              No new videos from your favorite channels{" "}
              {period === "day" ? "today" : "this week"}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Videos grouped by channel */}
      {!isLoading && videosBySource.length > 0 && (
        <div>
          {videosBySource.map((source) => (
            <ChannelGroup
              key={source.source_id}
              source={source}
              showSummaries={showSummaries}
            />
          ))}

          {totalCount > videos.length && (
            <div className="text-center mt-8">
              <Link to="/videos">
                <Button variant="outline">
                  View all videos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
