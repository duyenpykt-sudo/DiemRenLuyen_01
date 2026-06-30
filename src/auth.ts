import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import type { Role } from "@/lib/enums";

/**
 * Instance next-auth đầy đủ (chạy trên Node runtime).
 * Credentials provider: kiểm tra username + password (bcrypt) trong DB.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Tên đăng nhập" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        // Validate input bằng Zod trước khi truy vấn.
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { username } });

        // Không tồn tại, bị khóa, hoặc sai mật khẩu → từ chối.
        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role as Role,
          facultyId: user.facultyId,
        };
      },
    }),
  ],
});
