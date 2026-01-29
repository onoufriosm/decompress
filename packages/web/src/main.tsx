import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import { AuthProvider } from "./lib/auth";
import { FavoritesProvider } from "./lib/use-favorites";
import { RootLayout } from "./components/layout/root-layout";
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

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
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
  {
    path: "/auth/callback",
    element: <AuthCallbackPage />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <FavoritesProvider>
        <RouterProvider router={router} />
      </FavoritesProvider>
    </AuthProvider>
  </StrictMode>
);
