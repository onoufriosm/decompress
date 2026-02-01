import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Sparkles, LogOut } from "lucide-react";
import { SUBSCRIPTION_PRICE } from "@/lib/stripe";

export function TrialExpiredScreen() {
  const { signOut } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleSubscribe = async () => {
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Sparkles className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Your free trial has ended</CardTitle>
          <CardDescription>
            Subscribe to continue using Decompress and all its features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-center text-2xl font-bold">
              ${SUBSCRIPTION_PRICE}
              <span className="text-base font-normal text-muted-foreground">/month</span>
            </p>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Unlimited access to all channels and videos</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>Daily email digests from your favorite channels</span>
            </li>
            <li className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>AI-powered chat with video content</span>
            </li>
            {/* <li className="flex items-center gap-3 text-sm">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>${MONTHLY_TOKEN_LIMIT_USD} monthly AI budget</span>
            </li> */}
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubscribe}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Subscribe Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
