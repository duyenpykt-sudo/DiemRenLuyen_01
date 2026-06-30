"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { http } from "@/lib/http";
import { classifyScore } from "@/lib/classification";
import type { ScoreRow } from "@/types/score";
import { ClassificationBadge } from "@/components/scores/classification-badge";
import {
  StudentCombobox,
  type StudentOption,
} from "@/components/scores/student-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RowActions } from "@/components/admin/row-actions";

type DialogState = { mode: "create" | "edit"; row?: ScoreRow } | null;

export function ModeA({
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
  void classId;
  const editable = canMutate && !locked;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [studentId, setStudentId] = useState("");
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");

  const availableStudents: StudentOption[] = rows
    .filter((r) => !r.score)
    .map((r) => ({
      studentId: r.studentId,
      studentCode: r.studentCode,
      fullName: r.fullName,
    }));

  function openCreate(preselect?: string) {
    setStudentId(preselect ?? "");
    setScore("");
    setNote("");
    setDialog({ mode: "create" });
  }

  function openEdit(row: ScoreRow) {
    setStudentId(row.studentId);
    setScore(String(row.score?.score ?? ""));
    setNote(row.score?.note ?? "");
    setDialog({ mode: "edit", row });
  }

  const save = useMutation({
    mutationFn: () => {
      const numScore = Number(score);
      if (dialog?.mode === "edit" && dialog.row?.score) {
        return http.patch(`/api/scores/${dialog.row.score.id}`, {
          score: numScore,
          note,
        });
      }
      return http.post("/api/scores", {
        studentId,
        semesterId,
        score: numScore,
        note,
      });
    },
    onSuccess: () => {
      toast.success("Đã lưu điểm");
      setDialog(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (scoreId: string) => http.del(`/api/scores/${scoreId}`),
    onSuccess: () => {
      toast.success("Đã xóa điểm");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit() {
    if (!studentId) return toast.error("Vui lòng chọn sinh viên");
    const n = Number(score);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return toast.error("Điểm phải là số nguyên 0–100");
    }
    save.mutate();
  }

  // Xếp loại xem trước (client) — server vẫn tính lại khi lưu.
  const selectedStatus =
    rows.find((r) => r.studentId === studentId)?.status ?? "ACTIVE";
  const previewClass =
    score !== "" && !Number.isNaN(Number(score))
      ? classifyScore(Number(score), selectedStatus)
      : null;

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex justify-end">
          <Button onClick={() => openCreate()} disabled={availableStudents.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm điểm
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>CCCD</TableHead>
              <TableHead>MSSV</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead className="w-20">Điểm</TableHead>
              <TableHead>Xếp loại</TableHead>
              <TableHead>Ghi chú</TableHead>
              {editable && <TableHead className="text-right">Hành động</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={editable ? 8 : 7} className="h-24 text-center text-muted-foreground">
                  Lớp chưa có sinh viên.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => (
                <TableRow key={r.studentId}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{r.citizenId}</TableCell>
                  <TableCell className="font-medium">{r.studentCode}</TableCell>
                  <TableCell>{r.fullName}</TableCell>
                  <TableCell>{r.score ? r.score.score : "—"}</TableCell>
                  <TableCell>
                    {r.score ? (
                      <ClassificationBadge classification={r.score.classification} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.score?.note || ""}
                  </TableCell>
                  {editable && (
                    <TableCell className="text-right">
                      {r.score ? (
                        <RowActions
                          onEdit={() => openEdit(r)}
                          onDelete={() => remove.mutate(r.score!.id)}
                          confirmDescription={`Xóa điểm của ${r.fullName}?`}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreate(r.studentId)}
                        >
                          Nhập điểm
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Sửa điểm" : "Thêm điểm"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sinh viên</Label>
              {dialog?.mode === "edit" ? (
                <Input
                  disabled
                  value={`${dialog.row?.studentCode} — ${dialog.row?.fullName}`}
                />
              ) : (
                <StudentCombobox
                  students={availableStudents}
                  value={studentId}
                  onChange={setStudentId}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="score">Điểm (0–100)</Label>
                <Input
                  id="score"
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Xếp loại (tự động)</Label>
                <div className="flex h-10 items-center">
                  {previewClass ? (
                    <ClassificationBadge classification={previewClass} />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onSubmit} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
