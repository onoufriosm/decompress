import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/use-subscription";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Check, Loader2, Clock, AlertTriangle } from "lucide-react";
import { SUBSCRIPTION_PRICE } from "@/lib/stripe";

export function SubscriptionPage() {
  const { user } = useAuth();
  const { subscription, trialStatus, loading, isSubscribed } = useSubscription();
  const [actionLoading, setActionLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { return_url: `${window.location.origin}/subscription` },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { return_url: `${window.location.origin}/subscription` },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card className="mb-6">
          <CardHeader>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Subscription</h1>

      {/* Subscription Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Status
            </CardTitle>
            {isSubscribed ? (
              <Badge variant="default">Active</Badge>
            ) : trialStatus?.isInTrial ? (
              <Badge variant="secondary">Trial</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isSubscribed ? (
            <div className="space-y-2">
              <p className="text-sm">
                You're subscribed to <strong>Decompress Pro</strong>.
              </p>
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  {subscription.cancel_at_period_end ? (
                    <span className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      Your subscription ends on {new Date(subscription.current_period_end).toLocaleDateString()}
                    </span>
                  ) : (
                    <>Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}</>
                  )}
                </p>
              )}
            </div>
          ) : trialStatus?.isInTrial ? (
            <div className="space-y-2">
              <p className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  <strong>{trialStatus.daysRemaining} days</strong> remaining in your free trial
                </span>
              </p>
              {trialStatus.trialEndDate && (
                <p className="text-sm text-muted-foreground">
                  Trial ends on {trialStatus.trialEndDate.toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You don't have an active subscription. Subscribe to access all features.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pro Plan</CardTitle>
          <CardDescription>
            ${SUBSCRIPTION_PRICE}/month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              5-minute summaries of 2-hour podcasts
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Daily and weekly email digests
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Personalized channel subscriptions
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              Full archive access
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          {isSubscribed ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageSubscription}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Manage Subscription
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={handleSubscribe}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Subscribe Now
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Help Text */}
      <p className="text-xs text-muted-foreground text-center">
        Manage your payment method, view invoices, or cancel your subscription through the Stripe billing portal.
      </p>
    </div>
  );
}
