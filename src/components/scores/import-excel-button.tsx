"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

import { http } from "@/lib/http";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PreviewRow = {
  row: number;
  maSV: string;
  cccd: string;
  hoTen: string;
  diem: string;
  note: string;
  matched: boolean;
  studentId: string | null;
  studentName: string | null;
  score: number | null;
  error: string | null;
};

export function ImportExcelButton({
  classId,
  semesterId,
  onDone,
}: {
  classId: string;
  semesterId: string;
  onDone: () => void;
}) {
  // Kiểm tra feature flag — nếu tắt thì component KHÔNG render gì.
  const { data: cfg } = useQuery({
    queryKey: ["features"],
    queryFn: () =>
      http.get<{ importExcelEnabled: boolean }>("/api/config/features"),
  });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("HỌC KỲ");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  if (!cfg?.importExcelEnabled) return null;

  function reset() {
    setStep(1);
    setFile(null);
    setRows([]);
  }

  async function doPreview() {
    if (!file) return toast.error("Vui lòng chọn file");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classId", classId);
      fd.append("sheetName", sheetName);
      const res = await fetch("/api/import/excel/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Lỗi đọc file");
      setRows(json.data.rows);
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function doCommit() {
    const items = rows
      .filter((r) => r.matched && r.score != null && !r.error)
      .map((r) => ({ maSV: r.maSV, cccd: r.cccd, score: r.score, note: r.note }));
    if (items.length === 0) return toast.error("Không có dòng hợp lệ để ghi");
    setLoading(true);
    try {
      const result = await http.post<{
        rowsSuccess: number;
        rowsFailed: number;
      }>("/api/import/excel/commit", {
        classId,
        semesterId,
        filename: file?.name,
        items,
      });
      toast.success(
        `Đã import: ${result.rowsSuccess} thành công, ${result.rowsFailed} lỗi`
      );
      setOpen(false);
      reset();
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const validCount = rows.filter((r) => r.matched && r.score != null && !r.error).length;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import Excel
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Import Excel — {step === 1 ? "Bước 1: Chọn file" : "Bước 2: Xem trước"}
            </DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Sheet nguồn</Label>
                <Select value={sheetName} onValueChange={setSheetName}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HỌC KỲ">HỌC KỲ</SelectItem>
                    <SelectItem value="HỌC KỲ 2">HỌC KỲ 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">File Excel (.xls/.xlsx, ≤ 5MB)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {validCount}/{rows.length} dòng hợp lệ sẽ được ghi. Dòng lỗi (đỏ) sẽ bỏ qua.
              </p>
              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên (file)</TableHead>
                      <TableHead>Điểm</TableHead>
                      <TableHead>Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.row}
                        className={cn(
                          r.error
                            ? "bg-destructive/10"
                            : "bg-green-500/10"
                        )}
                      >
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="font-medium">{r.maSV}</TableCell>
                        <TableCell>{r.hoTen}</TableCell>
                        <TableCell>{r.diem}</TableCell>
                        <TableCell className="text-sm">
                          {r.error ? (
                            <span className="text-destructive">{r.error}</span>
                          ) : (
                            <span className="text-green-700 dark:text-green-400">
                              Khớp: {r.studentName}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
                Quay lại
              </Button>
            )}
            {step === 1 ? (
              <Button onClick={doPreview} disabled={loading || !file}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xem trước
              </Button>
            ) : (
              <Button onClick={doCommit} disabled={loading || validCount === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận ghi {validCount} dòng
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
