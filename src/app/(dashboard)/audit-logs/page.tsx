"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { http } from "@/lib/http";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { username: string; fullName: string };
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Tạo",
  UPDATE: "Sửa",
  DELETE: "Xóa",
  LOCK: "Khóa HK",
  UNLOCK: "Mở HK",
  SEED_EXCEL: "Seed Excel",
  IMPORT_EXCEL: "Import Excel",
  EXPORT_EXCEL: "Export Excel",
};
const ENTITY_LABEL: Record<string, string> = {
  Faculty: "Khoa",
  Cohort: "Khóa học",
  AcademicYear: "Năm học",
  Semester: "Học kỳ",
  Class: "Lớp",
  Student: "Sinh viên",
  User: "Người dùng",
  ConductScore: "Điểm rèn luyện",
};

const ALL = "__all__";

function pretty(json: string | null): string {
  if (!json) return "—";
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

export default function AuditLogsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => http.get<AuditLogRow[]>("/api/audit-logs"),
  });

  const [action, setAction] = useState(ALL);
  const [entityType, setEntityType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  // Tùy chọn lọc lấy từ dữ liệu hiện có.
  const actionOptions = useMemo(
    () => Array.from(new Set(data.map((d) => d.action))).sort(),
    [data]
  );
  const entityOptions = useMemo(
    () => Array.from(new Set(data.map((d) => d.entityType))).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 : null; // hết ngày
    return data.filter((d) => {
      if (action !== ALL && d.action !== action) return false;
      if (entityType !== ALL && d.entityType !== entityType) return false;
      const ts = new Date(d.createdAt).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }, [data, action, entityType, from, to]);

  const columns: Column<AuditLogRow>[] = [
    {
      key: "createdAt",
      header: "Thời gian",
      sortable: true,
      accessor: (r) => r.createdAt,
      cell: (r) => new Date(r.createdAt).toLocaleString("vi-VN"),
    },
    {
      key: "user",
      header: "Người dùng",
      sortable: true,
      accessor: (r) => r.user.fullName,
      cell: (r) => (
        <span title={r.user.username}>{r.user.fullName}</span>
      ),
    },
    {
      key: "action",
      header: "Hành động",
      sortable: true,
      accessor: (r) => r.action,
      cell: (r) => (
        <Badge variant="secondary">{ACTION_LABEL[r.action] ?? r.action}</Badge>
      ),
    },
    {
      key: "entityType",
      header: "Đối tượng",
      sortable: true,
      accessor: (r) => r.entityType,
      cell: (r) => ENTITY_LABEL[r.entityType] ?? r.entityType,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nhật ký thao tác</h1>
        <p className="text-muted-foreground">
          Lịch sử các thao tác trên hệ thống.
        </p>
      </div>

      {/* Bộ lọc */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Hành động</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              {actionOptions.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABEL[a] ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Đối tượng</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              {entityOptions.map((e) => (
                <SelectItem key={e} value={e}>
                  {ENTITY_LABEL[e] ?? e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="from">Từ ngày</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Đến ngày</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        searchAccessor={(r) =>
          `${r.user.fullName} ${r.user.username} ${r.action} ${r.entityType} ${r.entityId ?? ""}`
        }
        searchPlaceholder="Tìm theo người dùng, đối tượng…"
        emptyText="Không có nhật ký phù hợp."
        actions={(row) => (
          <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>
            Chi tiết
          </Button>
        )}
      />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết nhật ký</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Thời gian: </span>
                  {new Date(detail.createdAt).toLocaleString("vi-VN")}
                </div>
                <div>
                  <span className="text-muted-foreground">Người dùng: </span>
                  {detail.user.fullName} ({detail.user.username})
                </div>
                <div>
                  <span className="text-muted-foreground">Hành động: </span>
                  {ACTION_LABEL[detail.action] ?? detail.action}
                </div>
                <div>
                  <span className="text-muted-foreground">Đối tượng: </span>
                  {ENTITY_LABEL[detail.entityType] ?? detail.entityType}
                </div>
                {detail.ipAddress && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">IP: </span>
                    {detail.ipAddress}
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium">Giá trị cũ</p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {pretty(detail.oldValue)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium">Giá trị mới</p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {pretty(detail.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
