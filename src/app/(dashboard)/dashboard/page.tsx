import { Users, School, UserCog, CalendarDays } from "lucide-react";

import { prisma } from "@/lib/db";
import { Role } from "@/lib/enums";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Trang server component — luôn lấy số liệu mới nhất từ DB.
export const dynamic = "force-dynamic";

type StatCard = {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
};

export default async function DashboardPage() {
  // 4 chỉ số tổng quan (mục 9 nhiệm vụ Tuần 1).
  const [totalStudents, totalClasses, totalCvht, totalSemesters] =
    await Promise.all([
      prisma.student.count(),
      prisma.class.count(),
      prisma.user.count({ where: { role: Role.CVHT } }),
      prisma.semester.count(),
    ]);

  const stats: StatCard[] = [
    { title: "Tổng sinh viên", value: totalStudents, icon: Users },
    { title: "Tổng lớp", value: totalClasses, icon: School },
    { title: "Tổng CVHT", value: totalCvht, icon: UserCog },
    { title: "Tổng học kỳ", value: totalSemesters, icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground">
          Thống kê nhanh hệ thống quản lý điểm rèn luyện.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
