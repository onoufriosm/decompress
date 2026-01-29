import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Auth fixture for e2e tests.
 *
 * Method 1 - Email/Password Authentication (recommended):
 * Set these environment variables:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Your Supabase anon key
 * - TEST_USER_EMAIL: Email of the test user
 * - TEST_USER_PASSWORD: Password of the test user
 *
 * Method 2 - Direct Token (for CI or if password auth not available):
 * - TEST_USER_ACCESS_TOKEN: Supabase access token
 * - TEST_USER_REFRESH_TOKEN: Supabase refresh token
 *
 * To create a test user:
 * 1. Sign up in the app or create via Supabase dashboard
 * 2. Use email/password or extract tokens from localStorage
 */

interface AuthFixtures {
  authenticatedPage: import("@playwright/test").Page;
}

// Cache the session to avoid re-authenticating for each test
let cachedSession: {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
} | null = null;

async function getAuthSession() {
  // Return cached session if available
  if (cachedSession) {
    return cachedSession;
  }

  // Method 1: Use email/password to sign in
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (supabaseUrl && supabaseAnonKey && email && password) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Failed to sign in test user:", error.message);
      return null;
    }

    if (data.session) {
      cachedSession = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email || email,
        },
      };
      return cachedSession;
    }
  }

  // Method 2: Use pre-provided tokens
  const accessToken = process.env.TEST_USER_ACCESS_TOKEN;
  const refreshToken = process.env.TEST_USER_REFRESH_TOKEN;

  if (accessToken && refreshToken) {
    cachedSession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: "test-user-id",
        email: email || "test@example.com",
      },
    };
    return cachedSession;
  }

  return null;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    const session = await getAuthSession();

    if (!session) {
      console.warn(
        "No authentication configured. Set TEST_USER_EMAIL + TEST_USER_PASSWORD, or TEST_USER_ACCESS_TOKEN + TEST_USER_REFRESH_TOKEN"
      );
      await use(page);
      return;
    }

    // Get the Supabase project ref from URL
    const supabaseUrl =
      process.env.SUPABASE_URL || "https://bfoqdsspjxjbbskhtkpc.supabase.co";
    const projectRef =
      supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || "bfoqdsspjxjbbskhtkpc";

    // Create the auth token object that Supabase expects
    const authToken = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: session.user.id,
        email: session.user.email,
        aud: "authenticated",
        role: "authenticated",
      },
    };

    // Navigate to the app first to set the correct origin for localStorage
    await page.goto("/");

    // Set the Supabase auth token in localStorage
    await page.evaluate(
      ({ projectRef, authToken }) => {
        localStorage.setItem(
          `sb-${projectRef}-auth-token`,
          JSON.stringify(authToken)
        );
      },
      { projectRef, authToken }
    );

    // Reload to apply the authentication
    await page.reload();
    await page.waitForLoadState("networkidle");

    await use(page);
  },
});

export { expect };
