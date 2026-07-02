import Link from "next/link";
import { Users, School, UserCog, CalendarDays } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Role } from "@/lib/enums";
import type { Classification } from "@/lib/enums";
import { systemDistribution, emptyCounts } from "@/lib/stats";
import { buildFacultySummary } from "@/lib/export-data";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { DashboardYearFilter } from "@/components/dashboard/year-filter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { ay?: string };
}) {
  const session = await auth();
  const role = session!.user.role;

  // Danh mục Năm học cho combobox lọc (mục 5.2.1) — năm mới nhất lên trước.
  const years = await prisma.academicYear.findMany({
    orderBy: { startYear: "desc" },
    select: { id: true, name: true },
  });
  // Mặc định: năm chứa HK gần nhất CÓ dữ liệu điểm; nếu chưa có → năm mới nhất.
  const semWithData = await prisma.semester.findFirst({
    where: { conductScores: { some: {} } },
    orderBy: [{ academicYear: { startYear: "desc" } }, { number: "desc" }],
    select: { academicYearId: true },
  });
  const defaultYearId = semWithData?.academicYearId ?? years[0]?.id ?? "";
  const selectedYearId =
    years.find((y) => y.id === searchParams.ay)?.id ?? defaultYearId;
  const yearName = years.find((y) => y.id === selectedYearId)?.name ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
          <p className="text-muted-foreground">
            Xin chào <span className="font-medium text-foreground">{session!.user.name}</span> 👋
          </p>
        </div>
        <DashboardYearFilter years={years} value={selectedYearId} />
      </div>
      {role === Role.ADMIN && (
        <AdminDashboard academicYearId={selectedYearId} yearName={yearName} />
      )}
      {role === Role.CVHT && (
        <CvhtDashboard
          userId={session!.user.id}
          academicYearId={selectedYearId}
          yearName={yearName}
        />
      )}
      {role === Role.TRUONG_KHOA && (
        <FacultyHeadDashboard
          facultyId={session!.user.facultyId}
          academicYearId={selectedYearId}
          yearName={yearName}
        />
      )}
    </div>
  );
}

// Tông màu cho thẻ thống kê — xoay vòng để dashboard sinh động, trẻ trung.
const STAT_TONES = {
  teal: "from-teal-500/15 to-emerald-500/10 text-teal-600 dark:text-teal-400",
  emerald:
    "from-emerald-500/15 to-green-500/10 text-emerald-600 dark:text-emerald-400",
  sky: "from-sky-500/15 to-cyan-500/10 text-sky-600 dark:text-sky-400",
  violet:
    "from-violet-500/15 to-fuchsia-500/10 text-violet-600 dark:text-violet-400",
} as const;

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "teal",
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <Card className="relative overflow-hidden">
      {/* Vệt gradient trang trí góc trên phải */}
      <div
        className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-60 blur-2xl ${STAT_TONES[tone]}`}
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${STAT_TONES[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────── Admin ─────────────────
async function AdminDashboard({
  academicYearId,
  yearName,
}: {
  academicYearId: string;
  yearName: string;
}) {
  const [totalStudents, totalClasses, totalCvht, totalSemesters, dist] =
    await Promise.all([
      prisma.student.count(),
      prisma.class.count(),
      prisma.user.count({ where: { role: Role.CVHT } }),
      prisma.semester.count(),
      systemDistribution(academicYearId || undefined),
    ]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Tổng sinh viên" value={totalStudents} icon={Users} tone="teal" />
        <StatCard title="Tổng lớp" value={totalClasses} icon={School} tone="emerald" />
        <StatCard title="Tổng CVHT" value={totalCvht} icon={UserCog} tone="sky" />
        <StatCard title="Tổng học kỳ" value={totalSemesters} icon={CalendarDays} tone="violet" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Phân bố xếp loại toàn hệ thống{yearName ? ` — Năm học ${yearName}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dist.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu điểm cho năm học này.
            </p>
          ) : (
            <DistributionChart counts={dist.counts} variant="bar" />
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ───────────────── CVHT ─────────────────
async function CvhtDashboard({
  userId,
  academicYearId,
  yearName,
}: {
  userId: string;
  academicYearId: string;
  yearName: string;
}) {
  const classes = await prisma.class.findMany({
    where: { advisorId: userId },
    orderBy: { code: "asc" },
    include: { _count: { select: { students: true } } },
  });

  // Đếm số SV đã có ít nhất 1 điểm trong năm học được chọn cho mỗi lớp.
  const withScore = new Map<string, number>();
  if (academicYearId) {
    for (const c of classes) {
      const n = await prisma.student.count({
        where: {
          classId: c.id,
          conductScores: { some: { semester: { academicYearId } } },
        },
      });
      withScore.set(c.id, n);
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Năm học: {yearName || "—"}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.length === 0 ? (
          <p className="text-muted-foreground">Bạn chưa được gán lớp nào.</p>
        ) : (
          classes.map((c) => {
            const done = withScore.get(c.id) ?? 0;
            const total = c._count.students;
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Link href={`/classes/${c.id}`} className="hover:underline">
                      {c.code}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{c.name}</p>
                  <Badge variant={done >= total && total > 0 ? "default" : "secondary"}>
                    {done}/{total} SV đã có điểm trong năm học
                  </Badge>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}

// ───────────────── Trưởng khoa ─────────────────
async function FacultyHeadDashboard({
  facultyId,
  academicYearId,
  yearName,
}: {
  facultyId: string | null;
  academicYearId: string;
  yearName: string;
}) {
  if (!facultyId) {
    return <p className="text-muted-foreground">Tài khoản chưa gán khoa.</p>;
  }
  const totalStudents = await prisma.student.count({
    where: { class: { facultyId } },
  });

  // Tổng hợp xếp loại toàn khoa theo năm học được chọn.
  const counts = emptyCounts();
  if (academicYearId) {
    const summary = await buildFacultySummary(facultyId, "NH", {
      academicYearId,
    });
    summary?.classes.forEach((cl) => {
      (Object.keys(cl.counts) as Classification[]).forEach(
        (k) => (counts[k] += cl.counts[k])
      );
    });
  }
  const total = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Tổng SV trong khoa" value={totalStudents} icon={Users} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tổng hợp xếp loại khoa{yearName ? ` — Năm học ${yearName}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có dữ liệu điểm cho năm học này.
            </p>
          ) : (
            <DistributionChart counts={counts} variant="pie" />
          )}
        </CardContent>
      </Card>
    </>
  );
}
