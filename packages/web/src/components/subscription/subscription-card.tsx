import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/use-subscription";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles } from "lucide-react";
import { SUBSCRIPTION_PRICE, MONTHLY_TOKEN_LIMIT_USD } from "@/lib/stripe";
import { SignInDialog } from "@/components/auth/sign-in-dialog";

export function SubscriptionCard() {
  const { user } = useAuth();
  const { subscription, tokenUsage, loading, isSubscribed } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) return;

    setCheckoutLoading(true);
    try {
      // Call Supabase Edge Function to create checkout session
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { return_url: window.location.origin },
      });

      if (error) throw error;

      // Redirect to Stripe Checkout
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setCheckoutLoading(true);
    try {
      // Call Supabase Edge Function to create portal session
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { return_url: window.location.origin },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI Features
          </CardTitle>
          <CardDescription>
            Sign in to access AI-powered features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 mb-4">
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Ask questions about video content
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Get AI-generated summaries
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Chat with multiple videos at once
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <SignInDialog
            trigger={<Button className="w-full">Sign in to Subscribe</Button>}
          />
        </CardFooter>
      </Card>
    );
  }

  if (isSubscribed) {
    const usedBudget = tokenUsage?.total_cost_usd || 0;
    const usagePercent = (usedBudget / MONTHLY_TOKEN_LIMIT_USD) * 100;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Pro Subscription
            </CardTitle>
            <Badge variant="secondary">Active</Badge>
          </div>
          <CardDescription>
            ${SUBSCRIPTION_PRICE}/month · ${MONTHLY_TOKEN_LIMIT_USD} AI budget
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>AI Usage This Month</span>
              <span>${usedBudget.toFixed(2)} / ${MONTHLY_TOKEN_LIMIT_USD.toFixed(2)}</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>
          {subscription?.cancel_at_period_end && (
            <p className="text-sm text-amber-600">
              Your subscription will end on{" "}
              {new Date(subscription.current_period_end!).toLocaleDateString()}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleManageSubscription}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Manage Subscription
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Upgrade to Pro
        </CardTitle>
        <CardDescription>
          ${SUBSCRIPTION_PRICE}/month for AI-powered features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-4">
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Ask questions about video content
          </li>
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Get AI-generated summaries
          </li>
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Chat with multiple videos at once
          </li>
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            ${MONTHLY_TOKEN_LIMIT_USD} monthly AI budget
          </li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleSubscribe} disabled={checkoutLoading}>
          {checkoutLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Subscribe Now
        </Button>
      </CardFooter>
    </Card>
  );
}
