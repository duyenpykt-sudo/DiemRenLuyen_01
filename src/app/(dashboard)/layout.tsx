import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { Role } from "@/lib/enums";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bảo vệ thêm ở tầng layout (ngoài middleware): chưa đăng nhập → về /login.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, role } = session.user;

  return (
    <SidebarProvider>
      <AppSidebar role={role as Role} />
      <SidebarInset>
        <Topbar fullName={name ?? "Người dùng"} role={role as Role} />
        <div className="flex-1 animate-fade-up p-4 md:p-6">{children}</div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
