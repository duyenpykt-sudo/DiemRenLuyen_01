import { prisma } from "@/lib/db";
import type { Classification } from "@/lib/enums";

// Thứ tự 7 mức xếp loại dùng cho biểu đồ/bảng thống kê.
export const CLASS_ORDER: Classification[] = [
  "XUAT_SAC",
  "TOT",
  "KHA",
  "TRUNG_BINH",
  "YEU",
  "KEM",
  "KHONG_XEP_LOAI",
];

export function emptyCounts(): Record<Classification, number> {
  return {
    XUAT_SAC: 0,
    TOT: 0,
    KHA: 0,
    TRUNG_BINH: 0,
    YEU: 0,
    KEM: 0,
    KHONG_XEP_LOAI: 0,
  };
}

/** Phân bố xếp loại của 1 lớp trong 1 học kỳ. */
export async function classDistribution(classId: string, semesterId: string) {
  const scores = await prisma.conductScore.findMany({
    where: { semesterId, student: { classId } },
    select: { classification: true },
  });
  const counts = emptyCounts();
  scores.forEach((s) => counts[s.classification as Classification]++);
  return { counts, total: scores.length };
}

/** Lấy danh sách học kỳ (theo thứ tự) của khóa mà lớp thuộc về. */
async function cohortSemesters(classId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: { cohort: true },
  });
  if (!klass) return [];
  const years = await prisma.academicYear.findMany({
    where: {
      startYear: { gte: klass.cohort.startYear, lt: klass.cohort.endYear },
    },
    orderBy: { startYear: "asc" },
    include: { semesters: { orderBy: { number: "asc" } } },
  });
  return years.flatMap((y) =>
    y.semesters.map((s) => ({ id: s.id, label: `${y.name} HK${s.number}` }))
  );
}

/** Xu hướng điểm trung bình của 1 lớp qua các học kỳ. */
export async function classTrend(classId: string) {
  const sems = await cohortSemesters(classId);
  const result: { label: string; avg: number | null }[] = [];
  for (const sem of sems) {
    const agg = await prisma.conductScore.aggregate({
      where: { semesterId: sem.id, student: { classId } },
      _avg: { score: true },
      _count: true,
    });
    result.push({
      label: sem.label,
      avg: agg._count ? Math.round(agg._avg.score ?? 0) : null,
    });
  }
  return result;
}

/** Phân bố xếp loại toàn hệ thống (tất cả điểm đã nhập) — cho dashboard Admin. */
export async function systemDistribution() {
  const scores = await prisma.conductScore.findMany({
    select: { classification: true },
  });
  const counts = emptyCounts();
  scores.forEach((s) => counts[s.classification as Classification]++);
  return { counts, total: scores.length };
}
