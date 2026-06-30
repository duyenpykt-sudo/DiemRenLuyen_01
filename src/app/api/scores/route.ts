import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { getClassPermission } from "@/lib/scores-access";
import { classifyScore } from "@/lib/classification";
import { scoreCreateSchema } from "@/lib/validations/score";
import type { StudentStatus } from "@/lib/enums";

// GET /api/scores?classId=&semesterId= — bảng điểm 1 lớp cho 1 học kỳ.
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const semesterId = searchParams.get("semesterId");
  if (!classId || !semesterId) {
    return apiError("Thiếu tham số lớp hoặc học kỳ.", 400);
  }

  const perm = await getClassPermission(g.session, classId);
  if (!perm.klass) return apiError("Không tìm thấy lớp.", 404);
  if (!perm.canView) return apiError("Bạn không có quyền xem lớp này.", 403);

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { id: true, name: true, isLocked: true },
  });
  if (!semester) return apiError("Không tìm thấy học kỳ.", 404);

  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { studentCode: "asc" },
    select: {
      id: true,
      studentCode: true,
      citizenId: true,
      fullName: true,
      status: true,
      conductScores: {
        where: { semesterId },
        select: { id: true, score: true, classification: true, note: true },
      },
    },
  });

  const rows = students.map((s) => ({
    studentId: s.id,
    studentCode: s.studentCode,
    citizenId: s.citizenId,
    fullName: s.fullName,
    status: s.status,
    score: s.conductScores[0] ?? null,
  }));

  return apiOk({ semester, canMutate: perm.canMutate, rows });
}

// POST /api/scores — thêm điểm cho 1 SV (Mode A).
export async function POST(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const parsed = scoreCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { studentId, semesterId, score, note } = parsed.data;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, status: true },
  });
  if (!student) return apiError("Không tìm thấy sinh viên.", 404);

  const perm = await getClassPermission(g.session, student.classId);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền nhập điểm cho lớp này.", 403);
  }

  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: { isLocked: true },
  });
  if (!semester) return apiError("Không tìm thấy học kỳ.", 404);
  if (semester.isLocked) {
    return apiError("Học kỳ đã chốt, không thể nhập điểm.", 409);
  }

  // Xếp loại LUÔN tính lại server-side (không tin client).
  const classification = classifyScore(score, student.status as StudentStatus);

  try {
    const created = await prisma.conductScore.create({
      data: {
        studentId,
        semesterId,
        score,
        classification,
        note: note || null,
        createdById: g.session.user.id,
        updatedById: g.session.user.id,
      },
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "ConductScore",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "điểm rèn luyện");
  }
}
