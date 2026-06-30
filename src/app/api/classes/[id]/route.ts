import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { classSchema } from "@/lib/validations/catalog";

type Params = { params: { id: string } };

// PATCH /api/classes/[id] — cập nhật lớp.
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = classSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const old = await prisma.class.findUnique({ where: { id: params.id } });
    const updated = await prisma.class.update({
      where: { id: params.id },
      data: parsed.data,
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "UPDATE",
      entityType: "Class",
      entityId: updated.id,
      oldValue: old,
      newValue: updated,
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "lớp");
  }
}

// DELETE /api/classes/[id] — xóa lớp.
export async function DELETE(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  try {
    const old = await prisma.class.findUnique({ where: { id: params.id } });
    await prisma.class.delete({ where: { id: params.id } });
    await writeAudit({
      userId: g.session.user.id,
      action: "DELETE",
      entityType: "Class",
      entityId: params.id,
      oldValue: old,
      req,
    });
    return apiOk({ id: params.id });
  } catch (e) {
    return handleMutationError(e, "lớp");
  }
}
