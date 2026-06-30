import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { facultySchema } from "@/lib/validations/catalog";

type Params = { params: { id: string } };

// PATCH /api/faculties/[id] — cập nhật khoa.
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = facultySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const old = await prisma.faculty.findUnique({ where: { id: params.id } });
    const updated = await prisma.faculty.update({
      where: { id: params.id },
      data: parsed.data,
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "UPDATE",
      entityType: "Faculty",
      entityId: updated.id,
      oldValue: old,
      newValue: updated,
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "khoa");
  }
}

// DELETE /api/faculties/[id] — xóa khoa.
export async function DELETE(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  try {
    const old = await prisma.faculty.findUnique({ where: { id: params.id } });
    await prisma.faculty.delete({ where: { id: params.id } });
    await writeAudit({
      userId: g.session.user.id,
      action: "DELETE",
      entityType: "Faculty",
      entityId: params.id,
      oldValue: old,
      req,
    });
    return apiOk({ id: params.id });
  } catch (e) {
    return handleMutationError(e, "khoa");
  }
}
