"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { http } from "@/lib/http";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";

type StudentListRow = {
  id: string;
  studentCode: string;
  citizenId: string;
  fullName: string;
  classCode: string;
};

export default function StudentsListPage() {
  // Lấy toàn bộ SV trong phạm vi xem được (CVHT: lớp mình, TK: khoa mình, Admin: tất cả).
  const { data = [], isLoading } = useQuery({
    queryKey: ["students", "list"],
    queryFn: () => http.get<StudentListRow[]>("/api/search/students"),
  });

  const columns: Column<StudentListRow>[] = [
    { key: "studentCode", header: "MSSV", sortable: true, accessor: (r) => r.studentCode },
    { key: "fullName", header: "Họ tên", sortable: true, accessor: (r) => r.fullName },
    { key: "citizenId", header: "CCCD", accessor: (r) => r.citizenId },
    { key: "classCode", header: "Lớp", sortable: true, accessor: (r) => r.classCode },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sinh viên</h1>
        <p className="text-muted-foreground">
          Danh sách sinh viên. Bấm &quot;Chi tiết&quot; để xem điểm các học kỳ và biểu đồ.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        searchAccessor={(r) => `${r.studentCode} ${r.fullName} ${r.citizenId} ${r.classCode}`}
        searchPlaceholder="Tìm theo MSSV, họ tên, CCCD, lớp…"
        emptyText="Chưa có sinh viên trong phạm vi của bạn."
        actions={(row) => (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/students/${row.id}`}>Chi tiết</Link>
          </Button>
        )}
      />
    </div>
  );
}
