"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { http } from "@/lib/http";
import { cohortSchema, type CohortInput } from "@/lib/validations/catalog";
import type { CohortRow } from "@/types/catalog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { RowActions } from "@/components/admin/row-actions";
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

const EMPTY: CohortInput = { name: "", startYear: 2022, endYear: 2026 };

export default function CohortsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CohortRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => http.get<CohortRow[]>("/api/cohorts"),
  });

  const form = useForm<CohortInput>({
    resolver: zodResolver(cohortSchema),
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

  const save = useMutation({
    mutationFn: (values: CohortInput) =>
      editing
        ? http.patch(`/api/cohorts/${editing.id}`, values)
        : http.post("/api/cohorts", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohorts"] });
      toast.success(editing ? "Đã cập nhật khóa học" : "Đã thêm khóa học");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => http.del(`/api/cohorts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohorts"] });
      toast.success("Đã xóa khóa học");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<CohortRow>[] = [
    { key: "name", header: "Tên khóa", sortable: true, accessor: (r) => r.name },
    {
      key: "startYear",
      header: "Năm bắt đầu",
      sortable: true,
      accessor: (r) => r.startYear,
    },
    {
      key: "endYear",
      header: "Năm kết thúc",
      sortable: true,
      accessor: (r) => r.endYear,
    },
    {
      key: "classes",
      header: "Số lớp",
      sortable: true,
      accessor: (r) => r._count.classes,
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
        searchPlaceholder="Tìm theo tên khóa…"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm khóa học
          </Button>
        }
        actions={(row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            confirmDescription={`Xóa khóa "${row.name}"?`}
          />
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Sửa khóa học" : "Thêm khóa học"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Tên khóa</Label>
              <Input id="name" placeholder="vd: K22" {...form.register("name")} />
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
                <Input
                  id="endYear"
                  type="number"
                  {...form.register("endYear")}
                />
                {form.formState.errors.endYear && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.endYear.message}
                  </p>
                )}
              </div>
            </div>
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
