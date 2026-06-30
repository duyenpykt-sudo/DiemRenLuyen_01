import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { getClassPermission } from "@/lib/scores-access";
import { classifyScore } from "@/lib/classification";
import { scoreBatchSchema } from "@/lib/validations/score";
import type { StudentStatus } from "@/lib/enums";

// POST /api/scores/batch — lưu hàng loạt điểm cho 1 lớp + 1 học kỳ (Mode B).
export async function POST(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const parsed = scoreBatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { classId, semesterId, items } = parsed.data;

  const perm = await getClassPermission(g.session, classId);
  if (!perm.klass) return apiError("Không tìm thấy lớp.", 404);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền nhập điểm cho lớp này.", 403);
  }

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { isLocked: true },
  });
  if (!semester) return apiError("Không tìm thấy học kỳ.", 404);
  if (semester.isLocked) {
    return apiError("Học kỳ đã chốt, không thể lưu điểm.", 409);
  }

  // Chỉ chấp nhận SV thuộc đúng lớp này.
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, status: true },
  });
  const statusById = new Map(students.map((s) => [s.id, s.status]));

  try {
    const userId = g.session.user.id;
    let saved = 0;
    for (const item of items) {
      const status = statusById.get(item.studentId);
      if (!status) continue; // bỏ qua SV không thuộc lớp
      const classification = classifyScore(item.score, status as StudentStatus);
      await prisma.conductScore.upsert({
        where: {
          studentId_semesterId: { studentId: item.studentId, semesterId },
        },
        update: {
          score: item.score,
          classification,
          note: item.note || null,
          updatedById: userId,
        },
        create: {
          studentId: item.studentId,
          semesterId,
          score: item.score,
          classification,
          note: item.note || null,
          createdById: userId,
          updatedById: userId,
        },
      });
      saved++;
    }

    await writeAudit({
      userId,
      action: "UPDATE",
      entityType: "ConductScore",
      newValue: { batch: true, classId, semesterId, saved },
      req,
    });

    return apiOk({ saved });
  } catch (e) {
    return handleMutationError(e, "điểm rèn luyện");
  }
}
