import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { Markdown } from "@/components/Markdown";
import { useAuth } from "@/lib/auth";
import { usePublicDigest, type PublicDigestVideo } from "@/lib/use-public-digest";
import { usePublicWeeklyDigest, type PublicDigestVideoThumbnail } from "@/lib/use-public-weekly-digest";
import { SUBSCRIPTION_PRICE } from "@/lib/stripe";
import {
  formatDuration,
  formatRelativeTime,
  getInitials,
  truncateText,
} from "@/lib/format-utils";
import {
  Sparkles,
  Mail,
  Clock,
  Play,
  ArrowRight,
  Check,
  Zap,
  MessageSquare,
  Loader2,
  Users,
  TrendingUp,
  Headphones,
  ChevronDown,
  ChevronUp,
  Newspaper,
  Calendar,
} from "lucide-react";

interface DigestPreviewCardProps {
  video: PublicDigestVideo;
}

function DigestPreviewCard({ video }: DigestPreviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const summaryPreview = video.video_summary ? truncateText(video.video_summary, 250) : null;
  const isLongSummary = video.video_summary && video.video_summary.length > 250;

  return (
    <Card className="overflow-hidden">
      {/* Thumbnail */}
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

      {/* Content */}
      <div className="p-4">
        {/* Channel */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={video.source_thumbnail_url || undefined} alt={video.source_name} />
            <AvatarFallback className="text-xs">{getInitials(video.source_name)}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">{video.source_name}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(video.video_published_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm mb-2">
          {video.video_title}
        </h3>

        {/* Summary */}
        {video.video_summary && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex items-center gap-1 mb-2">
              <Sparkles className="h-3 w-3 text-purple-500" />
              <span className="text-xs font-medium text-purple-600">AI Summary</span>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <Markdown>
                {expanded ? video.video_summary : summaryPreview!}
              </Markdown>
            </div>
            {isLongSummary && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-auto p-0 text-xs text-primary"
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
      </div>
    </Card>
  );
}

function DigestPreview() {
  const { videos, loading, error } = usePublicDigest(3);

  // Signal to prerenderer that the page is ready once digest has loaded
  useEffect(() => {
    if (!loading) {
      document.dispatchEvent(new Event('prerender-ready'));
    }
  }, [loading]);

  if (error) {
    return null; // Silently fail - don't show section if we can't fetch
  }

  return (
    <section id="digest-preview" className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-12">
        <Badge variant="secondary" className="mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          Live Preview
        </Badge>
        <h2 className="text-3xl font-bold mb-4">Today's Summaries</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Here's what we summarized in the last 24 hours.
        </p>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video" />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4 mb-3" />
                <Skeleton className="h-20 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">Check back soon</h3>
          <p className="text-muted-foreground">
            New summaries are added throughout the day.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            {videos.map((video) => (
              <DigestPreviewCard key={video.video_id} video={video} />
            ))}
          </div>
          <div className="text-center mt-8">
            <SignInDialog
              trigger={
                <Button size="lg" variant="outline" className="gap-2">
                  Sign up for daily summaries
                  <Mail className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </>
      )}
    </section>
  );
}

interface WeeklyVideoThumbnailsProps {
  videos: PublicDigestVideoThumbnail[];
  totalCount: number;
}

function WeeklyVideoThumbnails({ videos, totalCount }: WeeklyVideoThumbnailsProps) {
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

function WeeklyDigestPreview() {
  const { digest, videos, totalVideoCount, weekRange, loading, error } = usePublicWeeklyDigest();

  if (error || (!loading && !digest)) {
    return null; // Silently fail - don't show section if we can't fetch
  }

  // Get a preview of the content (first ~500 chars, ending at a sentence)
  const getPreview = (content: string) => {
    const maxLength = 500;
    if (content.length <= maxLength) return content;

    // Find a good breaking point (end of sentence or paragraph)
    const truncated = content.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(". ");
    const lastNewline = truncated.lastIndexOf("\n");
    const breakPoint = Math.max(lastPeriod, lastNewline);

    if (breakPoint > 300) {
      return content.slice(0, breakPoint + 1).trim() + "...";
    }
    return truncated.trim() + "...";
  };

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 border-t">
      <div className="text-center mb-12">
        <Badge variant="secondary" className="mb-4">
          <Newspaper className="h-3 w-3 mr-1" />
          Weekly Roundup
        </Badge>
        <h2 className="text-3xl font-bold mb-4">This Week's Digest</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          A synthesis of the week's most important stories and insights.
        </p>
      </div>

      {loading ? (
        <Card className="max-w-3xl mx-auto p-6">
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="flex items-center gap-1">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-8 rounded-full" />
              ))}
              <Skeleton className="h-4 w-20 ml-2" />
            </div>
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      ) : digest && (
        <Card className="max-w-3xl mx-auto p-6">
          {/* Date Range */}
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">{weekRange}</span>
          </div>

          {/* Video Thumbnails */}
          {videos.length > 0 && (
            <div className="mb-4">
              <WeeklyVideoThumbnails videos={videos} totalCount={totalVideoCount} />
            </div>
          )}

          {/* Divider */}
          <div className="border-t my-4" />

          {/* Preview Content */}
          <div className="text-sm text-muted-foreground">
            <Markdown>
              {getPreview(digest.content)}
            </Markdown>
          </div>

          {/* Read More Link */}
          <div className="mt-6 pt-4 border-t">
            <Link to="/weekly-digest">
              <Button variant="outline" className="gap-2">
                Read full digest
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </section>
  );
}

export function LandingPage() {
  const { user, loading } = useAuth();

  // Show loading while checking auth
  if (loading) {
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
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-6">
            <Headphones className="h-3 w-3 mr-1" />
            a16z · 20VC · All-In · Lenny's Podcast · and more
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            <span>All the best ideas from tech podcasts.</span>{" "}
            Without watching them.
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get 5-minute summaries of 2-hour tech podcasts and YouTube interviews.
            Daily and weekly digests in your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignInDialog
              trigger={
                <Button size="lg" className="gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
            <a href="#digest-preview">
              <Button size="lg" variant="outline">
                View Today's Digest
              </Button>
            </a>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            7-day free trial · No credit card required
          </p>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="border-y bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Built for busy tech professionals</h2>
            <p className="text-muted-foreground">
              If you follow tech podcasts but rarely have time to watch, this is for you.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <Card className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="font-medium text-sm">Founders</div>
              <p className="text-xs text-muted-foreground">Stay sharp on trends while building</p>
            </Card>
            <Card className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="font-medium text-sm">Investors</div>
              <p className="text-xs text-muted-foreground">Catch every insight from top VCs</p>
            </Card>
            <Card className="p-4 text-center">
              <Zap className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="font-medium text-sm">Operators</div>
              <p className="text-xs text-muted-foreground">Learn from the best, faster</p>
            </Card>
            <Card className="p-4 text-center">
              <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="font-medium text-sm">Tech enthusiasts</div>
              <p className="text-xs text-muted-foreground">Never miss the conversation</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Digest Preview */}
      <DigestPreview />

      {/* Weekly Digest Preview */}
      <WeeklyDigestPreview />

      {/* How It Works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">From 2-hour podcast to 5-minute read</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            We watch the podcasts so you don't have to. Here's what you get.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Curated sources</h3>
            <p className="text-muted-foreground text-sm">
              We track a16z, 20VC, All-In, and dozens more top tech podcasts.
              New episodes summarized within hours.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Key insights extracted</h3>
            <p className="text-muted-foreground text-sm">
              Get the main arguments, notable quotes, and actionable takeaways.
              Skip the intros, ads, and tangents.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Daily digest in your inbox</h3>
            <p className="text-muted-foreground text-sm">
              Wake up to a curated email with yesterday's best content.
              Scan in 5 minutes over your morning coffee.
            </p>
          </Card>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Save 10+ hours a week on podcasts
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">5-minute reads instead of 2-hour watches</span>
                    <p className="text-sm text-muted-foreground">
                      Cover 10 podcasts in the time it takes to watch one episode
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">Signal, not noise</span>
                    <p className="text-sm text-muted-foreground">
                      We cut the intros, sponsor reads, and tangents. You get the insights.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">Triage before you commit</span>
                    <p className="text-sm text-muted-foreground">
                      Quickly decide which episodes deserve your full attention
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">Ask follow-up questions</span>
                    <p className="text-sm text-muted-foreground">
                      Use AI chat to dive deeper into any topic from the episode
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-3xl font-bold">5 min</div>
                <div className="text-sm text-muted-foreground">per episode summary</div>
              </Card>
              <Card className="p-4 text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <div className="text-3xl font-bold">20x</div>
                <div className="text-sm text-muted-foreground">faster than watching</div>
              </Card>
              <Card className="p-4 text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-3xl font-bold">AI chat</div>
                <div className="text-sm text-muted-foreground">ask about any episode</div>
              </Card>
              <Card className="p-4 text-center">
                <Mail className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-3xl font-bold">Daily</div>
                <div className="text-sm text-muted-foreground">digest emails</div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Simple pricing</h2>
          <p className="text-muted-foreground">
            Browse today's digest free. Subscribe for personalized digests and full access.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="p-8 border-primary/50 relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
              7-day free trial
            </Badge>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold mb-1">
                ${SUBSCRIPTION_PRICE}
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                No credit card required to start
              </p>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                Daily and weekly email digests
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                Personalized channel subscriptions
              </li>
              {/* <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                AI chat to ask questions about episodes
              </li> */}
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                Full archive access
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                Cancel anytime
              </li>
            </ul>
            <SignInDialog
              trigger={
                <Button className="w-full" size="lg">
                  Start Free Trial
                </Button>
              }
            />
          </Card>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to save hours every week?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Start your free trial and get daily digests of the best tech podcasts.
          </p>
          <SignInDialog
            trigger={
              <Button size="lg" className="gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-8">
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
