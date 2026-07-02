"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Download, Sparkles, AlertTriangle } from "lucide-react";

import { http } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { ClassRow } from "@/types/catalog";
import type {
  AiStudentImportAnalysis,
  NormalizedStudentPreview,
} from "@/types/import-students";
// (types-only imports — không kéo dependency server vào bundle client)
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

type Status = "new" | "update" | "skip" | "error";

type PreviewRow = {
  row: number;
  mssv: string;
  cccd: string;
  hoTen: string;
  gioiTinh: string;
  ngaySinh: string;
  trangThai: string;
  ghiChu: string;
  status: Status;
  error: string | null;
  existingClass: string | null;
  data: NormalizedStudentPreview | null;
};

type Summary = {
  total: number;
  new: number;
  update: number;
  skip: number;
  error: number;
};

type AiResult = AiStudentImportAnalysis & { columnHeaders?: string[] };
type MappingField = keyof AiStudentImportAnalysis["columnMapping"];
type OverrideField = Exclude<MappingField, "stt">;
type ColumnMapping = Partial<Record<MappingField, number>>;

const FIELD_LABELS: Record<MappingField, string> = {
  stt: "STT",
  mssv: "MSSV",
  cccd: "CCCD",
  hoTen: "Họ tên",
  gioiTinh: "Giới tính",
  ngaySinh: "Ngày sinh",
  trangThai: "Trạng thái",
  ghiChu: "Ghi chú",
};
const FIELD_ORDER: MappingField[] = [
  "stt",
  "mssv",
  "cccd",
  "hoTen",
  "gioiTinh",
  "ngaySinh",
  "trangThai",
  "ghiChu",
];

const NO_COLUMN = "none";
const MAX_COLS = 10;

const isSelectable = (r: PreviewRow) =>
  r.status === "new" || r.status === "update";

function toColumnMapping(m: AiStudentImportAnalysis["columnMapping"]): ColumnMapping {
  const out: ColumnMapping = {};
  for (const f of FIELD_ORDER) {
    const ref = m[f];
    if (ref) out[f] = ref.col;
  }
  return out;
}

