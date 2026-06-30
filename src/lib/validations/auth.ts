import { z } from "zod";

/** Schema validate form đăng nhập (dùng chung client + server). */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, { message: "Vui lòng nhập tên đăng nhập" })
    .max(50, { message: "Tên đăng nhập quá dài" }),
  password: z.string().min(1, { message: "Vui lòng nhập mật khẩu" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
