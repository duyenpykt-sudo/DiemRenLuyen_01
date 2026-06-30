import { auth } from "@/auth";
import { apiError } from "@/lib/api-response";
import type { Role } from "@/lib/enums";
import type { Session } from "next-auth";

type GuardResult =
  | { session: Session; error?: undefined }
  | { session?: undefined; error: ReturnType<typeof apiError> };

/**
 * Kiểm tra phiên đăng nhập + vai trò cho API route.
 * Dùng: const g = await requireRole(["ADMIN"]); if (g.error) return g.error;
 * Trả 401 nếu chưa đăng nhập, 403 nếu sai vai trò.
 */
export async function requireRole(roles: Role[]): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: apiError("Bạn cần đăng nhập.", 401) };
  }
  if (!roles.includes(session.user.role)) {
    return { error: apiError("Bạn không có quyền thực hiện thao tác này.", 403) };
  }
  return { session };
}

/** Tiện ích: chỉ cho phép Admin. */
export function requireAdmin() {
  return requireRole(["ADMIN"]);
}
