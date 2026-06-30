import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { updateUserSchema } from "@/lib/validations/catalog";
import { userSelect } from "@/lib/entity-helpers";

type Params = { params: { id: string } };

// PATCH /api/users/[id] — cập nhật người dùng (mật khẩu để trống = giữ nguyên).
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = updateUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const { password, email, phone, facultyId, ...rest } = parsed.data;
  try {
    const old = await prisma.user.findUnique({
      where: { id: params.id },
      select: userSelect,
    });
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...rest,
        email: email || null,
        phone: phone || null,
        facultyId: facultyId || null,
        // Chỉ cập nhật mật khẩu khi người dùng nhập giá trị mới.
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: userSelect,
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: updated.id,
      oldValue: old,
      newValue: updated,
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "người dùng");
  }
}

// DELETE /api/users/[id] — xóa người dùng (không cho tự xóa chính mình).
export async function DELETE(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  if (params.id === g.session.user.id) {
    return apiError("Bạn không thể xóa chính tài khoản đang đăng nhập.", 409);
  }

  try {
    const old = await prisma.user.findUnique({
      where: { id: params.id },
      select: userSelect,
    });
    await prisma.user.delete({ where: { id: params.id } });
    await writeAudit({
      userId: g.session.user.id,
      action: "DELETE",
      entityType: "User",
      entityId: params.id,
      oldValue: old,
      req,
    });
    return apiOk({ id: params.id });
  } catch (e) {
    return handleMutationError(e, "người dùng");
  }
}
