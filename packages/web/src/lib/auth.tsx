import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { usePostHog } from "posthog-js/react";
import { supabase } from "./supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Test mode bypass - only works in development
const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";
const TEST_USER_ID = import.meta.env.VITE_TEST_USER_ID;
const TEST_USER_EMAIL = import.meta.env.VITE_TEST_USER_EMAIL || "test@example.com";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const posthog = usePostHog();

  useEffect(() => {
    // Test mode bypass - skip real auth
    if (TEST_MODE && TEST_USER_ID) {
      console.warn("⚠️ Running in TEST MODE with bypassed auth");
      const fakeUser = {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
      } as User;
      setUser(fakeUser);
      setSession({ user: fakeUser } as Session);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Skip auth listener in test mode
    if (TEST_MODE && TEST_USER_ID) {
      return;
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only update state if values actually changed to prevent unnecessary re-renders
      setSession((prev) =>
        prev?.access_token === session?.access_token ? prev : session
      );
      setUser((prev) =>
        prev?.id === session?.user?.id ? prev : (session?.user ?? null)
      );

      // Identify user in PostHog when they sign in
      if (event === "SIGNED_IN" && session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
        });

        // Capture timezone only on signup (new user created within last minute)
        const createdAt = new Date(session.user.created_at);
        const now = new Date();
        const isNewUser = now.getTime() - createdAt.getTime() < 60000; // within 1 minute

        if (isNewUser) {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          supabase
            .from("profiles")
            .update({ timezone })
            .eq("id", session.user.id)
            .then(({ error }) => {
              if (error) {
                console.error("Failed to update timezone:", error);
              }
            });
        }
      }

      // Reset PostHog identity when user signs out
      if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [posthog]);

  const signInWithOtp = async (email: string) => {
    // Use VITE_APP_URL for production, fallback to window.location.origin for local dev
    const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithOtp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
