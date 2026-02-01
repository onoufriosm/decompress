import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { useAuth } from "@/lib/auth";
import { SUBSCRIPTION_PRICE } from "@/lib/stripe";
import {
  Sparkles,
  Mail,
  Clock,
  Play,
  ArrowRight,
  Check,
  Zap,
  Brain,
  MessageSquare,
  Loader2,
} from "lucide-react";

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
            <span className="font-bold text-xl">Decompress</span>
          </Link>
          <div className="flex items-center gap-4">
            <SignInDialog
              trigger={<Button variant="ghost">Sign In</Button>}
            />
            <SignInDialog
              trigger={<Button>Start Free Trial</Button>}
            />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-6">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered Podcast & Video Summaries
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Stay informed in{" "}
            <span className="text-primary">minutes</span>, not hours
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get AI-generated summaries of your favorite podcasts and YouTube channels.
            Never miss an insight, even when you're short on time.
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
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            7-day free trial · No credit card required
          </p>
        </div>
      </section>

      {/* Social Proof / Credibility */}
      <section className="border-y bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="max-w-3xl mx-auto">
            <Card className="p-6 md:p-8 bg-background">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg md:text-xl text-foreground leading-relaxed mb-4">
                    "Top executives and tech leaders are increasingly turning to AI summaries
                    to keep up with long-form content. Microsoft's CEO has spoken about using
                    AI to consume podcasts more efficiently — a growing trend among busy professionals
                    who want insights without the time investment."
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Join the productivity revolution
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How it works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Decompress monitors your favorite channels and delivers concise summaries
            so you can stay informed effortlessly.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Play className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Pick Your Channels</h3>
            <p className="text-muted-foreground text-sm">
              Favorite the podcasts and YouTube channels you care about.
              We track new uploads automatically.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">AI Summaries</h3>
            <p className="text-muted-foreground text-sm">
              Our AI generates concise summaries capturing key insights,
              so you get the value without the full runtime.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Daily Digest</h3>
            <p className="text-muted-foreground text-sm">
              Get a daily email with new videos from your channels,
              complete with summaries ready to scan.
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
                Reclaim your time without missing out
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">Save hours every week</span>
                    <p className="text-sm text-muted-foreground">
                      Read a 5-minute summary instead of watching 2-hour podcasts
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">Never miss important insights</span>
                    <p className="text-sm text-muted-foreground">
                      AI captures key points, quotes, and actionable takeaways
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">Decide what deserves full attention</span>
                    <p className="text-sm text-muted-foreground">
                      Use summaries to prioritize which episodes to watch completely
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-3xl font-bold">5 min</div>
                <div className="text-sm text-muted-foreground">Average summary read time</div>
              </Card>
              <Card className="p-4 text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <div className="text-3xl font-bold">10x</div>
                <div className="text-sm text-muted-foreground">Faster than watching</div>
              </Card>
              <Card className="p-4 text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <div className="text-3xl font-bold">AI Chat</div>
                <div className="text-sm text-muted-foreground">Ask questions about content</div>
              </Card>
              <Card className="p-4 text-center">
                <Mail className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <div className="text-3xl font-bold">Daily</div>
                <div className="text-sm text-muted-foreground">Email digests</div>
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
            Start with a free trial, upgrade when you're ready
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
                Unlimited channel subscriptions
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                AI-generated video summaries
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                Daily email digests
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                AI chat with video content
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
            Ready to stay informed without the time sink?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join Decompress and turn hours of content into minutes of insights.
          </p>
          <SignInDialog
            trigger={<Button size="lg">Get Started Free</Button>}
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
