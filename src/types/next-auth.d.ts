import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/enums";

/**
 * Mở rộng kiểu Session/User của next-auth để mang thêm thông tin nghiệp vụ:
 * role, username, facultyId — phục vụ phân quyền (row-level access mục 6.4 PRD).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      facultyId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: Role;
    facultyId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
    facultyId: string | null;
  }
}
