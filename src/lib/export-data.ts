import { prisma } from "@/lib/db";
import {
  classifyScore,
  getYearScore,
  getCourseScore,
} from "@/lib/classification";
import type { Classification, StudentStatus } from "@/lib/enums";
import type {
  CohortRowData,
  FacultyClassRow,
  SemesterRowData,
  YearRowData,
} from "@/lib/excel-export";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const emptyCounts = (): Record<Classification, number> => ({
  XUAT_SAC: 0,
  TOT: 0,
  KHA: 0,
  TRUNG_BINH: 0,
  YEU: 0,
  KEM: 0,
  KHONG_XEP_LOAI: 0,
});

// ─── Học kỳ (1 lớp) ───
export async function buildClassSemester(classId: string, semesterId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: { faculty: true, advisor: true },
  });
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    include: { academicYear: true },
  });
  if (!klass || !semester) return null;

  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { studentCode: "asc" },
    include: { conductScores: { where: { semesterId } } },
  });

  const rows: SemesterRowData[] = students.map((s) => {
    const sc = s.conductScores[0];
    return {
      cccd: s.citizenId,
      studentCode: s.studentCode,
      fullName: s.fullName,
      score: sc?.score ?? null,
      classification: (sc?.classification as Classification) ?? null,
      note: sc?.note ?? "",
    };
  });

  return {
    meta: {
      facultyName: klass.faculty.name,
      classCode: klass.code,
      advisorName: klass.advisor.fullName,
    },
    semesterNumber: semester.number,
    academicYearName: semester.academicYear.name,
    rows,
    filenameHint: `RL-HK${semester.number}-${klass.code}`,
  };
}

// ─── Năm học (1 lớp) ───
export async function buildClassYear(classId: string, academicYearId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: { faculty: true, advisor: true },
  });
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    include: { semesters: true },
  });
  if (!klass || !year) return null;

  const hk1 = year.semesters.find((s) => s.number === 1);
  const hk2 = year.semesters.find((s) => s.number === 2);
  const semIds = [hk1?.id, hk2?.id].filter(Boolean) as string[];

  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { studentCode: "asc" },
    include: { conductScores: { where: { semesterId: { in: semIds } } } },
  });

  const rows: YearRowData[] = students.map((s) => {
    const s1 = s.conductScores.find((c) => c.semesterId === hk1?.id);
    const s2 = s.conductScores.find((c) => c.semesterId === hk2?.id);
    const yearScore = getYearScore(s1?.score ?? null, s2?.score ?? null);
    return {
      cccd: s.citizenId,
      studentCode: s.studentCode,
      fullName: s.fullName,
      hk1: s1?.score ?? null,
      cls1: (s1?.classification as Classification) ?? null,
      hk2: s2?.score ?? null,
      cls2: (s2?.classification as Classification) ?? null,
      year: yearScore,
      clsYear:
        yearScore != null
          ? classifyScore(yearScore, s.status as StudentStatus)
          : null,
      note: "",
    };
  });

  return {
    meta: {
      facultyName: klass.faculty.name,
      classCode: klass.code,
      advisorName: klass.advisor.fullName,
    },
    academicYearName: year.name,
    rows,
    filenameHint: `RL-NH-${year.name}-${klass.code}`,
  };
}

// Lấy danh sách (tối đa 8) học kỳ thuộc 1 khóa, theo thứ tự HK I..VIII.
async function cohortSemesterIds(startYear: number, endYear: number) {
  const years = await prisma.academicYear.findMany({
    where: { startYear: { gte: startYear, lt: endYear } },
    orderBy: { startYear: "asc" },
    include: { semesters: { orderBy: { number: "asc" } } },
  });
  return years.flatMap((y) => y.semesters.map((s) => s.id));
}