export function ImportStudentsButton({
  classes,
  onDone,
}: {
  classes: ClassRow[];
  onDone: () => void;
}) {
  const { data: cfg } = useQuery({
    queryKey: ["features"],
    queryFn: () =>
      http.get<{ importExcelEnabled: boolean; aiImportEnabled: boolean }>(
        "/api/config/features"
      ),
  });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [classId, setClassId] = useState("");
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  // ── AI (mục 5.3.2.2) ────────────────────────────────────────────────────────
  const [aiConsent, setAiConsent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiResult | null>(null);
  const [editMapping, setEditMapping] = useState<ColumnMapping>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  function reset() {
    setStep(1);
    setFile(null);
    setRows([]);
    setSummary(null);
    setSelected({});
    setAnalysis(null);
    setEditMapping({});
    setApplied({});
    setDismissed({});
    setAiConsent(false);
  }

  function defaultSelected(list: PreviewRow[]): Record<number, boolean> {
    const s: Record<number, boolean> = {};
    for (const r of list) s[r.row] = isSelectable(r);
    return s;
  }

  // Tải file mẫu bằng blob (thay vì <a download>) — chắc chắn tải được trên mọi
  // trình duyệt và báo lỗi rõ ràng nếu thất bại.
  const [downloading, setDownloading] = useState(false);
  async function downloadTemplate() {
    setDownloading(true);
    try {
      const res = await fetch("/api/students/import/template");
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "Bạn không có quyền tải file mẫu."
            : "Không tải được file mẫu."
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mau-danh-sach-sinh-vien.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  function collectOverrides() {
    return Object.entries(applied).map(([key, value]) => {
      const [row, field] = key.split(":");
      return { row: Number(row), field: field as OverrideField, value };
    });
  }

  async function doPreview(mapping?: ColumnMapping, sheet?: string) {
    if (!classId) return toast.error("Vui lòng chọn lớp đích");
    if (!file) return toast.error("Vui lòng chọn file");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classId", classId);
      fd.append("mode", mode);
      if (sheet) fd.append("sheetName", sheet);
      if (mapping) fd.append("columnMapping", JSON.stringify(mapping));
      const overrides = collectOverrides();
      if (overrides.length) fd.append("overrides", JSON.stringify(overrides));
      const res = await fetch("/api/students/import/preview", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Lỗi đọc file");
      const list = json.data.rows as PreviewRow[];
      setRows(list);
      setSummary(json.data.summary as Summary);
      setSelected(defaultSelected(list));
      setStep(2);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function doAiAnalyze() {
    if (!classId) return toast.error("Vui lòng chọn lớp đích");
    if (!file) return toast.error("Vui lòng chọn file");
    if (!aiConsent) return toast.error("Vui lòng xác nhận đồng ý gửi dữ liệu");
    setAiLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classId", classId);
      const res = await fetch("/api/students/import/ai-analyze", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json.error)
        throw new Error(json.error ?? "Lỗi phân tích AI");
      const result = json.data as AiResult;
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

  async function doCommit() {
    const items = rows
      .filter((r) => selected[r.row] && isSelectable(r) && r.data)
      .map((r) => r.data);
    if (items.length === 0) return toast.error("Không có dòng nào được chọn");
    setLoading(true);
    try {
      const result = await http.post<{
        created: number;
        updated: number;
        skipped: number;
        failed: number;
      }>("/api/students/import/commit", {
        classId,
        mode,
        filename: file?.name,
        items,
      });
      toast.success(
        `Đã import: ${result.created} thêm mới, ${result.updated} cập nhật` +
          (result.skipped ? `, ${result.skipped} bỏ qua` : "") +
          (result.failed ? `, ${result.failed} lỗi` : "")
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

  const selectedCount = rows.filter(
    (r) => selected[r.row] && isSelectable(r) && r.data
  ).length;

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
        Import sinh viên
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
              Import sinh viên —{" "}
              {step === 1 ? "Bước 1: Chọn file" : "Bước 2: Xem trước"}
            </DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lớp đích</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn lớp" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {classes.length === 0 ? (
                  <p className="text-xs text-destructive">
                    Chưa tải được danh sách lớp. Kiểm tra kết nối cơ sở dữ liệu
                    (Supabase có thể đang tạm dừng — tải lại trang sau ít giây)
                    hoặc tạo Lớp trước ở tab &ldquo;Lớp&rdquo;.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Toàn bộ SV trong file sẽ được gán vào lớp này.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Sinh viên đã tồn tại</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as "skip" | "update")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Bỏ qua (giữ nguyên)</SelectItem>
                    <SelectItem value="update">
                      Cập nhật (ghi đè hồ sơ + chuyển lớp)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="file">File Excel (.xls/.xlsx, ≤ 5MB)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={downloadTemplate}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Tải file mẫu
                  </Button>
                </div>
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
                <p className="text-xs text-muted-foreground">
                  Tải file mẫu, điền danh sách rồi import. Nhớ xoá dòng ví dụ.
                </p>
              </div>

              {/* ── Khối AI (mục 5.3.2.2) ─────────────────────────────────── */}
              {cfg?.aiImportEnabled && (
                <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Dùng AI để nhận diện cột &amp; chuẩn hoá khi file đổi định
                      dạng.{" "}
                      <strong>
                        Dữ liệu (MSSV, CCCD, họ tên, ngày sinh…) sẽ được gửi tới
                        dịch vụ AI (Google Gemini)
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
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Ánh xạ cột (chỉnh nếu sai):
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {FIELD_ORDER.map((f) => {
                            const ref = analysis.columnMapping[f];
                            const current = editMapping[f];
                            return (
                              <div key={f} className="flex items-center gap-2">
                                <span className="w-20 shrink-0 text-sm">
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
                                    {Array.from({ length: colCount }).map(
                                      (_, i) => (
                                        <SelectItem key={i} value={String(i)}>
                                          {colLabel(i)}
                                        </SelectItem>
                                      )
                                    )}
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
                                    <code>{a.value || "(trống)"}</code> —{" "}
                                    {a.reason}
                                    {a.suggestedValue != null && (
                                      <>
                                        {" "}
                                        → đề xuất <code>{a.suggestedValue}</code>
                                      </>
                                    )}
                                  </span>
                                  <span className="flex shrink-0 gap-1">
                                    {isDismissed ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => undoDismiss(a.row, a.field)}
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
                        {loading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Áp dụng ánh xạ &amp; xem trước
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {summary && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-green-700 dark:text-green-400">
                    Thêm mới: {summary.new}
                  </span>
                  <span className="text-amber-700 dark:text-amber-500">
                    Cập nhật: {summary.update}
                  </span>
                  <span className="text-muted-foreground">
                    Bỏ qua: {summary.skip}
                  </span>
                  <span className="text-destructive">Lỗi: {summary.error}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Chế độ: {mode === "update" ? "Cập nhật SV đã tồn tại" : "Bỏ qua SV đã tồn tại"}.
                Dòng lỗi không thể chọn.
              </p>
              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>#</TableHead>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>CCCD</TableHead>
                      <TableHead>Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.row}
                        className={cn(
                          r.status === "new" && "bg-green-500/10",
                          r.status === "update" && "bg-amber-500/10",
                          r.status === "error" && "bg-destructive/10",
                          r.status === "skip" && "bg-muted/40"
                        )}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={!!selected[r.row]}
                            disabled={!isSelectable(r)}
                            onChange={() => toggleRow(r.row)}
                          />
                        </TableCell>
                        <TableCell>{r.row}</TableCell>
                        <TableCell className="font-medium">{r.mssv}</TableCell>
                        <TableCell>{r.hoTen}</TableCell>
                        <TableCell>{r.cccd}</TableCell>
                        <TableCell className="text-sm">
                          {r.status === "new" && (
                            <span className="text-green-700 dark:text-green-400">
                              Thêm mới
                            </span>
                          )}
                          {r.status === "update" && (
                            <span className="text-amber-700 dark:text-amber-500">
                              Cập nhật (đang ở {r.existingClass})
                            </span>
                          )}
                          {r.status === "skip" && (
                            <span className="text-muted-foreground">
                              Đã tồn tại — bỏ qua ({r.existingClass})
                            </span>
                          )}
                          {r.status === "error" && (
                            <span className="text-destructive">{r.error}</span>
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
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Quay lại
              </Button>
            )}
            {step === 1 ? (
              <Button
                onClick={() => doPreview()}
                disabled={loading || !file || !classId}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xem trước
              </Button>
            ) : (
              <Button onClick={doCommit} disabled={loading || selectedCount === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận import {selectedCount} dòng
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
