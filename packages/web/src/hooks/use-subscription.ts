import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Subscription {
  id: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface TokenUsage {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface TrialStatus {
  isInTrial: boolean;
  trialEndDate: Date | null;
  daysRemaining: number;
  trialExpired: boolean;
}

const TRIAL_DAYS = 7;

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setTokenUsage(null);
      setTrialStatus(null);
      setLoading(false);
      return;
    }

    async function fetchData() {
      if (!user) return;

      setLoading(true);

      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      setSubscription(subData);
      const isCurrentlySubscribed = subData?.status === "active";

      // Fetch profile for trial info
      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_started_at")
        .eq("id", user.id)
        .single();

      // Calculate trial status
      if (profile?.trial_started_at) {
        const trialStart = new Date(profile.trial_started_at);
        const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const now = new Date();
        const msRemaining = trialEnd.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

        setTrialStatus({
          isInTrial: daysRemaining > 0 && !isCurrentlySubscribed,
          trialEndDate: trialEnd,
          daysRemaining,
          trialExpired: daysRemaining === 0 && !isCurrentlySubscribed,
        });
      } else {
        // No trial_started_at - don't block the user, treat as having access
        setTrialStatus({
          isInTrial: !isCurrentlySubscribed,
          trialEndDate: null,
          daysRemaining: TRIAL_DAYS,
          trialExpired: false,
        });
      }

      // Fetch current month token usage
      const { data: usageData } = await supabase
        .from("user_monthly_usage")
        .select("*")
        .eq("user_id", user.id)
        .gte("month", new Date().toISOString().slice(0, 7) + "-01")
        .single();

      setTokenUsage(usageData);
      setLoading(false);
    }

    fetchData();
  }, [user]);

  const isSubscribed = subscription?.status === "active";
  const remainingBudget = tokenUsage
    ? Math.max(0, 4.0 - (tokenUsage.total_cost_usd || 0))
    : 4.0;
  const canUseAI = isSubscribed && remainingBudget > 0;
  const hasAccess = isSubscribed || (trialStatus?.isInTrial ?? false);

  return {
    subscription,
    tokenUsage,
    trialStatus,
    loading,
    isSubscribed,
    remainingBudget,
    canUseAI,
    hasAccess,
  };
}
