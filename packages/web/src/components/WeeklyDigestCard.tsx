import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/Markdown";
import { useWeeklyDigest, type DigestVideoThumbnail } from "@/lib/use-weekly-digest";
import {
  Newspaper,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";

// Content to show when collapsed (up to "Top News This Week" section)
function getDigestSnippet(content: string): string {
  // Find the end of "Top News This Week" section (the next "---" after it)
  const topNewsIndex = content.indexOf("## Top News This Week");
  if (topNewsIndex === -1) {
    // Fallback: return first 1500 characters
    return content.slice(0, 1500) + "...";
  }

  // Find the divider after Top News section
  const afterTopNews = content.indexOf("---", topNewsIndex + 20);
  if (afterTopNews === -1) {
    return content.slice(0, topNewsIndex + 1500) + "...";
  }

  return content.slice(0, afterTopNews).trim();
}

interface VideoThumbnailsProps {
  videos: DigestVideoThumbnail[];
  totalCount: number;
}

function VideoThumbnails({ videos, totalCount }: VideoThumbnailsProps) {
  const displayVideos = videos.slice(0, 6);
  const remaining = totalCount - displayVideos.length;

  return (
    <div className="flex items-center gap-1">
      {displayVideos.map((video, index) => (
        <Avatar
          key={video.video_id}
          className="h-8 w-8 border-2 border-background"
          style={{ marginLeft: index > 0 ? "-8px" : "0" }}
        >
          <AvatarImage
            src={video.video_thumbnail_url || undefined}
            alt={video.video_title}
            className="object-cover"
          />
          <AvatarFallback className="text-xs bg-muted">
            {index + 1}
          </AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <span className="text-sm text-muted-foreground ml-2">
          +{remaining} videos
        </span>
      )}
    </div>
  );
}

export function WeeklyDigestCard() {
  const { digest, videos, totalVideoCount, weekRange, loading, error } = useWeeklyDigest();
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-6 w-48 mb-2" />
        <div className="flex items-center gap-1 mb-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
          <Skeleton className="h-4 w-20 ml-2" />
        </div>
        <Skeleton className="h-px w-full mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6" />
      </Card>
    );
  }

  if (error || !digest) {
    return (
      <Card className="p-6 text-center">
        <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold text-lg mb-2">No Weekly Digest Yet</h3>
        <p className="text-muted-foreground text-sm">
          Check back soon for a synthesized summary of the week's top insights.
        </p>
      </Card>
    );
  }

  const snippet = getDigestSnippet(digest.content);
  const isLongContent = digest.content.length > snippet.length + 100;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="secondary" className="gap-1">
          <Newspaper className="h-3 w-3" />
          Weekly Digest
        </Badge>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        <Calendar className="h-4 w-4" />
        <span className="text-sm font-medium">{weekRange}</span>
      </div>

      {/* Video Thumbnails */}
      {videos.length > 0 && (
        <div className="mb-4">
          <VideoThumbnails videos={videos} totalCount={totalVideoCount} />
        </div>
      )}

      {/* Divider */}
      <div className="border-t my-4" />

      {/* Content */}
      <div className="text-sm">
        <Markdown>
          {expanded ? digest.content : snippet}
        </Markdown>
      </div>

      {/* Expand/Collapse Button */}
      {isLongContent && (
        <div className="mt-4 pt-4 border-t flex justify-center">
          <Button
            variant="outline"
            onClick={() => setExpanded(!expanded)}
            className="gap-2"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Read full digest <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
