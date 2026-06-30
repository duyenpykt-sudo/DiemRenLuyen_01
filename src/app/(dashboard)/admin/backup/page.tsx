"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Loader2, RotateCcw } from "lucide-react";

import { http } from "@/lib/http";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Backup = { filename: string; size: number; createdAt: string };

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => http.get<Backup[]>("/api/admin/backup"),
  });

  const create = useMutation({
    mutationFn: () => http.post<{ filename: string }>("/api/admin/backup", {}),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      toast.success(`Đã sao lưu: ${d.filename}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: (filename: string) =>
      http.post("/api/admin/backup/restore", { filename }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      toast.success("Đã khôi phục. Vui lòng khởi động lại server để áp dụng.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sao lưu/khôi phục cơ sở dữ liệu SQLite. File lưu trong thư mục{" "}
          <code>backups/</code>.
        </p>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Database className="mr-2 h-4 w-4" />
          )}
          Sao lưu ngay
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên file</TableHead>
              <TableHead>Kích thước</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Đang tải…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Chưa có bản sao lưu nào.
                </TableCell>
              </TableRow>
            ) : (
              data.map((b) => (
                <TableRow key={b.filename}>
                  <TableCell className="font-mono text-sm">{b.filename}</TableCell>
                  <TableCell>{fmtSize(b.size)}</TableCell>
                  <TableCell>{new Date(b.createdAt).toLocaleString("vi-VN")}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Khôi phục
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Khôi phục từ bản sao lưu này?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Toàn bộ dữ liệu hiện tại sẽ bị <strong>ghi đè</strong> bằng{" "}
                            <code>{b.filename}</code>. Hệ thống sẽ tự tạo 1 bản sao lưu
                            an toàn trước khi ghi đè. Bạn nên khởi động lại server sau khi khôi phục.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction onClick={() => restore.mutate(b.filename)}>
                            Khôi phục
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
