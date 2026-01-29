import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const MONTHLY_QUERY_LIMIT = 200;

interface QueryUsage {
  queriesUsed: number;
  queriesRemaining: number;
  limitReached: boolean;
}

export function useQueryUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<QueryUsage>({
    queriesUsed: 0,
    queriesRemaining: MONTHLY_QUERY_LIMIT,
    limitReached: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setUsage({
        queriesUsed: 0,
        queriesRemaining: MONTHLY_QUERY_LIMIT,
        limitReached: false,
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use the database function to get monthly query count
    const { data, error } = await supabase.rpc("get_monthly_query_count", {
      check_user_id: user.id,
    });

    const queriesUsed = error ? 0 : (data as number) || 0;
    const queriesRemaining = Math.max(0, MONTHLY_QUERY_LIMIT - queriesUsed);

    setUsage({
      queriesUsed,
      queriesRemaining,
      limitReached: queriesRemaining <= 0,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    ...usage,
    loading,
    refresh: fetchUsage,
    limit: MONTHLY_QUERY_LIMIT,
  };
}
