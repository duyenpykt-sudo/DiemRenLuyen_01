import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/enums";

/**
 * Cấu hình next-auth dùng chung — phần KHÔNG phụ thuộc Node (Prisma/bcrypt),
 * an toàn để chạy trên Edge runtime (middleware). Phần Credentials.authorize
 * (cần Prisma + bcrypt) được thêm riêng trong src/auth.ts.
 *
 * Tách file theo pattern khuyến nghị của next-auth v5 (migrating-to-v5).
 */

// Phiên hết hạn sau 30 phút không thao tác (mục 5.1 PRD). Lấy từ env, mặc định 1800s.
const sessionMaxAge = Number(process.env.SESSION_MAX_AGE ?? 1800);

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: sessionMaxAge,
  },
  providers: [], // Credentials được nạp trong src/auth.ts (cần Node runtime)
  callbacks: {
    // Bảo vệ route: chưa đăng nhập → chặn; đã đăng nhập mà vào /login → về dashboard.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    // Đưa thông tin nghiệp vụ vào JWT khi đăng nhập.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.username = user.username;
        token.role = user.role;
        token.facultyId = user.facultyId;
      }
      return token;
    },
    // Đổ thông tin từ JWT ra session để dùng ở server/client.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as Role;
        session.user.facultyId = (token.facultyId as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
