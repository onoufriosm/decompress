import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Mic, Users } from "lucide-react";

type TabFilter = "all" | "hosts" | "guests";

interface Person {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photo_url: string | null;
  social_links: Record<string, string> | null;
  host_count: number;
  guest_count: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const filteredPeople = useMemo(() => {
    switch (activeTab) {
      case "hosts":
        return people.filter((p) => p.host_count > 0);
      case "guests":
        return people.filter((p) => p.guest_count > 0);
      default:
        return people;
    }
  }, [people, activeTab]);

  useEffect(() => {
    async function fetchPeople() {
      setLoading(true);

      // Get all people with counts of their appearances
      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("*")
        .order("name", { ascending: true });

      if (peopleError) {
        console.error("Error fetching people:", peopleError);
        setPeople([]);
        setLoading(false);
        return;
      }

      if (!peopleData || peopleData.length === 0) {
        setPeople([]);
        setLoading(false);
        return;
      }

      // Get host counts from source_people
      const { data: hostCounts } = await supabase
        .from("source_people")
        .select("person_id")
        .eq("role", "host");

      // Get guest counts from video_people
      const { data: guestCounts } = await supabase
        .from("video_people")
        .select("person_id")
        .eq("role", "guest");

      // Create count maps
      const hostCountMap: Record<string, number> = {};
      const guestCountMap: Record<string, number> = {};

      hostCounts?.forEach((h) => {
        hostCountMap[h.person_id] = (hostCountMap[h.person_id] || 0) + 1;
      });

      guestCounts?.forEach((g) => {
        guestCountMap[g.person_id] = (guestCountMap[g.person_id] || 0) + 1;
      });

      // Combine data
      let enrichedPeople: Person[] = peopleData.map((p) => ({
        ...p,
        host_count: hostCountMap[p.id] || 0,
        guest_count: guestCountMap[p.id] || 0,
      }));

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        enrichedPeople = enrichedPeople.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.bio?.toLowerCase().includes(searchLower)
        );
      }

      // Sort by total appearances (hosts + guests)
      enrichedPeople.sort(
        (a, b) => b.host_count + b.guest_count - (a.host_count + a.guest_count)
      );

      setPeople(enrichedPeople);
      setLoading(false);
    }

    const debounce = setTimeout(fetchPeople, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">People</h1>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="hosts">Hosts</TabsTrigger>
            <TabsTrigger value="guests">Guests</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
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
      ) : filteredPeople.length === 0 ? (
        <p className="text-muted-foreground">No people found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPeople.map((person) => (
            <Link key={person.id} to={`/people/${person.id}`}>
              <Card className="p-4 hover:shadow-lg transition-shadow h-full">
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage
                      src={person.photo_url || undefined}
                      alt={person.name}
                    />
                    <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate hover:underline">
                      {person.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {person.host_count > 0 && (
                        <Badge variant="default" className="text-xs">
                          <Mic className="h-3 w-3 mr-1" />
                          Host of {person.host_count} channel
                          {person.host_count !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {person.guest_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {person.guest_count} appearance
                          {person.guest_count !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {person.bio && (
                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                    {person.bio}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
