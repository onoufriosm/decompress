import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home, Video, Radio, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Home",
    url: "/home",
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

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();
  const location = useLocation();

  // Close mobile sidebar when navigating to a new page
  useEffect(() => {
    setOpenMobile(false);
  }, [location.pathname, setOpenMobile]);

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
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url ||
                  location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
