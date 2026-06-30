import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getClassPermission } from "@/lib/scores-access";
import type { Classification, StudentStatus } from "@/lib/enums";
import {
  ScoreTrendChart,
  type TrendPoint,
} from "@/components/students/score-trend-chart";
import { ClassificationBadge } from "@/components/scores/classification-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

const STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: "Đang học",
  SUSPENDED: "Đình chỉ",
  GRADUATED: "Đã tốt nghiệp",
  DROPPED: "Đã nghỉ",
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase();
}

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) notFound();

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      class: { select: { id: true, code: true, faculty: { select: { name: true } } } },
      conductScores: {
        include: {
          semester: {
            select: {
              number: true,
              name: true,
              academicYear: { select: { name: true, startYear: true } },
            },
          },
        },
      },
    },
  });
  if (!student) notFound();

  // Kiểm tra quyền xem (theo lớp của SV).
  const perm = await getClassPermission(session, student.classId);
  if (!perm.canView) {
    return (
      <p className="text-muted-foreground">
        Bạn không có quyền xem sinh viên này.
      </p>
    );
  }

  // Sắp xếp điểm theo năm học rồi học kỳ.
  const scores = [...student.conductScores].sort((a, b) => {
    const ya = a.semester.academicYear.startYear;
    const yb = b.semester.academicYear.startYear;
    if (ya !== yb) return ya - yb;
    return a.semester.number - b.semester.number;
  });

  const trend: TrendPoint[] = scores.map((s) => ({
    label: `${s.semester.academicYear.name} HK${s.semester.number}`,
    diem: s.score,
  }));

  return (
    <div className="space-y-6">
      {/* Header thông tin SV */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">
              {initials(student.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{student.fullName}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>MSSV: {student.studentCode}</span>
              <span>CCCD: {student.citizenId}</span>
              <span>Lớp: {student.class.code}</span>
              <span>Khoa: {student.class.faculty.name}</span>
              <Badge variant={student.status === "ACTIVE" ? "default" : "secondary"}>
                {STATUS_LABEL[student.status as StudentStatus]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">Điểm các học kỳ</TabsTrigger>
          <TabsTrigger value="trend">Biểu đồ tiến triển</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="pt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Năm học</TableHead>
                  <TableHead>Học kỳ</TableHead>
                  <TableHead>Điểm</TableHead>
                  <TableHead>Xếp loại</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Sinh viên chưa có điểm rèn luyện.
                    </TableCell>
                  </TableRow>
                ) : (
                  scores.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.semester.academicYear.name}</TableCell>
                      <TableCell>{s.semester.name}</TableCell>
                      <TableCell className="font-medium">{s.score}</TableCell>
                      <TableCell>
                        <ClassificationBadge
                          classification={s.classification as Classification}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.note || ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="trend" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <ScoreTrendChart data={trend} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
