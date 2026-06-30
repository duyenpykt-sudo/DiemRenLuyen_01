"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Search,
  BarChart3,
  Settings,
  ScrollText,
  GraduationCap,
} from "lucide-react";

import { Role } from "@/lib/enums";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  // Vai trò được phép thấy mục này; rỗng = mọi vai trò.
  roles?: Role[];
};

// Điều hướng theo mục 8.1 PRD.
const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Sinh viên", href: "/students", icon: Users },
  { title: "Điểm rèn luyện", href: "/scores", icon: ClipboardList },
  { title: "Tra cứu", href: "/search", icon: Search },
  { title: "Thống kê", href: "/stats", icon: BarChart3 },
  {
    title: "Quản lý danh mục",
    href: "/admin",
    icon: Settings,
    roles: [Role.ADMIN],
  },
  { title: "Audit log", href: "/audit-logs", icon: ScrollText },
];

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Điểm Rèn luyện</span>
            <span className="text-xs text-muted-foreground">
              Khoa KHTN và CNTT
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chức năng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
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
