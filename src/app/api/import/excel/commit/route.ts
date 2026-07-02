import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { getClassPermission } from "@/lib/scores-access";
import { features } from "@/lib/features";
import { classifyScore } from "@/lib/classification";
import type { StudentStatus } from "@/lib/enums";

const commitSchema = z.object({
  classId: z.string().min(1),
  semesterId: z.string().min(1),
  filename: z.string().optional(),
  items: z
    .array(
      z.object({
        maSV: z.string().optional().default(""),
        cccd: z.string().optional().default(""),
        score: z.coerce.number().int().min(0).max(100),
        note: z.string().optional().default(""),
      })
    )
    .min(1),
});

// POST /api/import/excel/commit — ghi điểm đã xác nhận vào DB.
export async function POST(req: Request) {
  if (!features.importExcel) {
    return apiError("Tính năng Import Excel đang tắt.", 403);
  }
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const parsed = commitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { classId, semesterId, filename, items } = parsed.data;

  const perm = await getClassPermission(g.session, classId);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền import cho lớp này.", 403);
  }

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { isLocked: true },
  });
  if (!semester) return apiError("Không tìm thấy học kỳ.", 404);
  if (semester.isLocked) {
    return apiError("Học kỳ đã chốt, không thể import.", 409);
  }

  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, studentCode: true, citizenId: true, status: true },
  });
  const byCode = new Map(students.map((s) => [s.studentCode, s]));
  const byCccd = new Map(students.map((s) => [s.citizenId, s]));

  // Điểm đã có tại học kỳ đích → phân biệt tạo mới vs ghi đè (cho audit).
  const existing = await prisma.conductScore.findMany({
    where: { semesterId, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true },
  });
  const hasExisting = new Set(existing.map((e) => e.studentId));

  const userId = g.session.user.id;
  let created = 0;
  let overwritten = 0;
  let failed = 0;
  for (const item of items) {
    const student = byCode.get(item.maSV) ?? byCccd.get(item.cccd);
    if (!student) {
      failed++;
      continue;
    }
    const willOverwrite = hasExisting.has(student.id);
    const classification = classifyScore(
      item.score,
      student.status as StudentStatus
    );
    await prisma.conductScore.upsert({
      where: {
        studentId_semesterId: { studentId: student.id, semesterId },
      },
      update: { score: item.score, classification, note: item.note || null, updatedById: userId },
      create: {
        studentId: student.id,
        semesterId,
        score: item.score,
        classification,
        note: item.note || null,
        createdById: userId,
        updatedById: userId,
      },
    });
    if (willOverwrite) overwritten++;
    else created++;
  }

  const success = created + overwritten;
  await writeAudit({
    userId,
    action: "IMPORT_EXCEL",
    entityType: "ConductScore",
    newValue: {
      filename: filename ?? null,
      classId,
      semesterId,
      rowsTotal: items.length,
      rowsSuccess: success,
      rowsCreated: created,
      rowsOverwritten: overwritten,
      rowsFailed: failed,
    },
    req,
  });

  return apiOk({
    rowsTotal: items.length,
    rowsSuccess: success,
    rowsCreated: created,
    rowsOverwritten: overwritten,
    rowsFailed: failed,
  });
}
