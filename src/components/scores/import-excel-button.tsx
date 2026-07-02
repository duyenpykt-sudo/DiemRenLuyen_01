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

// Kết quả từ /api/import/excel/ai-analyze: analysis + nhãn cột (dựng UI combobox).
type AiAnalyzeResult = AiImportAnalysis & { columnHeaders?: string[] };

type MappingField = keyof AiImportAnalysis["columnMapping"];
// Trường có thể chỉnh giá trị (áp đề xuất). STT không ghi vào DB nên không cho áp.
type OverrideField = "cccd" | "maSV" | "hoTen" | "diem" | "ghiChu";

const isActionable = (r: PreviewRow) =>
  r.action === "create" || r.action === "overwrite";

// Nhãn tiếng Việt cho các trường ánh xạ cột.
const FIELD_LABELS: Record<MappingField, string> = {
  stt: "STT",
  cccd: "CCCD",
  maSV: "Mã SV",
  hoTen: "Họ tên",
  diem: "Điểm",
  ghiChu: "Ghi chú",
};
const FIELD_ORDER: MappingField[] = [
  "stt",
  "cccd",
  "maSV",
  "hoTen",
  "diem",
  "ghiChu",
];

const NO_COLUMN = "none"; // sentinel cho combobox "không có cột"
const MAX_COLS = 12; // fallback khi chưa có nhãn cột từ server

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
  const [analysis, setAnalysis] = useState<AiAnalyzeResult | null>(null);
  // Ánh xạ cột do CVHT duyệt (khởi tạo từ AI, chỉnh được qua combobox).
  const [editMapping, setEditMapping] = useState<ColumnMapping>({});
  // Giá trị AI đề xuất mà CVHT đã áp: key `${row}:${field}` → value.
  const [applied, setApplied] = useState<Record<string, string>>({});
  // Dòng nghi ngờ CVHT đã bỏ qua: key `${row}:${field}` → true.
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  if (!cfg?.importExcelEnabled) return null;

  function reset() {
    setStep(1);
    setFile(null);
    setRows([]);
    setSelected({});
    setAnalysis(null);
    setEditMapping({});
    setApplied({});
    setDismissed({});
  }

  // Mặc định chọn: create → true; overwrite → KHÔNG (CVHT tick để ghi đè); skip → false.
  function defaultSelected(list: PreviewRow[]): Record<number, boolean> {
    const s: Record<number, boolean> = {};
    for (const r of list) s[r.row] = r.action === "create";
    return s;
  }

  // Gom các giá trị AI đã được CVHT duyệt → gửi kèm preview để server áp trước match.
  function collectOverrides() {
    return Object.entries(applied).map(([key, value]) => {
      const [row, field] = key.split(":");
      return { row: Number(row), field: field as OverrideField, value };
    });
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
      const overrides = collectOverrides();
      if (overrides.length) fd.append("overrides", JSON.stringify(overrides));
      const res = await fetch("/api/import/excel/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Lỗi đọc file");
      const baked = json.data.rows as PreviewRow[];
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
      const result = json.data as AiAnalyzeResult;
      setAnalysis(result);
      setEditMapping(toColumnMapping(result.columnMapping));
      setApplied({});
      setDismissed({});
      toast.success("AI đã phân tích xong. Vui lòng kiểm tra & chỉnh đề xuất.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  // Chỉnh ánh xạ 1 cột qua combobox.
  function setMappingField(field: MappingField, colStr: string) {
    setEditMapping((prev) => {
      const next = { ...prev };
      if (colStr === NO_COLUMN) delete next[field];
      else next[field] = Number(colStr);
      return next;
    });
  }

  function acceptSuggestion(row: number, field: OverrideField, value: string) {
    const key = `${row}:${field}`;
    setApplied((prev) => ({ ...prev, [key]: value }));
    setDismissed((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast.success(`Đã áp giá trị đề xuất cho dòng ${row} (${FIELD_LABELS[field]})`);
  }

  function dismissSuggestion(row: number, field: MappingField) {
    const key = `${row}:${field}`;
    setDismissed((prev) => ({ ...prev, [key]: true }));
    setApplied((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function undoDismiss(row: number, field: MappingField) {
    const key = `${row}:${field}`;
    setDismissed((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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

  // Số cột để dựng combobox (ưu tiên nhãn cột từ server).
  const colCount = Math.max(analysis?.columnHeaders?.length ?? 0, MAX_COLS);
  const colLabel = (i: number) => {
    const h = analysis?.columnHeaders?.[i];
    return h ? `Cột ${i} — ${h}` : `Cột ${i}`;
  };

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
                    setEditMapping({});
                    setApplied({});
                    setDismissed({});
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

                      {/* Ánh xạ cột — combobox cho CVHT chỉnh lại (mục 5.5.2 bước 4). */}
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Ánh xạ cột (chỉnh nếu sai):</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {FIELD_ORDER.map((f) => {
                            const ref = analysis.columnMapping[f];
                            const current = editMapping[f];
                            return (
                              <div key={f} className="flex items-center gap-2">
                                <span className="w-16 shrink-0 text-sm">
                                  {FIELD_LABELS[f]}
                                </span>
                                <Select
                                  value={
                                    current === undefined
                                      ? NO_COLUMN
                                      : String(current)
                                  }
                                  onValueChange={(v) => setMappingField(f, v)}
                                >
                                  <SelectTrigger className="h-8 flex-1 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_COLUMN}>
                                      — Không có —
                                    </SelectItem>
                                    {Array.from({ length: colCount }).map((_, i) => (
                                      <SelectItem key={i} value={String(i)}>
                                        {colLabel(i)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {ref && (
                                  <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                                    {Math.round(ref.confidence * 100)}%
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {analysis.rowAnomalies.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Dòng nghi ngờ ({analysis.rowAnomalies.length}):
                          </p>
                          <div className="max-h-48 space-y-1 overflow-auto">
                            {analysis.rowAnomalies.map((a, i) => {
                              const key = `${a.row}:${a.field}`;
                              const isDismissed = dismissed[key];
                              const isApplied =
                                a.suggestedValue != null &&
                                applied[key] === a.suggestedValue;
                              // STT không ghi vào DB nên không cho "áp" — chỉ bỏ qua.
                              const canApply =
                                a.field !== "stt" && a.suggestedValue != null;
                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex items-center justify-between gap-2 rounded px-2 py-1 text-sm",
                                    isDismissed
                                      ? "bg-muted/50 text-muted-foreground"
                                      : "bg-destructive/10"
                                  )}
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
                                  <span className="flex shrink-0 gap-1">
                                    {isDismissed ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          undoDismiss(a.row, a.field)
                                        }
                                      >
                                        Hoàn tác
                                      </Button>
                                    ) : (
                                      <>
                                        {canApply && (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                              acceptSuggestion(
                                                a.row,
                                                a.field as OverrideField,
                                                a.suggestedValue!
                                              )
                                            }
                                            disabled={isApplied}
                                          >
                                            {isApplied ? "Đã áp" : "Áp dụng"}
                                          </Button>
                                        )}
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            dismissSuggestion(a.row, a.field)
                                          }
                                        >
                                          Bỏ qua
                                        </Button>
                                      </>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => doPreview(editMapping, analysis.sheetGuess)}
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
