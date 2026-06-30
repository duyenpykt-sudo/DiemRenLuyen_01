import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware bảo vệ route — chỉ dùng cấu hình edge-safe (không Prisma/bcrypt).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  /**
   * Áp dụng cho mọi route TRỪ:
   * - /api/auth (next-auth nội bộ), /api/config (public feature flags)
   * - _next (asset Next.js), favicon, và các file tĩnh có đuôi.
   */
  matcher: [
    "/((?!api/auth|api/config|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};
