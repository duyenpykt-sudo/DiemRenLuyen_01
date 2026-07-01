"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock, LockOpen, Plus } from "lucide-react";

import { http } from "@/lib/http";
import {
  academicYearSchema,
  type AcademicYearInput,
} from "@/lib/validations/catalog";
import type { AcademicYearRow } from "@/types/catalog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { RowActions } from "@/components/admin/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMPTY: AcademicYearInput = { name: "", startYear: 2025, endYear: 2026 };

export default function AcademicYearsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYearRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => http.get<AcademicYearRow[]>("/api/academic-years"),
  });

  const form = useForm<AcademicYearInput>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? { name: editing.name, startYear: editing.startYear, endYear: editing.endYear }
          : EMPTY
      );
    }
  }, [open, editing, form]);

  // Tự điền Năm kết thúc + Tên khi nhập Năm bắt đầu (chỉ khi thêm mới) — mục 5.3.1.
  // Vẫn cho sửa tay sau đó.
  const startYear = form.watch("startYear");
  useEffect(() => {
    if (!open || editing) return;
    const sy = Number(startYear);
    if (Number.isInteger(sy) && sy >= 2000 && sy <= 2100) {
      form.setValue("endYear", sy + 1);
      form.setValue("name", `${sy}-${sy + 1}`);
    }
  }, [startYear, open, editing, form]);

  const save = useMutation({
    mutationFn: (values: AcademicYearInput) =>
      editing
        ? http.patch(`/api/academic-years/${editing.id}`, values)
        : http.post("/api/academic-years", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(
        editing ? "Đã cập nhật năm học" : "Đã thêm năm học (kèm HK1, HK2)"
      );
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => http.del(`/api/academic-years/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Đã xóa năm học");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleLock = useMutation({
    mutationFn: (vars: { id: string; isLocked: boolean }) =>
      http.patch(`/api/semesters/${vars.id}/lock`, { isLocked: vars.isLocked }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(vars.isLocked ? "Đã khóa học kỳ" : "Đã mở khóa học kỳ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<AcademicYearRow>[] = [
    {
      key: "name",
      header: "Tên năm học",
      sortable: true,
      accessor: (r) => r.name,
    },
    {
      key: "semesters",
      header: "Học kỳ",
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          {r.semesters.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1">
              <Badge variant={s.isLocked ? "secondary" : "outline"}>
                {s.name}
                {s.isLocked && " · đã chốt"}
                {typeof s._count?.conductScores === "number" &&
                  ` · ${s._count.conductScores} điểm`}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={s.isLocked ? "Mở khóa học kỳ" : "Khóa học kỳ"}
                onClick={() =>
                  toggleLock.mutate({ id: s.id, isLocked: !s.isLocked })
                }
              >
                {s.isLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" />
                )}
              </Button>
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        searchAccessor={(r) => r.name}
        searchPlaceholder="Tìm theo tên năm học…"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm năm học
          </Button>
        }
        actions={(row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            confirmDescription={`Xóa năm học "${row.name}" và các học kỳ của nó?`}
          />
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Sửa năm học" : "Thêm năm học"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Tên năm học</Label>
              <Input
                id="name"
                placeholder="vd: 2025-2026"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startYear">Năm bắt đầu</Label>
                <Input
                  id="startYear"
                  type="number"
                  {...form.register("startYear")}
                />
                {form.formState.errors.startYear && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.startYear.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endYear">Năm kết thúc</Label>
                <Input id="endYear" type="number" {...form.register("endYear")} />
                {form.formState.errors.endYear && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.endYear.message}
                  </p>
                )}
              </div>
            </div>
            {!editing && (
              <p className="text-sm text-muted-foreground">
                Hệ thống sẽ tự tạo Học kỳ 1 và Học kỳ 2 cho năm học này.
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
