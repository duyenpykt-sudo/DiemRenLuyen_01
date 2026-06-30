import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  oldPassword: z.string().min(1, { message: "Vui lòng nhập mật khẩu hiện tại" }),
  newPassword: z
    .string()
    .min(6, { message: "Mật khẩu mới tối thiểu 6 ký tự" })
    .max(72),
});

// POST /api/account/password — người dùng tự đổi mật khẩu (kiểm tra mật khẩu cũ).
export async function POST(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const user = await prisma.user.findUnique({
    where: { id: g.session.user.id },
  });
  if (!user) return apiError("Không tìm thấy tài khoản.", 404);

  const ok = await bcrypt.compare(parsed.data.oldPassword, user.passwordHash);
  if (!ok) return apiError("Mật khẩu hiện tại không đúng.", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  await writeAudit({
    userId: user.id,
    action: "CHANGE_PASSWORD",
    entityType: "User",
    entityId: user.id,
    req,
  });
  return apiOk({ changed: true });
}
