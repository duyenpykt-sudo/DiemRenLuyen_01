import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { lockSemesterSchema } from "@/lib/validations/catalog";

type Params = { params: { id: string } };

// PATCH /api/semesters/[id]/lock — khóa/mở học kỳ (chặn sửa điểm khi đã chốt).
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = lockSemesterSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const old = await prisma.semester.findUnique({ where: { id: params.id } });
    const updated = await prisma.semester.update({
      where: { id: params.id },
      data: { isLocked: parsed.data.isLocked },
    });
    await writeAudit({
      userId: g.session.user.id,
      action: parsed.data.isLocked ? "LOCK" : "UNLOCK",
      entityType: "Semester",
      entityId: updated.id,
      oldValue: { isLocked: old?.isLocked },
      newValue: { isLocked: updated.isLocked },
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "học kỳ");
  }
}
