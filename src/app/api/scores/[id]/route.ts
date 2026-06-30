import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { getClassPermission } from "@/lib/scores-access";
import { classifyScore } from "@/lib/classification";
import { scoreUpdateSchema } from "@/lib/validations/score";
import type { StudentStatus } from "@/lib/enums";

type Params = { params: { id: string } };

// Lấy điểm + thông tin lớp/HK để kiểm tra quyền và trạng thái khóa.
async function loadScore(id: string) {
  return prisma.conductScore.findUnique({
    where: { id },
    include: {
      student: { select: { classId: true, status: true } },
      semester: { select: { isLocked: true } },
    },
  });
}

// PATCH /api/scores/[id] — sửa điểm/ghi chú (Mode A + inline).
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const parsed = scoreUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  const existing = await loadScore(params.id);
  if (!existing) return apiError("Không tìm thấy điểm.", 404);

  const perm = await getClassPermission(g.session, existing.student.classId);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền sửa điểm của lớp này.", 403);
  }
  if (existing.semester.isLocked) {
    return apiError("Học kỳ đã chốt, không thể sửa điểm.", 409);
  }

  const classification = classifyScore(
    parsed.data.score,
    existing.student.status as StudentStatus
  );

  try {
    const updated = await prisma.conductScore.update({
      where: { id: params.id },
      data: {
        score: parsed.data.score,
        classification,
        note: parsed.data.note || null,
        updatedById: g.session.user.id,
      },
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "UPDATE",
      entityType: "ConductScore",
      entityId: updated.id,
      oldValue: {
        score: existing.score,
        classification: existing.classification,
        note: existing.note,
      },
      newValue: {
        score: updated.score,
        classification: updated.classification,
        note: updated.note,
      },
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "điểm rèn luyện");
  }
}

// DELETE /api/scores/[id] — xóa điểm.
export async function DELETE(req: Request, { params }: Params) {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const existing = await loadScore(params.id);
  if (!existing) return apiError("Không tìm thấy điểm.", 404);

  const perm = await getClassPermission(g.session, existing.student.classId);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền xóa điểm của lớp này.", 403);
  }
  if (existing.semester.isLocked) {
    return apiError("Học kỳ đã chốt, không thể xóa điểm.", 409);
  }

  try {
    await prisma.conductScore.delete({ where: { id: params.id } });
    await writeAudit({
      userId: g.session.user.id,
      action: "DELETE",
      entityType: "ConductScore",
      entityId: params.id,
      oldValue: {
        score: existing.score,
        classification: existing.classification,
        note: existing.note,
      },
      req,
    });
    return apiOk({ id: params.id });
  } catch (e) {
    return handleMutationError(e, "điểm rèn luyện");
  }
}
