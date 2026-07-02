"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  Search,
  Settings,
  User,
} from "lucide-react";

import { http } from "@/lib/http";
import { useDebounce } from "@/hooks/use-debounce";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type SearchRow = { id: string; studentCode: string; fullName: string; classCode: string };

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Điểm rèn luyện", href: "/scores", icon: ClipboardList },
  { label: "Tra cứu", href: "/search", icon: Search },
  { label: "Thống kê", href: "/stats", icon: BarChart3 },
  { label: "Quản lý danh mục", href: "/admin", icon: Settings },
  { label: "Đổi mật khẩu", href: "/account/password", icon: KeyRound },
];

/** Bảng lệnh (Ctrl+K): tìm nhanh sinh viên + điều hướng. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);

  // Mở/đóng bằng Ctrl+K (hoặc ⌘K).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ["palette-search", debounced],
    queryFn: () => http.get<SearchRow[]>(`/api/search/students?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.trim().length >= 1,
  });

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Tìm sinh viên (MSSV/họ tên) hoặc điều hướng…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Không có kết quả.</CommandEmpty>
        {students.length > 0 && (
          <>
            <CommandGroup heading="Sinh viên">
              {students.slice(0, 8).map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => go(`/students/${s.id}`)}
                >
                  <User className="mr-2 h-4 w-4" />
                  {s.studentCode} — {s.fullName}
                  <span className="ml-auto text-xs text-muted-foreground">{s.classCode}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Điều hướng">
          {NAV.map((n) => (
            <CommandItem key={n.href} value={n.label} onSelect={() => go(n.href)}>
              <n.icon className="mr-2 h-4 w-4" />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
