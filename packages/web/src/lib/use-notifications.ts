import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Notification {
  id: string;
  user_id: string;
  type: "new_video" | "new_summary";
  title: string;
  message: string | null;
  video_id: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface NewVideo {
  video_id: string;
  video_title: string;
  video_thumbnail_url: string | null;
  video_duration_seconds: number | null;
  video_published_at: string | null;
  video_summary: string | null;
  source_id: string;
  source_name: string;
  source_thumbnail_url: string | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } else {
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.read_at).length);
    }
    setLoading(false);
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [user]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    }
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (!error) {
        const notification = notifications.find((n) => n.id === notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (notification && !notification.read_at) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    },
    [user, notifications]
  );

  // Set up realtime subscription
  useEffect(() => {
    if (!user) {
      // Clean up any existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchNotifications();

    // Subscribe to realtime changes for this user's notifications
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Add new notification to the top of the list
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Update the notification in the list
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );
          // Recalculate unread count
          setNotifications((prev) => {
            setUnreadCount(prev.filter((n) => !n.read_at).length);
            return prev;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Remove the notification from the list
          const deletedId = (payload.old as { id: string }).id;
          setNotifications((prev) => {
            const notification = prev.find((n) => n.id === deletedId);
            if (notification && !notification.read_at) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }
            return prev.filter((n) => n.id !== deletedId);
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup on unmount or user change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}

export function useNewVideosSinceLastVisit() {
  const { user } = useAuth();
  const [newVideos, setNewVideos] = useState<NewVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNewVideos = useCallback(async () => {
    if (!user) {
      setNewVideos([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Call the database function to get new videos
    const { data, error } = await supabase.rpc("get_new_videos_since_last_visit", {
      check_user_id: user.id,
    });

    if (error) {
      console.error("Error fetching new videos:", error);
      setNewVideos([]);
    } else {
      setNewVideos(data || []);
    }
    setLoading(false);
  }, [user]);

  // Update last visit time
  const updateLastVisit = useCallback(async () => {
    if (!user) return;

    await supabase.rpc("update_user_last_visit", {
      check_user_id: user.id,
    });
  }, [user]);

  useEffect(() => {
    fetchNewVideos();
  }, [fetchNewVideos]);

  return {
    newVideos,
    loading,
    updateLastVisit,
    refetch: fetchNewVideos,
  };
}
