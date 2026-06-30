import { prisma } from "@/lib/db";
import { apiOk } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getViewableClasses } from "@/lib/scores-access";
import type { Classification } from "@/lib/enums";

// GET /api/search/students — tra cứu nâng cao (lọc theo phạm vi xem được).
// Tham số: q, facultyId, classId, semesterId, classification, minScore, maxScore
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const facultyId = sp.get("facultyId") ?? "";
  const classId = sp.get("classId") ?? "";
  const semesterId = sp.get("semesterId") ?? "";
  const classification = sp.get("classification") ?? "";
  const minScore = sp.get("minScore");
  const maxScore = sp.get("maxScore");

  // Phạm vi lớp xem được theo vai trò.
  const classes = await getViewableClasses(g.session);
  let scopeIds = classes.map((c) => c.id);
  if (classId) scopeIds = scopeIds.filter((id) => id === classId);

  const students = await prisma.student.findMany({
    where: {
      classId: { in: scopeIds },
      ...(facultyId ? { class: { facultyId } } : {}),
      ...(q
        ? {
            OR: [
              { studentCode: { contains: q } },
              { citizenId: { contains: q } },
              { fullName: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { studentCode: "asc" },
    select: {
      id: true,
      studentCode: true,
      citizenId: true,
      fullName: true,
      class: { select: { code: true } },
      ...(semesterId
        ? {
            conductScores: {
              where: { semesterId },
              select: { score: true, classification: true },
            },
          }
        : {}),
    },
    take: 300,
  });

  type Row = (typeof students)[number] & {
    conductScores?: { score: number; classification: string }[];
  };

  let rows = (students as Row[]).map((s) => {
    const sc = s.conductScores?.[0];
    return {
      id: s.id,
      studentCode: s.studentCode,
      citizenId: s.citizenId,
      fullName: s.fullName,
      classCode: s.class.code,
      score: sc?.score ?? null,
      classification: (sc?.classification as Classification | undefined) ?? null,
    };
  });

  // Lọc theo xếp loại / khoảng điểm (chỉ khi đã chọn học kỳ).
  if (semesterId) {
    if (classification) rows = rows.filter((r) => r.classification === classification);
    if (minScore) rows = rows.filter((r) => r.score != null && r.score >= Number(minScore));
    if (maxScore) rows = rows.filter((r) => r.score != null && r.score <= Number(maxScore));
  }

  return apiOk(rows);
}
