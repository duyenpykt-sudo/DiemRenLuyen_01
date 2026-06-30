"use client";

import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Tải file từ URL (Content-Disposition: attachment → trình duyệt tự tải).
function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ExportMenu({
  classId,
  semesterId,
  academicYearId,
  cohortId,
}: {
  classId: string;
  semesterId: string;
  academicYearId: string;
  cohortId: string;
}) {
  // Lấy vai trò để quyết định hiển thị mục "Tổng hợp khoa".
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      return (await res.json()) as { user?: { role?: string } };
    },
  });
  const role = session?.user?.role;
  const canFacultySummary = role === "ADMIN" || role === "TRUONG_KHOA";

  const base = "/api/export/excel";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Xuất Excel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theo lớp</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            download(`${base}?type=class-semester&classId=${classId}&semesterId=${semesterId}`)
          }
        >
          Bảng điểm học kỳ
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            download(`${base}?type=class-year&classId=${classId}&academicYearId=${academicYearId}`)
          }
        >
          Tổng hợp năm học
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => download(`${base}?type=class-cohort&classId=${classId}`)}
        >
          Tổng hợp khóa học
        </DropdownMenuItem>

        {canFacultySummary && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tổng hợp khoa</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                download(`${base}?type=faculty-summary&scope=HK&semesterId=${semesterId}`)
              }
            >
              Theo học kỳ (TONG HOP-HK)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                download(`${base}?type=faculty-summary&scope=NH&academicYearId=${academicYearId}`)
              }
            >
              Theo năm học (TONG HOP-NH)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                download(`${base}?type=faculty-summary&scope=TK&cohortId=${cohortId}`)
              }
            >
              Theo khóa học (TONG HOP-TK)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