// ─── Khóa học (1 lớp) ───
export async function buildClassCohort(classId: string) {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    include: { faculty: true, advisor: true, cohort: true },
  });
  if (!klass) return null;

  const semIds = await cohortSemesterIds(
    klass.cohort.startYear,
    klass.cohort.endYear
  );
  const students = await prisma.student.findMany({
    where: { classId },
    orderBy: { studentCode: "asc" },
    include: { conductScores: true },
  });

  const rows: CohortRowData[] = students.map((s) => {
    const bySem = new Map(s.conductScores.map((c) => [c.semesterId, c.score]));
    const scores = semIds.map((id) => bySem.get(id) ?? null);
    const present = scores.filter((x): x is number => x != null);
    const course = getCourseScore(present);
    return {
      cccd: s.citizenId,
      studentCode: s.studentCode,
      fullName: s.fullName,
      scores,
      total: course.score,
      classification:
        course.score != null
          ? classifyScore(course.score, s.status as StudentStatus)
          : null,
      note: "",
    };
  });

  return {
    meta: {
      facultyName: klass.faculty.name,
      classCode: klass.code,
      advisorName: klass.advisor.fullName,
    },
    cohortName: `${klass.cohort.startYear}-${klass.cohort.endYear}`,
    rows,
    filenameHint: `RL-KH-${klass.code}`,
  };
}

// ─── Tổng hợp khoa ───
export async function buildFacultySummary(
  facultyId: string,
  scope: "HK" | "NH" | "TK",
  opts: { semesterId?: string; academicYearId?: string; cohortId?: string }
) {
  const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
  if (!faculty) return null;

  // Lọc lớp theo phạm vi (TK: chỉ lớp thuộc khóa được chọn).
  const classes = await prisma.class.findMany({
    where: {
      facultyId,
      ...(scope === "TK" && opts.cohortId ? { cohortId: opts.cohortId } : {}),
    },
    orderBy: { code: "asc" },
    include: { cohort: true },
  });

  const result: FacultyClassRow[] = [];
  let subtitle = "";

  if (scope === "HK") {
    const semester = await prisma.semester.findUnique({
      where: { id: opts.semesterId ?? "" },
      include: { academicYear: true },
    });
    subtitle = semester
      ? `HỌC KỲ: ${ROMAN[semester.number]}, NĂM HỌC: ${semester.academicYear.name}`
      : "";
    for (const cls of classes) {
      const scores = await prisma.conductScore.findMany({
        where: { semesterId: opts.semesterId, student: { classId: cls.id } },
        select: { classification: true },
      });
      const counts = emptyCounts();
      scores.forEach((s) => counts[s.classification as Classification]++);
      result.push({ classCode: cls.code, total: scores.length, counts });
    }
  } else if (scope === "NH") {
    const year = await prisma.academicYear.findUnique({
      where: { id: opts.academicYearId ?? "" },
      include: { semesters: true },
    });
    subtitle = year ? `NĂM HỌC: ${year.name}` : "";
    const hk1 = year?.semesters.find((s) => s.number === 1)?.id;
    const hk2 = year?.semesters.find((s) => s.number === 2)?.id;
    for (const cls of classes) {
      const students = await prisma.student.findMany({
        where: { classId: cls.id },
        include: {
          conductScores: {
            where: { semesterId: { in: [hk1, hk2].filter(Boolean) as string[] } },
          },
        },
      });
      const counts = emptyCounts();
      let total = 0;
      for (const s of students) {
        const v1 = s.conductScores.find((c) => c.semesterId === hk1)?.score ?? null;
        const v2 = s.conductScores.find((c) => c.semesterId === hk2)?.score ?? null;
        const ys = getYearScore(v1, v2);
        if (ys == null) continue;
        counts[classifyScore(ys, s.status as StudentStatus)]++;
        total++;
      }
      result.push({ classCode: cls.code, total, counts });
    }
  } else {
    // TK — toàn khóa
    subtitle = "";
    for (const cls of classes) {
      const semIds = await cohortSemesterIds(
        cls.cohort.startYear,
        cls.cohort.endYear
      );
      if (!subtitle) subtitle = `KHÓA HỌC: ${cls.cohort.startYear}-${cls.cohort.endYear}`;
      const students = await prisma.student.findMany({
        where: { classId: cls.id },
        include: { conductScores: true },
      });
      const counts = emptyCounts();
      let total = 0;
      for (const s of students) {
        const present = s.conductScores
          .filter((c) => semIds.includes(c.semesterId))
          .map((c) => c.score);
        const course = getCourseScore(present);
        if (course.score == null) continue;
        counts[classifyScore(course.score, s.status as StudentStatus)]++;
        total++;
      }
      result.push({ classCode: cls.code, total, counts });
    }
  }

  return {
    facultyName: faculty.name,
    scope,
    subtitle,
    classes: result,
    filenameHint: `TONGHOP-${scope}-${faculty.code}`,
  };
}
