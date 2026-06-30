"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { http } from "@/lib/http";
import { classSchema, type ClassInput } from "@/lib/validations/catalog";
import { Role } from "@/lib/enums";
import type { ClassRow, CohortRow, FacultyRow, UserRow } from "@/types/catalog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { RowActions } from "@/components/admin/row-actions";
import { FormSelect } from "@/components/admin/form-select";
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
const EMPTY: ClassInput = {
  code: "",
  name: "",
  facultyId: "",
  cohortId: "",
  advisorId: "",
};

export default function ClassesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => http.get<ClassRow[]>("/api/classes"),
  });
  const { data: faculties = [] } = useQuery({
    queryKey: ["faculties"],
    queryFn: () => http.get<FacultyRow[]>("/api/faculties"),
  });
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => http.get<CohortRow[]>("/api/cohorts"),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => http.get<UserRow[]>("/api/users"),
  });
  const advisors = users.filter((u) => u.role === Role.CVHT);

  const form = useForm<ClassInput>({
    resolver: zodResolver(classSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              code: editing.code,
              name: editing.name,
              facultyId: editing.facultyId,
              cohortId: editing.cohortId,
              advisorId: editing.advisorId,
            }
          : EMPTY
      );
    }
  }, [open, editing, form]);

  const save = useMutation({
    mutationFn: (values: ClassInput) =>
      editing
        ? http.patch(`/api/classes/${editing.id}`, values)
        : http.post("/api/classes", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success(editing ? "Đã cập nhật lớp" : "Đã thêm lớp");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => http.del(`/api/classes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Đã xóa lớp");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<ClassRow>[] = [
    { key: "code", header: "Mã lớp", sortable: true, accessor: (r) => r.code },
    { key: "name", header: "Tên lớp", sortable: true, accessor: (r) => r.name },
    {
      key: "faculty",
      header: "Khoa",
      sortable: true,
      accessor: (r) => r.faculty.name,
    },
    {
      key: "cohort",
      header: "Khóa",
      sortable: true,
      accessor: (r) => r.cohort.name,
    },
    {
      key: "advisor",
      header: "CVHT",
      sortable: true,
      accessor: (r) => r.advisor.fullName,
    },
    {
      key: "students",
      header: "Sĩ số",
      sortable: true,
      accessor: (r) => r._count.students,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        getRowId={(r) => r.id}
        searchAccessor={(r) => `${r.code} ${r.name} ${r.advisor.fullName}`}
        searchPlaceholder="Tìm theo mã/tên lớp, CVHT…"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm lớp
          </Button>
        }
        actions={(row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            confirmDescription={`Xóa lớp "${row.code}"?`}
          />
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa lớp" : "Thêm lớp"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Mã lớp</Label>
                <Input id="code" {...form.register("code")} />
                {form.formState.errors.code && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.code.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Tên lớp</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </div>

            <FormSelect
              label="Khoa"
              placeholder="Chọn khoa"
              control={form.control}
              name="facultyId"
              options={faculties.map((f) => ({ value: f.id, label: f.name }))}
              error={form.formState.errors.facultyId?.message}
            />
            <FormSelect
              label="Khóa học"
              placeholder="Chọn khóa"
              control={form.control}
              name="cohortId"
              options={cohorts.map((c) => ({ value: c.id, label: c.name }))}
              error={form.formState.errors.cohortId?.message}
            />
            <FormSelect
              label="Cố vấn học tập"
              placeholder="Chọn CVHT"
              control={form.control}
              name="advisorId"
              options={advisors.map((u) => ({ value: u.id, label: u.fullName }))}
              error={form.formState.errors.advisorId?.message}
            />

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
