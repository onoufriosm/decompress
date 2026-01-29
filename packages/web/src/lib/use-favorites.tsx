import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

interface FavoriteChannel {
  id: string;
  source_id: string;
  created_at: string;
  source?: {
    id: string;
    name: string;
    handle: string | null;
    thumbnail_url: string | null;
    subscriber_count: number | null;
  };
}

interface FavoritesContextValue {
  favorites: FavoriteChannel[];
  favoriteIds: Set<string>;
  loading: boolean;
  isFavorite: (sourceId: string) => boolean;
  addFavorite: (sourceId: string) => Promise<{ error: Error | null }>;
  removeFavorite: (sourceId: string) => Promise<{ error: Error | null }>;
  toggleFavorite: (sourceId: string) => Promise<{ error: Error | null }>;
  refetch: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch all favorites for the current user
  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("user_favorite_channels")
      .select(`
        id,
        source_id,
        created_at,
        source:sources(id, name, handle, thumbnail_url, subscriber_count)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching favorites:", error);
      setFavorites([]);
      setFavoriteIds(new Set());
    } else {
      // Transform data to match FavoriteChannel interface
      // Supabase returns joined data as arrays, we need the first item
      const transformed = (data || []).map((f) => ({
        ...f,
        source: Array.isArray(f.source) ? f.source[0] : f.source,
      })) as FavoriteChannel[];
      setFavorites(transformed);
      setFavoriteIds(new Set(transformed.map((f) => f.source_id)));
    }
    setLoading(false);
  }, [user]);

  // Check if a channel is favorited
  const isFavorite = useCallback(
    (sourceId: string) => {
      return favoriteIds.has(sourceId);
    },
    [favoriteIds]
  );

  // Add a channel to favorites
  const addFavorite = useCallback(
    async (sourceId: string) => {
      if (!user) return { error: new Error("Not authenticated") };

      // Optimistic update
      setFavoriteIds((prev) => new Set([...prev, sourceId]));

      const { error } = await supabase.from("user_favorite_channels").insert({
        user_id: user.id,
        source_id: sourceId,
      });

      if (error) {
        console.error("Error adding favorite:", error);
        // Revert optimistic update
        setFavoriteIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(sourceId);
          return newSet;
        });
        return { error };
      }

      // Fetch full data for sidebar
      await fetchFavorites();
      return { error: null };
    },
    [user, fetchFavorites]
  );

  // Remove a channel from favorites
  const removeFavorite = useCallback(
    async (sourceId: string) => {
      if (!user) return { error: new Error("Not authenticated") };

      // Optimistic update
      setFavoriteIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(sourceId);
        return newSet;
      });

      const { error } = await supabase
        .from("user_favorite_channels")
        .delete()
        .eq("user_id", user.id)
        .eq("source_id", sourceId);

      if (error) {
        console.error("Error removing favorite:", error);
        // Revert optimistic update
        setFavoriteIds((prev) => new Set([...prev, sourceId]));
        return { error };
      }

      // Fetch updated list for sidebar
      await fetchFavorites();
      return { error: null };
    },
    [user, fetchFavorites]
  );

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (sourceId: string) => {
      if (isFavorite(sourceId)) {
        return removeFavorite(sourceId);
      } else {
        return addFavorite(sourceId);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  // Fetch favorites when user changes
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const value: FavoritesContextValue = {
    favorites,
    favoriteIds,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refetch: fetchFavorites,
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }

  return context;
}
