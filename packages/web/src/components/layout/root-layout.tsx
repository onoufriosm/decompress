import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/use-subscription";
import { TrialExpiredScreen } from "@/components/subscription/trial-expired-screen";
// import { TrialBanner } from "@/components/subscription/trial-banner";
import { Loader2 } from "lucide-react";

export function RootLayout() {
  const { user } = useAuth();
  const { trialStatus, isSubscribed, loading } = useSubscription();

  // Show loading while checking subscription/trial status
  if (user && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Block users with expired trials who are not subscribed
  if (user && trialStatus?.trialExpired && !isSubscribed) {
    return <TrialExpiredScreen />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Trial banner hidden for now - uncomment to show upgrade option during trial */}
        {/* {user && trialStatus?.isInTrial && (
          <TrialBanner daysRemaining={trialStatus.daysRemaining} />
        )} */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
