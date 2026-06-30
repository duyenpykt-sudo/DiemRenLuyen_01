"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { http } from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z
  .object({
    oldPassword: z.string().min(1, { message: "Vui lòng nhập mật khẩu hiện tại" }),
    newPassword: z.string().min(6, { message: "Mật khẩu mới tối thiểu 6 ký tự" }),
    confirm: z.string().min(1, { message: "Vui lòng xác nhận mật khẩu" }),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Xác nhận mật khẩu không khớp",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: "", newPassword: "", confirm: "" },
  });

  const save = useMutation({
    mutationFn: (v: FormData) =>
      http.post("/api/account/password", {
        oldPassword: v.oldPassword,
        newPassword: v.newPassword,
      }),
    onSuccess: () => {
      toast.success("Đã đổi mật khẩu");
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
          <CardDescription>
            Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 6 ký tự).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) => save.mutate(v))}
            className="space-y-4"
          >
            {(["oldPassword", "newPassword", "confirm"] as const).map((name) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>
                  {name === "oldPassword"
                    ? "Mật khẩu hiện tại"
                    : name === "newPassword"
                      ? "Mật khẩu mới"
                      : "Xác nhận mật khẩu mới"}
                </Label>
                <Input id={name} type="password" {...form.register(name)} />
                {form.formState.errors[name] && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors[name]?.message}
                  </p>
                )}
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đổi mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
