import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { Markdown } from "@/components/Markdown";
import { useAuth } from "@/lib/auth";
import { usePublicWeeklyDigest, type PublicDigestVideoThumbnail } from "@/lib/use-public-weekly-digest";
import {
  Newspaper,
  Calendar,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface VideoThumbnailsProps {
  videos: PublicDigestVideoThumbnail[];
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
          className="h-10 w-10 border-2 border-background"
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

export function WeeklyDigestPage() {
  const { user, loading: authLoading } = useAuth();
  const { digest, videos, totalVideoCount, weekRange, loading, error } = usePublicWeeklyDigest();

  // Signal to prerenderer that the page is ready once digest has loaded
  useEffect(() => {
    if (!loading) {
      document.dispatchEvent(new Event('prerender-ready'));
    }
  }, [loading]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect authenticated users to /home
  if (user) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Decompress" className="h-8 w-8" />
            <span className="font-bold text-xl hidden sm:inline">Decompress</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <SignInDialog
              trigger={
                <Button variant="ghost" className="px-2 sm:px-4">
                  Sign In
                </Button>
              }
            />
            <SignInDialog
              trigger={<Button className="px-2 sm:px-4">Start Free Trial</Button>}
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-40" />
            <div className="flex items-center gap-1">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-full" />
              ))}
              <Skeleton className="h-4 w-24 ml-2" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          </div>
        ) : error || !digest ? (
          <Card className="p-8 text-center">
            <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No Weekly Digest Yet</h3>
            <p className="text-muted-foreground">
              Check back soon for a synthesized summary of the week's top insights.
            </p>
          </Card>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <Badge variant="secondary" className="gap-1 mb-4">
                <Newspaper className="h-3 w-3" />
                Weekly Digest
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                This Week in Tech
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground mb-6">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{weekRange}</span>
              </div>

              {/* Video Thumbnails */}
              {videos.length > 0 && (
                <div className="mb-6">
                  <VideoThumbnails videos={videos} totalCount={totalVideoCount} />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t mb-8" />

            {/* Content */}
            <article className="text-sm">
              <Markdown>
                {digest.content}
              </Markdown>
            </article>
          </>
        )}
      </main>

      {/* CTA Section */}
      {!loading && digest && (
        <section className="border-t bg-muted/30">
          <div className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-bold mb-4">
              Want weekly digests in your inbox?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Get daily summaries and weekly roundups of the best tech podcasts delivered straight to your inbox.
            </p>
            <SignInDialog
              trigger={
                <Button size="lg" className="gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
            <p className="text-sm text-muted-foreground mt-4">
              7-day free trial · No credit card required
            </p>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Decompress" className="h-6 w-6" />
              <span className="font-semibold">Decompress</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms & Conditions
              </Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Decompress. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
