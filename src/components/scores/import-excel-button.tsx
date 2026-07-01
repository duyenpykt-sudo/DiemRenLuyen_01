"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Sparkles, AlertTriangle } from "lucide-react";

import { http } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { AiImportAnalysis } from "@/lib/ai-import";
import type { ColumnMapping } from "@/lib/excel-import";
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

// Nhãn tiếng Việt cho các trường ánh xạ cột.
const FIELD_LABELS: Record<keyof AiImportAnalysis["columnMapping"], string> = {
  stt: "STT",
  cccd: "CCCD",
  maSV: "Mã SV",
  hoTen: "Họ tên",
  diem: "Điểm",
  ghiChu: "Ghi chú",
};
const FIELD_ORDER = ["stt", "cccd", "maSV", "hoTen", "diem", "ghiChu"] as const;

/** Chuyển ánh xạ AI ({col,confidence}|null) → ColumnMapping ({field: colIndex}). */
function toColumnMapping(m: AiImportAnalysis["columnMapping"]): ColumnMapping {
  const out: ColumnMapping = {};
  for (const f of FIELD_ORDER) {
    const ref = m[f];
    if (ref) out[f] = ref.col;
  }
  return out;
}

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
      http.get<{ importExcelEnabled: boolean; aiImportEnabled: boolean }>(
        "/api/config/features"
      ),
  });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState("HỌC KỲ");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Trạng thái AI (mục 5.5.2) ──────────────────────────────────────────────
  const [aiConsent, setAiConsent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiImportAnalysis | null>(null);
  // Các dòng "diem" mà CVHT đã chấp nhận áp giá trị AI đề xuất: { row: value }.
  const [applied, setApplied] = useState<Record<number, string>>({});

  if (!cfg?.importExcelEnabled) return null;

  function reset() {
    setStep(1);
    setFile(null);
    setRows([]);
    setAnalysis(null);
    setApplied({});
  }

  // Áp override (giá trị AI đề xuất) lên các dòng preview + tính lại score/error client-side.
  function applyOverrides(list: PreviewRow[]): PreviewRow[] {
    return list.map((r) => {
      const v = applied[r.row];
      if (v == null) return r;
      const score = Number(v);
      const valid = Number.isInteger(score) && score >= 0 && score <= 100;
      let error: string | null = null;
      if (!r.matched) error = "Không tìm thấy SV trong lớp (theo MSSV/CCCD)";
      else if (!valid) error = "Điểm không hợp lệ (0–100)";
      return { ...r, diem: v, score: valid ? score : null, error };
    });
  }

  async function doPreview(mapping?: ColumnMapping, sheet?: string) {
    if (!file) return toast.error("Vui lòng chọn file");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classId", classId);
      fd.append("sheetName", sheet ?? sheetName);
      if (mapping) fd.append("columnMapping", JSON.stringify(mapping));
      const res = await fetch("/api/import/excel/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Lỗi đọc file");
      setRows(applyOverrides(json.data.rows));
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function doAiAnalyze() {
    if (!file) return toast.error("Vui lòng chọn file");
    if (!aiConsent) return toast.error("Vui lòng xác nhận đồng ý gửi dữ liệu");
    setAiLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classId", classId);
      const res = await fetch("/api/import/excel/ai-analyze", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Lỗi phân tích AI");
      setAnalysis(json.data as AiImportAnalysis);
      toast.success("AI đã phân tích xong. Vui lòng kiểm tra đề xuất.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  function acceptSuggestion(row: number, value: string) {
    setApplied((prev) => ({ ...prev, [row]: value }));
    toast.success(`Đã áp giá trị đề xuất cho dòng ${row}`);
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
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-auto">
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
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setAnalysis(null);
                    setApplied({});
                  }}
                />
              </div>

              {/* ── Khối AI (mục 5.5.2) — chỉ hiện khi flag bật ─────────────── */}
              {cfg?.aiImportEnabled && (
                <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Dùng AI để nhận diện cột &amp; chuẩn hoá khi file đổi định dạng.
                      <strong>
                        {" "}
                        Dữ liệu (CCCD, MSSV, họ tên, điểm) sẽ được gửi tới dịch vụ AI
                        (Google Gemini)
                      </strong>{" "}
                      để phân tích.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={aiConsent}
                      onChange={(e) => setAiConsent(e.target.checked)}
                    />
                    Tôi đồng ý gửi dữ liệu tới Google Gemini để phân tích.
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={doAiAnalyze}
                    disabled={aiLoading || !file || !aiConsent}
                  >
                    {aiLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Phân tích bằng AI
                  </Button>

                  {analysis && (
                    <div className="space-y-3 border-t pt-3">
                      <p className="text-sm">
                        Sheet AI đề xuất: <strong>{analysis.sheetGuess}</strong>
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
                        {FIELD_ORDER.map((f) => {
                          const ref = analysis.columnMapping[f];
                          return (
                            <div key={f} className="rounded bg-muted px-2 py-1">
                              {FIELD_LABELS[f]}:{" "}
                              {ref ? (
                                <span className="font-medium">
                                  cột {ref.col} ({Math.round(ref.confidence * 100)}%)
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {analysis.rowAnomalies.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Dòng nghi ngờ ({analysis.rowAnomalies.length}):
                          </p>
                          <div className="max-h-40 space-y-1 overflow-auto">
                            {analysis.rowAnomalies.map((a, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-2 rounded bg-destructive/10 px-2 py-1 text-sm"
                              >
                                <span>
                                  Dòng {a.row} · {FIELD_LABELS[a.field]}:{" "}
                                  <code>{a.value || "(trống)"}</code> — {a.reason}
                                  {a.suggestedValue != null && (
                                    <>
                                      {" "}→ đề xuất <code>{a.suggestedValue}</code>
                                    </>
                                  )}
                                </span>
                                {a.field === "diem" && a.suggestedValue != null && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      acceptSuggestion(a.row, a.suggestedValue!)
                                    }
                                    disabled={applied[a.row] === a.suggestedValue}
                                  >
                                    {applied[a.row] === a.suggestedValue
                                      ? "Đã áp"
                                      : "Áp dụng"}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          doPreview(
                            toColumnMapping(analysis.columnMapping),
                            analysis.sheetGuess
                          )
                        }
                        disabled={loading}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Áp dụng ánh xạ &amp; xem trước
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
                          r.error ? "bg-destructive/10" : "bg-green-500/10"
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
              <Button onClick={() => doPreview()} disabled={loading || !file}>
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
