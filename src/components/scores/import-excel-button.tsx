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

type Action = "create" | "overwrite" | "skip";
type MatchStatus = "matched" | "not_in_target_class" | "not_in_db";

type PreviewRow = {
  row: number;
  maSV: string;
  cccd: string;
  hoTen: string;
  diem: string;
  note: string;
  matchStatus: MatchStatus;
  action: Action;
  studentId: string | null;
  studentName: string | null;
  score: number | null;
  existingScore: number | null;
  error: string | null;
};

const isActionable = (r: PreviewRow) =>
  r.action === "create" || r.action === "overwrite";

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
  // Dòng nào được chọn ghi vào DB. Mặc định: create=chọn, overwrite=KHÔNG chọn.
  const [selected, setSelected] = useState<Record<number, boolean>>({});
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
    setSelected({});
    setAnalysis(null);
    setApplied({});
  }

  // Áp override (giá trị AI đề xuất) + tính lại action/score/error client-side.
  function recomputeRow(r: PreviewRow): PreviewRow {
    const v = applied[r.row];
    if (v == null) return r;
    if (r.matchStatus !== "matched") return { ...r, diem: v };
    const score = Number(v);
    const valid = Number.isInteger(score) && score >= 0 && score <= 100;
    if (!valid) {
      return { ...r, diem: v, score: null, action: "skip", error: "Điểm không hợp lệ (0–100)" };
    }
    return {
      ...r,
      diem: v,
      score,
      error: null,
      action: r.existingScore != null ? "overwrite" : "create",
    };
  }

  // Mặc định chọn: create → true; overwrite → chỉ chọn nếu vừa sửa qua AI; skip → false.
  function defaultSelected(list: PreviewRow[]): Record<number, boolean> {
    const s: Record<number, boolean> = {};
    for (const r of list) {
      if (r.action === "create") s[r.row] = true;
      else if (r.action === "overwrite") s[r.row] = applied[r.row] != null;
      else s[r.row] = false;
    }
    return s;
  }

  async function doPreview(mapping?: ColumnMapping, sheet?: string) {
    if (!file) return toast.error("Vui lòng chọn file");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classId", classId);
      fd.append("semesterId", semesterId);
      fd.append("sheetName", sheet ?? sheetName);
      if (mapping) fd.append("columnMapping", JSON.stringify(mapping));
      const res = await fetch("/api/import/excel/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Lỗi đọc file");
      const baked = (json.data.rows as PreviewRow[]).map(recomputeRow);
      setRows(baked);
      setSelected(defaultSelected(baked));
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

  function toggleRow(row: number) {
    setSelected((prev) => ({ ...prev, [row]: !prev[row] }));
  }

  // Chọn/bỏ tất cả dòng ghi đè (tiện lợi — mặc định các dòng này KHÔNG chọn).
  function setAllOverwrite(value: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const r of rows) if (r.action === "overwrite") next[r.row] = value;
      return next;
    });
  }

  async function doCommit() {
    const items = rows
      .filter(
        (r) => selected[r.row] && isActionable(r) && r.score != null && !r.error
      )
      .map((r) => ({ maSV: r.maSV, cccd: r.cccd, score: r.score, note: r.note }));
    if (items.length === 0) return toast.error("Không có dòng nào được chọn để ghi");
    setLoading(true);
    try {
      const result = await http.post<{
        rowsCreated: number;
        rowsOverwritten: number;
        rowsFailed: number;
      }>("/api/import/excel/commit", {
        classId,
        semesterId,
        filename: file?.name,
        items,
      });
      toast.success(
        `Đã import: ${result.rowsCreated} tạo mới, ${result.rowsOverwritten} ghi đè` +
          (result.rowsFailed ? `, ${result.rowsFailed} lỗi` : "")
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

  const createCount = rows.filter((r) => r.action === "create").length;
  const overwriteCount = rows.filter((r) => r.action === "overwrite").length;
  const skipCount = rows.filter((r) => r.action === "skip").length;
  const selectedCount = rows.filter(
    (r) => selected[r.row] && isActionable(r) && r.score != null && !r.error
  ).length;

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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-green-700 dark:text-green-400">
                  Tạo mới: {createCount}
                </span>
                <span className="text-amber-700 dark:text-amber-500">
                  Ghi đè: {overwriteCount}
                </span>
                <span className="text-muted-foreground">Bỏ qua: {skipCount}</span>
                {overwriteCount > 0 && (
                  <span className="ml-auto flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAllOverwrite(true)}
                    >
                      Chọn hết ghi đè
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAllOverwrite(false)}
                    >
                      Bỏ hết ghi đè
                    </Button>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Dòng &ldquo;ghi đè&rdquo; mặc định KHÔNG chọn — tick để cập nhật điểm đã có.
                Xếp loại được tính lại ở máy chủ khi ghi.
              </p>
              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên (file)</TableHead>
                      <TableHead>Điểm</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.row}
                        className={cn(
                          r.action === "create" && "bg-green-500/10",
                          r.action === "overwrite" && "bg-amber-500/10",
                          r.action === "skip" && "bg-muted/40"
                        )}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={!!selected[r.row]}
                            disabled={!isActionable(r) || r.score == null || !!r.error}
                            onChange={() => toggleRow(r.row)}
                          />
                        </TableCell>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="font-medium">{r.maSV}</TableCell>
                        <TableCell>{r.hoTen}</TableCell>
                        <TableCell>{r.diem}</TableCell>
                        <TableCell className="text-sm">
                          {r.action === "create" && (
                            <span className="text-green-700 dark:text-green-400">
                              Tạo mới: {r.studentName}
                            </span>
                          )}
                          {r.action === "overwrite" && (
                            <span className="text-amber-700 dark:text-amber-500">
                              Ghi đè {r.existingScore} → {r.score}: {r.studentName}
                            </span>
                          )}
                          {r.action === "skip" && (
                            <span className="text-muted-foreground">
                              {r.error ?? "Bỏ qua"}
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
              <Button onClick={doCommit} disabled={loading || selectedCount === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận ghi {selectedCount} dòng
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
