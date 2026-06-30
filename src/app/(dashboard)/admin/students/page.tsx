"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { http } from "@/lib/http";
import { studentSchema, type StudentInput } from "@/lib/validations/catalog";
import { Gender, StudentStatus } from "@/lib/enums";
import type { ClassRow, StudentRow } from "@/types/catalog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { RowActions } from "@/components/admin/row-actions";
import { FormSelect } from "@/components/admin/form-select";
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

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};
const STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: "Đang học",
  SUSPENDED: "Đình chỉ",
  GRADUATED: "Đã tốt nghiệp",
  DROPPED: "Đã nghỉ",
};
const STATUS_VARIANT: Record<
  StudentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
  GRADUATED: "secondary",
  DROPPED: "outline",
};

const EMPTY: StudentInput = {
  studentCode: "",
  citizenId: "",
  fullName: "",
  gender: "",
  dob: "",
  classId: "",
  status: "ACTIVE",
  note: "",
};

export default function StudentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => http.get<StudentRow[]>("/api/students"),
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => http.get<ClassRow[]>("/api/classes"),
  });

  const form = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              studentCode: editing.studentCode,
              citizenId: editing.citizenId,
              fullName: editing.fullName,
              gender: editing.gender ?? "",
              dob: editing.dob ? editing.dob.slice(0, 10) : "",
              classId: editing.classId,
              status: editing.status,
              note: "",
            }
          : EMPTY
      );
    }
  }, [open, editing, form]);

  const save = useMutation({
    mutationFn: (values: StudentInput) =>
      editing
        ? http.patch(`/api/students/${editing.id}`, values)
        : http.post("/api/students", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success(editing ? "Đã cập nhật sinh viên" : "Đã thêm sinh viên");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => http.del(`/api/students/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Đã xóa sinh viên");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<StudentRow>[] = [
    {
      key: "studentCode",
      header: "MSSV",
      sortable: true,
      accessor: (r) => r.studentCode,
    },
    {
      key: "fullName",
      header: "Họ tên",
      sortable: true,
      accessor: (r) => r.fullName,
    },
    { key: "citizenId", header: "CCCD", accessor: (r) => r.citizenId },
    {
      key: "class",
      header: "Lớp",
      sortable: true,
      accessor: (r) => r.class.code,
    },
    {
      key: "status",
      header: "Trạng thái",
      sortable: true,
      accessor: (r) => r.status,
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]}>
          {STATUS_LABEL[r.status]}
        </Badge>
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
        searchAccessor={(r) => `${r.studentCode} ${r.fullName} ${r.citizenId}`}
        searchPlaceholder="Tìm theo MSSV, họ tên, CCCD…"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm sinh viên
          </Button>
        }
        actions={(row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            confirmDescription={`Xóa sinh viên "${row.fullName}" (${row.studentCode})? Mọi điểm rèn luyện của SV cũng sẽ bị xóa.`}
          />
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Sửa sinh viên" : "Thêm sinh viên"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentCode">MSSV</Label>
                <Input
                  id="studentCode"
                  placeholder="221CTT006"
                  {...form.register("studentCode")}
                />
                {form.formState.errors.studentCode && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.studentCode.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="citizenId">CCCD</Label>
                <Input
                  id="citizenId"
                  placeholder="12 chữ số"
                  {...form.register("citizenId")}
                />
                {form.formState.errors.citizenId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.citizenId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Họ tên</Label>
              <Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.fullName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Giới tính"
                placeholder="Chọn giới tính"
                control={form.control}
                name="gender"
                options={Object.values(Gender).map((g) => ({
                  value: g,
                  label: GENDER_LABEL[g],
                }))}
              />
              <div className="space-y-2">
                <Label htmlFor="dob">Ngày sinh</Label>
                <Input id="dob" type="date" {...form.register("dob")} />
                {form.formState.errors.dob && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.dob.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Lớp"
                placeholder="Chọn lớp"
                control={form.control}
                name="classId"
                options={classes.map((c) => ({ value: c.id, label: c.code }))}
                error={form.formState.errors.classId?.message}
              />
              <FormSelect
                label="Trạng thái"
                placeholder="Chọn trạng thái"
                control={form.control}
                name="status"
                options={Object.values(StudentStatus).map((s) => ({
                  value: s,
                  label: STATUS_LABEL[s],
                }))}
                error={form.formState.errors.status?.message}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Input id="note" {...form.register("note")} />
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
