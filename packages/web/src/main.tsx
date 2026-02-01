import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PostHogProvider } from "posthog-js/react";
import "./index.css";

import { AuthProvider } from "./lib/auth";
import { FavoritesProvider } from "./lib/use-favorites";
import { RootLayout } from "./components/layout/root-layout";
import { ProtectedRoute } from "./components/auth/protected-route";
import { LandingPage } from "./routes/landing";
import { HomePage } from "./routes/home";
import { VideosPage } from "./routes/videos";
import { VideoDetailPage } from "./routes/video-detail";
import { ChannelsPage } from "./routes/channels";
import { ChannelDetailPage } from "./routes/channel-detail";
import { PeoplePage } from "./routes/people";
import { PersonDetailPage } from "./routes/person-detail";
// AI Chat hidden until Stripe integration is complete
// import { ChatPage } from "./routes/chat";
import { AuthCallbackPage } from "./routes/auth-callback";
import { TermsPage } from "./routes/terms";
import { PrivacyPage } from "./routes/privacy";

const router = createBrowserRouter([
  // Public route - landing page (redirects to /home if authenticated)
  {
    path: "/",
    element: <LandingPage />,
  },
  // Auth callback (must be accessible without auth)
  {
    path: "/auth/callback",
    element: <AuthCallbackPage />,
  },
  // Public pages
  {
    path: "/terms",
    element: <TermsPage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPage />,
  },
  // Protected routes - require authentication
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RootLayout />,
        children: [
          {
            path: "home",
            element: <HomePage />,
          },
          {
            path: "videos",
            element: <VideosPage />,
          },
          {
            path: "videos/:id",
            element: <VideoDetailPage />,
          },
          {
            path: "channels",
            element: <ChannelsPage />,
          },
          {
            path: "channels/:id",
            element: <ChannelDetailPage />,
          },
          {
            path: "people",
            element: <PeoplePage />,
          },
          {
            path: "people/:id",
            element: <PersonDetailPage />,
          },
          // AI Chat hidden until Stripe integration is complete
          // {
          //   path: "chat",
          //   element: <ChatPage />,
          // },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: "2025-05-24",
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
      }}
    >
      <AuthProvider>
        <FavoritesProvider>
          <RouterProvider router={router} />
        </FavoritesProvider>
      </AuthProvider>
    </PostHogProvider>
  </StrictMode>
);