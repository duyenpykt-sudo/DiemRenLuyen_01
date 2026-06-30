"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Search, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Role } from "@/lib/enums";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  CVHT: "Cố vấn học tập",
  TRUONG_KHOA: "Trưởng khoa",
};

/** Lấy chữ cái đầu của họ tên làm avatar (vd "Hồ Thị Duyên" → "HD"). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar({
  fullName,
  role,
}: {
  fullName: string;
  role: Role;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Tra cứu nhanh: nhập MSSV/CCCD → Enter → mở trang chi tiết SV.
  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    try {
      const res = await fetch(`/api/students/lookup?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (res.ok && json.data?.id) {
        router.push(`/students/${json.data.id}`);
      } else {
        // Không khớp chính xác → chuyển sang trang tra cứu nâng cao.
        router.push(`/search?q=${encodeURIComponent(q)}`);
        toast.info("Không tìm thấy chính xác — mở tra cứu nâng cao.");
      }
    } catch {
      toast.error("Lỗi tra cứu.");
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 h-6" />

      {/* Thanh tìm kiếm global theo MSSV/CCCD */}
      <form onSubmit={onSearch} className="relative hidden w-full max-w-sm md:block">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo MSSV hoặc CCCD…"
          className="pl-8"
          aria-label="Tìm kiếm"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-accent">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium">{fullName}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{fullName}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {ROLE_LABEL[role]}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account/password">
                <UserIcon className="mr-2 h-4 w-4" />
                Đổi mật khẩu
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
