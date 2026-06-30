"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { http } from "@/lib/http";
import { classifyScore } from "@/lib/classification";
import type { ScoreRow } from "@/types/score";
import { ClassificationBadge } from "@/components/scores/classification-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Edit = { score: string; note: string };

function buildEdits(rows: ScoreRow[]): Record<string, Edit> {
  const map: Record<string, Edit> = {};
  for (const r of rows) {
    map[r.studentId] = {
      score: r.score ? String(r.score.score) : "",
      note: r.score?.note ?? "",
    };
  }
  return map;
}

function isValidScore(v: string): boolean {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

export function ModeB({
  classId,
  semesterId,
  rows,
  canMutate,
  locked,
  onChanged,
}: {
  classId: string;
  semesterId: string;
  rows: ScoreRow[];
  canMutate: boolean;
  locked: boolean;
  onChanged: () => void;
}) {
  const editable = canMutate && !locked;
  const [edits, setEdits] = useState<Record<string, Edit>>(() => buildEdits(rows));
  const dirty = useRef<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  // Đồng bộ lại khi dữ liệu nguồn thay đổi (đổi lớp/HK hoặc refetch).
  useEffect(() => {
    setEdits(buildEdits(rows));
    dirty.current = new Set();
  }, [rows]);

  function update(studentId: string, patch: Partial<Edit>) {
    setEdits((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
    dirty.current.add(studentId);
  }

  // Lưu 1 dòng qua API batch (1 item).
  async function saveRow(studentId: string) {
    const e = edits[studentId];
    if (!e || !isValidScore(e.score)) return;
    await http.post("/api/scores/batch", {
      classId,
      semesterId,
      items: [{ studentId, score: Number(e.score), note: e.note }],
    });
  }

  // Tự lưu khi rời ô (blur), không refetch để không mất các ô đang sửa.
  async function onBlurRow(studentId: string) {
    if (!editable || !dirty.current.has(studentId)) return;
    const e = edits[studentId];
    if (!isValidScore(e.score)) return;
    try {
      await saveRow(studentId);
      dirty.current.delete(studentId);
      toast.success("Đã lưu", { duration: 1200 });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // Lưu tất cả dòng đang sửa (có thanh tiến trình).
  async function saveAll() {
    const ids = Array.from(dirty.current).filter((id) =>
      isValidScore(edits[id]?.score)
    );
    if (ids.length === 0) {
      toast.info("Không có thay đổi hợp lệ để lưu.");
      return;
    }
    setProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (const id of ids) {
      try {
        await saveRow(id);
        dirty.current.delete(id);
        ok++;
      } catch (err) {
        toast.error((err as Error).message);
      }
      setProgress({ done: ok, total: ids.length });
    }
    setProgress(null);
    toast.success(`Đã lưu ${ok}/${ids.length} dòng`);
    onChanged();
  }

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex items-center justify-end gap-3">
          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Đang lưu {progress.done}/{progress.total}
              </span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(progress.done / progress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
          <Button onClick={saveAll} disabled={!!progress}>
            {progress ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu tất cả
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>MSSV</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead className="w-24">Điểm</TableHead>
              <TableHead>Xếp loại</TableHead>
              <TableHead className="w-64">Ghi chú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Lớp chưa có sinh viên.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => {
                const e = edits[r.studentId] ?? { score: "", note: "" };
                const live = isValidScore(e.score)
                  ? classifyScore(Number(e.score), r.status)
                  : null;
                return (
                  <TableRow key={r.studentId}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.studentCode}</TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="h-8 w-20"
                        value={e.score}
                        disabled={!editable}
                        onChange={(ev) => update(r.studentId, { score: ev.target.value })}
                        onBlur={() => onBlurRow(r.studentId)}
                      />
                    </TableCell>
                    <TableCell>
                      {live ? <ClassificationBadge classification={live} /> : "—"}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8"
                        value={e.note}
                        disabled={!editable}
                        onChange={(ev) => update(r.studentId, { note: ev.target.value })}
                        onBlur={() => onBlurRow(r.studentId)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
