import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrialBannerProps {
  daysRemaining: number;
}

export function TrialBanner({ daysRemaining }: TrialBannerProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const isUrgent = daysRemaining <= 2;

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { return_url: window.location.origin },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2 border-b",
        isUrgent ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className={cn("h-4 w-4", isUrgent ? "text-amber-600" : "text-blue-600")} />
        <span className={cn("text-sm font-medium", isUrgent ? "text-amber-800" : "text-blue-800")}>
          {daysRemaining === 1
            ? "1 day left in trial"
            : `${daysRemaining} days left in trial`}
        </span>
        {isUrgent && (
          <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
            Ending soon
          </Badge>
        )}
      </div>
      <Button
        size="sm"
        variant={isUrgent ? "default" : "outline"}
        onClick={handleUpgrade}
        disabled={checkoutLoading}
        className={cn(!isUrgent && "border-blue-300 text-blue-700 hover:bg-blue-100")}
      >
        {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade"}
      </Button>
    </div>
  );
}
