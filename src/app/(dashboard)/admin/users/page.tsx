"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { http } from "@/lib/http";
import { updateUserSchema, type UpdateUserInput } from "@/lib/validations/catalog";
import { Role } from "@/lib/enums";
import type { FacultyRow, UserRow } from "@/types/catalog";
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

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  CVHT: "Cố vấn học tập",
  TRUONG_KHOA: "Trưởng khoa",
};

const EMPTY: UpdateUserInput = {
  username: "",
  fullName: "",
  email: "",
  phone: "",
  role: "CVHT",
  facultyId: "",
  isActive: true,
  password: "",
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => http.get<UserRow[]>("/api/users"),
  });
  const { data: faculties = [] } = useQuery({
    queryKey: ["faculties"],
    queryFn: () => http.get<FacultyRow[]>("/api/faculties"),
  });

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              username: editing.username,
              fullName: editing.fullName,
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              role: editing.role,
              facultyId: editing.facultyId ?? "",
              isActive: editing.isActive,
              password: "",
            }
          : EMPTY
      );
    }
  }, [open, editing, form]);

  const save = useMutation({
    mutationFn: (values: UpdateUserInput) =>
      editing
        ? http.patch(`/api/users/${editing.id}`, values)
        : http.post("/api/users", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(editing ? "Đã cập nhật người dùng" : "Đã thêm người dùng");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => http.del(`/api/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Đã xóa người dùng");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(values: UpdateUserInput) {
    // Tạo mới bắt buộc nhập mật khẩu (cập nhật thì để trống = giữ nguyên).
    if (!editing && !values.password) {
      form.setError("password", { message: "Vui lòng nhập mật khẩu" });
      return;
    }
    save.mutate(values);
  }

  const columns: Column<UserRow>[] = [
    {
      key: "username",
      header: "Tên đăng nhập",
      sortable: true,
      accessor: (r) => r.username,
    },
    {
      key: "fullName",
      header: "Họ tên",
      sortable: true,
      accessor: (r) => r.fullName,
    },
    {
      key: "role",
      header: "Vai trò",
      sortable: true,
      accessor: (r) => r.role,
      cell: (r) => <Badge variant="secondary">{ROLE_LABEL[r.role]}</Badge>,
    },
    {
      key: "faculty",
      header: "Khoa",
      accessor: (r) => r.faculty?.name ?? "—",
      cell: (r) => r.faculty?.name ?? "—",
    },
    {
      key: "isActive",
      header: "Trạng thái",
      sortable: true,
      accessor: (r) => (r.isActive ? 1 : 0),
      cell: (r) => (
        <Badge variant={r.isActive ? "default" : "outline"}>
          {r.isActive ? "Hoạt động" : "Đã khóa"}
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
        searchAccessor={(r) => `${r.username} ${r.fullName}`}
        searchPlaceholder="Tìm theo tên đăng nhập, họ tên…"
        toolbar={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm người dùng
          </Button>
        }
        actions={(row) => (
          <RowActions
            onEdit={() => {
              setEditing(row);
              setOpen(true);
            }}
            onDelete={() => remove.mutate(row.id)}
            confirmDescription={`Xóa người dùng "${row.username}"?`}
          />
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Sửa người dùng" : "Thêm người dùng"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Tên đăng nhập</Label>
                <Input
                  id="username"
                  disabled={!!editing}
                  {...form.register("username")}
                />
                {form.formState.errors.username && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.username.message}
                  </p>
                )}
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Điện thoại</Label>
                <Input id="phone" {...form.register("phone")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Vai trò"
                placeholder="Chọn vai trò"
                control={form.control}
                name="role"
                options={Object.values(Role).map((r) => ({
                  value: r,
                  label: ROLE_LABEL[r],
                }))}
                error={form.formState.errors.role?.message}
              />
              <FormSelect
                label="Khoa (tùy chọn)"
                placeholder="Chọn khoa"
                control={form.control}
                name="facultyId"
                options={faculties.map((f) => ({ value: f.id, label: f.name }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {editing ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...form.register("isActive")}
              />
              Tài khoản hoạt động
            </label>

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
