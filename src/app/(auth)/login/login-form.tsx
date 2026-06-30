"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, GraduationCap } from "lucide-react";

import { loginSchema, type LoginInput } from "@/lib/validations/auth";
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

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        username: values.username,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Đăng nhập thất bại", {
          description: "Tên đăng nhập hoặc mật khẩu không đúng.",
        });
        return;
      }

      toast.success("Đăng nhập thành công");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-lg shadow-primary/5">
      <CardHeader className="space-y-3 text-center">
        <div className="bg-gradient-brand mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-primary/30 lg:hidden">
          <GraduationCap className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">
          Chào mừng trở lại
        </CardTitle>
        <CardDescription>
          Đăng nhập để tiếp tục quản lý điểm rèn luyện
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="vd: admin"
              disabled={isLoading}
              {...register("username")}
            />
            {errors.username && (
              <p className="text-sm text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Đăng nhập
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
