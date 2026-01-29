import { NavLink } from "react-router-dom";
import { Home, Video, Radio, Star, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/use-favorites";

const navItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Videos",
    url: "/videos",
    icon: Video,
  },
  {
    title: "Channels",
    url: "/channels",
    icon: Radio,
  },
  {
    title: "People",
    url: "/people",
    icon: Users,
  },
  // AI Chat hidden until Stripe integration is complete
  // {
  //   title: "AI Chat",
  //   url: "/chat",
  //   icon: MessageSquare,
  // },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AppSidebar() {
  const { user } = useAuth();
  const { favorites } = useFavorites();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Decompress" className="h-8 w-8" />
          <span className="text-xl font-bold">Decompress</span>
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive ? "bg-accent" : ""
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && favorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              Favorites
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map((fav) => (
                  <SidebarMenuItem key={fav.id}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`/channels/${fav.source_id}`}
                        className={({ isActive }) =>
                          isActive ? "bg-accent" : ""
                        }
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage
                            src={fav.source?.thumbnail_url || undefined}
                            alt={fav.source?.name || "Channel"}
                          />
                          <AvatarFallback className="text-[10px]">
                            {fav.source?.name ? getInitials(fav.source.name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{fav.source?.name || "Channel"}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
