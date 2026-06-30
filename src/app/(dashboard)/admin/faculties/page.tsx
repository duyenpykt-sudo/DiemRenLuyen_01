"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { http } from "@/lib/http";
import { facultySchema, type FacultyInput } from "@/lib/validations/catalog";
import type { FacultyRow } from "@/types/catalog";
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

export default function FacultiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FacultyRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["faculties"],
    queryFn: () => http.get<FacultyRow[]>("/api/faculties"),
  });

  const form = useForm<FacultyInput>({
    resolver: zodResolver(facultySchema),
    defaultValues: { code: "", name: "" },
  });

  // Đồng bộ form khi mở dialog (tạo mới: rỗng; sửa: prefill).
  useEffect(() => {
    if (open) {
      form.reset(editing ? { code: editing.code, name: editing.name } : { code: "", name: "" });
    }
  }, [open, editing, form]);

  const save = useMutation({
    mutationFn: (values: FacultyInput) =>
      editing
        ? http.patch(`/api/faculties/${editing.id}`, values)
        : http.post("/api/faculties", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faculties"] });
      toast.success(editing ? "Đã cập nhật khoa" : "Đã thêm khoa");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => http.del(`/api/faculties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faculties"] });
      toast.success("Đã xóa khoa");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<FacultyRow>[] = [
    { key: "code", header: "Mã khoa", sortable: true, accessor: (r) => r.code },
    { key: "name", header: "Tên khoa", sortable: true, accessor: (r) => r.name },
    {
      key: "classes",
      header: "Số lớp",
      sortable: true,
      accessor: (r) => r._count.classes,
    },
    {
      key: "users",
      header: "Số người dùng",
      sortable: true,
      accessor: (r) => r._count.users,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        searchAccessor={(r) => `${r.code} ${r.name}`}
        searchPlaceholder="Tìm theo mã/tên khoa…"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm khoa
          </Button>
        }
        actions={(row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            confirmDescription={`Xóa khoa "${row.name}"? Thao tác này không thể hoàn tác.`}
          />
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa khoa" : "Thêm khoa"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="code">Mã khoa</Label>
              <Input id="code" {...form.register("code")} />
              {form.formState.errors.code && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Tên khoa</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
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
