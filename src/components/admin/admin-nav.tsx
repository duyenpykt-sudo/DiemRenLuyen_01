"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/faculties", label: "Khoa" },
  { href: "/admin/cohorts", label: "Khóa học" },
  { href: "/admin/academic-years", label: "Năm học" },
  { href: "/admin/classes", label: "Lớp" },
  { href: "/admin/students", label: "Sinh viên" },
  { href: "/admin/users", label: "Người dùng" },
  { href: "/admin/backup", label: "Sao lưu" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
