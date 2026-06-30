import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getClassPermission } from "@/lib/scores-access";
import {
  buildClassSemester,
  buildClassYear,
  buildClassCohort,
} from "@/lib/export-data";
import { CLASSIFICATION_LABEL } from "@/lib/classification";
import type { Classification } from "@/lib/enums";
import { ExportLinkButton } from "@/components/export-link-button";
import { ClassificationBadge } from "@/components/scores/classification-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const lbl = (c: Classification | null) => (c ? CLASSIFICATION_LABEL[c] : "—");

export default async function ClassDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) notFound();

  const klass = await prisma.class.findUnique({
    where: { id: params.id },
    include: {
      faculty: true,
      cohort: true,
      advisor: { select: { fullName: true } },
      _count: { select: { students: true } },
    },
  });
  if (!klass) notFound();

  const perm = await getClassPermission(session, params.id);
  if (!perm.canView) {
    return <p className="text-muted-foreground">Bạn không có quyền xem lớp này.</p>;
  }

  // Năm học mới nhất + học kỳ mặc định (HK cao nhất của năm đó).
  const latestYear = await prisma.academicYear.findFirst({
    orderBy: { startYear: "desc" },
    include: { semesters: { orderBy: { number: "desc" } } },
  });
  const latestSem = latestYear?.semesters[0];

  const students = await prisma.student.findMany({
    where: { classId: params.id },
    orderBy: { studentCode: "asc" },
    select: { id: true, studentCode: true, fullName: true, citizenId: true, status: true },
  });

  const semData = latestSem
    ? await buildClassSemester(params.id, latestSem.id)
    : null;
  const yearData = latestYear ? await buildClassYear(params.id, latestYear.id) : null;
  const cohortData = await buildClassCohort(params.id);

  const exp = "/api/export/excel";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 py-6">
          <div>
            <h1 className="text-2xl font-semibold">{klass.code}</h1>
            <p className="text-muted-foreground">{klass.name}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Khoa: {klass.faculty.name}</p>
            <p>Khóa: {klass.cohort.name} ({klass.cohort.startYear}-{klass.cohort.endYear})</p>
            <p>CVHT: {klass.advisor.fullName}</p>
            <p>Sĩ số: {klass._count.students}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Sinh viên</TabsTrigger>
          <TabsTrigger value="semester">Điểm các HK</TabsTrigger>
          <TabsTrigger value="year">Tổng hợp năm</TabsTrigger>
          <TabsTrigger value="cohort">Tổng hợp khóa</TabsTrigger>
        </TabsList>

        {/* Sinh viên */}
        <TabsContent value="students" className="pt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>MSSV</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>CCCD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/students/${s.id}`} className="hover:underline">
                        {s.studentCode}
                      </Link>
                    </TableCell>
                    <TableCell>{s.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">{s.citizenId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Điểm các HK (học kỳ mới nhất) */}
        <TabsContent value="semester" className="space-y-3 pt-4">
          {semData && latestSem ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Học kỳ {semData.semesterNumber} · {semData.academicYearName}
                </p>
                <ExportLinkButton
                  href={`${exp}?type=class-semester&classId=${params.id}&semesterId=${latestSem.id}`}
                  label="Xuất Excel HK"
                />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>Điểm</TableHead>
                      <TableHead>Xếp loại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semData.rows.map((r) => (
                      <TableRow key={r.studentCode}>
                        <TableCell className="font-medium">{r.studentCode}</TableCell>
                        <TableCell>{r.fullName}</TableCell>
                        <TableCell>{r.score ?? "—"}</TableCell>
                        <TableCell>
                          {r.classification ? (
                            <ClassificationBadge classification={r.classification} />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Chưa có học kỳ nào.</p>
          )}
        </TabsContent>

        {/* Tổng hợp năm (năm mới nhất) */}
        <TabsContent value="year" className="space-y-3 pt-4">
          {yearData && latestYear ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Năm học {yearData.academicYearName}</p>
                <ExportLinkButton
                  href={`${exp}?type=class-year&classId=${params.id}&academicYearId=${latestYear.id}`}
                  label="Xuất Excel Năm"
                />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MSSV</TableHead>
                      <TableHead>Họ tên</TableHead>
                      <TableHead>HKI</TableHead>
                      <TableHead>HKII</TableHead>
                      <TableHead>Cả năm</TableHead>
                      <TableHead>Xếp loại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearData.rows.map((r) => (
                      <TableRow key={r.studentCode}>
                        <TableCell className="font-medium">{r.studentCode}</TableCell>
                        <TableCell>{r.fullName}</TableCell>
                        <TableCell>{r.hk1 ?? "—"}</TableCell>
                        <TableCell>{r.hk2 ?? "—"}</TableCell>
                        <TableCell>{r.year ?? "—"}</TableCell>
                        <TableCell>{lbl(r.clsYear)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Chưa có năm học nào.</p>
          )}
        </TabsContent>

        {/* Tổng hợp khóa */}
        <TabsContent value="cohort" className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Khóa {cohortData?.cohortName}</p>
            <ExportLinkButton
              href={`${exp}?type=class-cohort&classId=${params.id}`}
              label="Xuất Excel Khóa"
            />
          </div>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MSSV</TableHead>
                  <TableHead>Họ tên</TableHead>
                  {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((r) => (
                    <TableHead key={r}>HK {r}</TableHead>
                  ))}
                  <TableHead>Toàn khóa</TableHead>
                  <TableHead>Xếp loại</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cohortData?.rows.map((r) => (
                  <TableRow key={r.studentCode}>
                    <TableCell className="font-medium">{r.studentCode}</TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    {r.scores.map((sc, i) => (
                      <TableCell key={i}>{sc ?? "—"}</TableCell>
                    ))}
                    <TableCell>{r.total ?? "—"}</TableCell>
                    <TableCell>{lbl(r.classification)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
