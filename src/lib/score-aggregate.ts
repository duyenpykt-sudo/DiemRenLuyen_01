import { prisma } from "@/lib/db";
import {
  getYearScore as avgYear,
  getCourseScore,
} from "@/lib/classification";

/**
 * Điểm năm học của 1 SV (mục 5.10 prompt Tuần 5):
 * round((HKI + HKII) / 2), trả null nếu thiếu 1 học kỳ.
 */
export async function getYearScore(
  studentId: string,
  academicYearId: string
): Promise<number | null> {
  const sems = await prisma.semester.findMany({
    where: { academicYearId },
    select: { id: true, number: true },
  });
  const hk1 = sems.find((s) => s.number === 1)?.id;
  const hk2 = sems.find((s) => s.number === 2)?.id;

  const scores = await prisma.conductScore.findMany({
    where: {
      studentId,
      semesterId: { in: [hk1, hk2].filter(Boolean) as string[] },
    },
    select: { semesterId: true, score: true },
  });
  const v1 = scores.find((s) => s.semesterId === hk1)?.score ?? null;
  const v2 = scores.find((s) => s.semesterId === hk2)?.score ?? null;
  return avgYear(v1, v2);
}

/**
 * Điểm toàn khóa của 1 SV: round(sum / count) các HK có điểm,
 * kèm cờ isComplete (đủ 8 HK hay chưa).
 */
export async function getCohortScore(
  studentId: string,
  cohortId: string
): Promise<{ score: number | null; isComplete: boolean }> {
  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) return { score: null, isComplete: false };

  const years = await prisma.academicYear.findMany({
    where: { startYear: { gte: cohort.startYear, lt: cohort.endYear } },
    select: { semesters: { select: { id: true } } },
  });
  const semIds = years.flatMap((y) => y.semesters.map((s) => s.id));

  const scores = await prisma.conductScore.findMany({
    where: { studentId, semesterId: { in: semIds } },
    select: { score: true },
  });
  return getCourseScore(scores.map((s) => s.score));
}
