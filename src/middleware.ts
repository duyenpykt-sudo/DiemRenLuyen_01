import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware bảo vệ route — chỉ dùng cấu hình edge-safe (không Prisma/bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  /**
   * Áp dụng cho mọi PAGE route TRỪ:
   * - /api/* (các API tự kiểm tra session + role qua lib/guard.ts)
   * - _next (asset Next.js), favicon, và các file tĩnh có đuôi.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
