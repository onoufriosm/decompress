import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FilterPanel } from "@/components/filter-panel";
import { FavoriteButton } from "@/components/favorite-button";
import { RequestChannelDialog } from "@/components/request-channel-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Video, Clock } from "lucide-react";

type TabFilter = "all" | "favorites";

interface Channel {
  id: string;
  external_id: string;
  name: string;
  handle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  subscriber_count: number | null;
  video_count: number | null;
  last_scraped_at: string | null;
}

interface ChannelRequest {
  id: string;
  channel_input: string;
  status: string;
  created_at: string;
}

function formatSubscriberCount(count: number | null): string {
  if (!count) return "";
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M subscribers`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K subscribers`;
  }
  return `${count} subscribers`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChannelsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelRequests, setChannelRequests] = useState<ChannelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("favorites");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Fetch user's favorite channels
  useEffect(() => {
    // Wait for auth to finish loading before fetching favorites
    if (authLoading) return;

    async function fetchFavorites() {
      if (!user) {
        setFavoriteIds(new Set());
        setActiveTab("all");
        setFavoritesLoaded(true);
        return;
      }

      const { data } = await supabase
        .from("user_favorite_channels")
        .select("source_id")
        .eq("user_id", user.id);

      const ids = new Set(data?.map((f) => f.source_id) || []);
      setFavoriteIds(ids);
      // Default to "all" if user has no favorites
      if (ids.size === 0) {
        setActiveTab("all");
      }
      setFavoritesLoaded(true);
    }

    fetchFavorites();

    // Subscribe to changes in favorites
    const channel = supabase
      .channel("favorites-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_favorite_channels",
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  const filteredChannels = useMemo(() => {
    if (activeTab === "favorites") {
      return channels.filter((c) => favoriteIds.has(c.id));
    }
    return channels;
  }, [channels, activeTab, favoriteIds]);

  useEffect(() => {
    async function fetchChannels() {
      setLoading(true);

      // If we have category filters, we need to get the source IDs first
      let filteredSourceIds: string[] | null = null;

      if (selectedCategories.length > 0) {
        const { data: categorizedSources } = await supabase
          .from("source_categories")
          .select("source_id")
          .in("category_id", selectedCategories);

        const categorySourceIds =
          categorizedSources?.map((s) => s.source_id) || [];
        filteredSourceIds = categorySourceIds;
      }

      // If filters returned no results, show empty
      if (filteredSourceIds !== null && filteredSourceIds.length === 0) {
        setChannels([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("sources")
        .select("*")
        .eq("type", "youtube_channel")
        .order("name", { ascending: true });

      // Apply source ID filter from categories
      if (filteredSourceIds !== null) {
        query = query.in("id", filteredSourceIds);
      }

      // Apply text search
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,handle.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching channels:", error);
        setChannels([]);
      } else {
        setChannels(data || []);
      }
      setLoading(false);
    }

    const debounce = setTimeout(fetchChannels, 300);
    return () => clearTimeout(debounce);
  }, [search, selectedCategories]);

  // Fetch user's channel requests
  useEffect(() => {
    async function fetchChannelRequests() {
      if (!user) {
        setChannelRequests([]);
        return;
      }

      const { data, error } = await supabase
        .from("channel_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching channel requests:", error);
        setChannelRequests([]);
      } else {
        setChannelRequests(data || []);
      }
    }

    fetchChannelRequests();
  }, [user]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Channels</h1>
          <RequestChannelDialog />
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabFilter)}
          className="mb-4"
        >
          <TabsList>
            <TabsTrigger value="favorites" disabled={favoritesLoaded && favoriteIds.size === 0}>
              Favorites
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {!loading && (
          <p className="text-sm text-muted-foreground mb-4">
            {filteredChannels.length} {activeTab === "favorites" ? "favorite" : "channel"}
            {filteredChannels.length !== 1 ? "s" : ""} total
          </p>
        )}
        <FilterPanel
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          entityType="channel"
        />
      </div>

      {/* User's pending channel requests */}
      {channelRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Your Requests</h2>
          <div className="flex flex-wrap gap-2">
            {channelRequests.map((request) => (
              <Tooltip key={request.id}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm cursor-default">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{request.channel_input}</span>
                    <Badge
                      variant={request.status === "pending" ? "secondary" : "default"}
                      className="text-xs"
                    >
                      {request.status}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-[300px] break-all">{request.channel_input}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-1" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredChannels.length === 0 ? (
        <p className="text-muted-foreground">
          {activeTab === "favorites" ? "No favorite channels yet." : "No channels found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map((channel) => (
            <Card
              key={channel.id}
              className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/channels/${channel.id}`)}
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={channel.thumbnail_url || undefined}
                    alt={channel.name}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback>{getInitials(channel.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold truncate">{channel.name}</h3>
                    <FavoriteButton sourceId={channel.id} variant="icon" size="sm" />
                  </div>
                  {channel.handle && (
                    <p className="text-sm text-muted-foreground truncate">
                      {channel.handle}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {channel.subscriber_count && (
                      <Badge variant="secondary" className="text-xs">
                        {formatSubscriberCount(channel.subscriber_count)}
                      </Badge>
                    )}
                    {channel.video_count && (
                      <Badge variant="outline" className="text-xs">
                        <Video className="h-3 w-3 mr-1" />
                        {channel.video_count} videos
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {channel.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                  {channel.description}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
