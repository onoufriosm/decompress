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

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setTokenUsage(null);
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

  return {
    subscription,
    tokenUsage,
    loading,
    isSubscribed,
    remainingBudget,
    canUseAI,
  };
}
