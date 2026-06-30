import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { studentSchema } from "@/lib/validations/catalog";
import { toStudentData } from "@/lib/entity-helpers";

type Params = { params: { id: string } };

// PATCH /api/students/[id] — cập nhật sinh viên (gồm chuyển lớp, đổi trạng thái).
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = studentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const old = await prisma.student.findUnique({ where: { id: params.id } });
    const updated = await prisma.student.update({
      where: { id: params.id },
      data: toStudentData(parsed.data),
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "UPDATE",
      entityType: "Student",
      entityId: updated.id,
      oldValue: old,
      newValue: updated,
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "sinh viên");
  }
}

// DELETE /api/students/[id] — xóa sinh viên (kéo theo điểm do onDelete: Cascade).
export async function DELETE(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  try {
    const old = await prisma.student.findUnique({ where: { id: params.id } });
    await prisma.student.delete({ where: { id: params.id } });
    await writeAudit({
      userId: g.session.user.id,
      action: "DELETE",
      entityType: "Student",
      entityId: params.id,
      oldValue: old,
      req,
    });
    return apiOk({ id: params.id });
  } catch (e) {
    return handleMutationError(e, "sinh viên");
  }
}
