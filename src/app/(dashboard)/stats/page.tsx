"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { http } from "@/lib/http";
import { useSessionRole } from "@/hooks/use-session-role";
import { CLASSIFICATION_LABEL } from "@/lib/classification";
import { CLASS_ORDER } from "@/lib/stats";
import type { Classification } from "@/lib/enums";
import type { ClassOption, SemesterOption } from "@/types/score";
import { CLASS_COLORS } from "@/components/charts/palette";
import { ChartCard } from "@/components/charts/chart-card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Distribution = { counts: Record<Classification, number>; total: number };
type FacultyDist = {
  subtitle: string;
  classes: { classCode: string; total: number; counts: Record<Classification, number> }[];
};
type Trend = { label: string; avg: number | null }[];

const FAC_CATS: Classification[] = ["XUAT_SAC", "TOT", "KHA", "TRUNG_BINH", "YEU", "KEM"];

export default function StatsPage() {
  const role = useSessionRole();
  const canFaculty = role === "ADMIN" || role === "TRUONG_KHOA";

  const { data: classes = [] } = useQuery({
    queryKey: ["scores", "classes"],
    queryFn: () => http.get<ClassOption[]>("/api/scores/classes"),
  });
  const { data: semesters = [] } = useQuery({
    queryKey: ["scores", "semesters"],
    queryFn: () => http.get<SemesterOption[]>("/api/scores/semesters"),
  });
  // Danh sách năm học suy ra từ semesters.
  const years = useMemo(() => {
    const m = new Map<string, string>();
    semesters.forEach((s) => m.set(s.academicYearId, s.academicYear.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [semesters]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Thống kê</h1>
        <p className="text-muted-foreground">Biểu đồ phân bố và xu hướng điểm rèn luyện.</p>
      </div>

      <Tabs defaultValue="class">
        <TabsList>
          <TabsTrigger value="class">Lớp</TabsTrigger>
          {canFaculty && <TabsTrigger value="faculty">Khoa</TabsTrigger>}
          <TabsTrigger value="trend">Xu hướng</TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="pt-4">
          <ClassTab classes={classes} semesters={semesters} />
        </TabsContent>
        {canFaculty && (
          <TabsContent value="faculty" className="pt-4">
            <FacultyTab years={years} />
          </TabsContent>
        )}
        <TabsContent value="trend" className="pt-4">
          <TrendTab classes={classes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────── Tab Lớp ─────────────────
function ClassTab({ classes, semesters }: { classes: ClassOption[]; semesters: SemesterOption[] }) {
  const [classId, setClassId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const enabled = !!classId && !!semesterId;

  const { data } = useQuery({
    queryKey: ["stats", "class-dist", classId, semesterId],
    queryFn: () =>
      http.get<Distribution>(
        `/api/stats/class-distribution?classId=${classId}&semesterId=${semesterId}`
      ),
    enabled,
  });

  const chartData = CLASS_ORDER.map((c) => ({
    key: c,
    name: CLASSIFICATION_LABEL[c],
    value: data?.counts[c] ?? 0,
  }));

  return (
    <div className="space-y-4">
      <Filters>
        <ClassSelect classes={classes} value={classId} onChange={setClassId} />
        <SemesterSelect semesters={semesters} value={semesterId} onChange={setSemesterId} />
      </Filters>

      {enabled && data ? (
        <ChartCard title="Phân bố xếp loại" filename="phan-bo-xep-loai">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" name="Số lượng">
                {chartData.map((d) => (
                  <Cell key={d.key} fill={CLASS_COLORS[d.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <DistTable counts={data.counts} total={data.total} />
        </ChartCard>
      ) : (
        <Empty />
      )}
    </div>
  );
}

// ───────────────── Tab Khoa ─────────────────
function FacultyTab({ years }: { years: { id: string; name: string }[] }) {
  const [academicYearId, setYear] = useState("");
  const { data } = useQuery({
    queryKey: ["stats", "faculty-dist", academicYearId],
    queryFn: () =>
      http.get<FacultyDist>(`/api/stats/faculty-distribution?academicYearId=${academicYearId}`),
    enabled: !!academicYearId,
  });

  // Tổng hợp toàn khoa cho PieChart.
  const pieData = useMemo(() => {
    if (!data) return [];
    const totals = Object.fromEntries(FAC_CATS.map((c) => [c, 0])) as Record<Classification, number>;
    data.classes.forEach((cl) => FAC_CATS.forEach((c) => (totals[c] += cl.counts[c])));
    return FAC_CATS.map((c) => ({ key: c, name: CLASSIFICATION_LABEL[c], value: totals[c] })).filter(
      (d) => d.value > 0
    );
  }, [data]);

  return (
    <div className="space-y-4">
      <Filters>
        <div className="space-y-2">
          <Label>Năm học</Label>
          <Select value={academicYearId} onValueChange={setYear}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Filters>

      {academicYearId && data ? (
        <ChartCard title={`Tổng hợp khoa — ${data.subtitle}`} filename="tong-hop-khoa">
          <div className="grid gap-6 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={CLASS_COLORS[d.key]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lớp</TableHead>
                    <TableHead>SL</TableHead>
                    {FAC_CATS.map((c) => (
                      <TableHead key={c}>{CLASSIFICATION_LABEL[c]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.classes.map((cl) => (
                    <TableRow key={cl.classCode}>
                      <TableCell className="font-medium">{cl.classCode}</TableCell>
                      <TableCell>{cl.total}</TableCell>
                      {FAC_CATS.map((c) => (
                        <TableCell key={c}>{cl.counts[c]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </ChartCard>
      ) : (
        <Empty />
      )}
    </div>
  );
}

// ───────────────── Tab Xu hướng ─────────────────
function TrendTab({ classes }: { classes: ClassOption[] }) {
  const [classId, setClassId] = useState("");
  const { data } = useQuery({
    queryKey: ["stats", "trend", classId],
    queryFn: () => http.get<Trend>(`/api/stats/class-trend?classId=${classId}`),
    enabled: !!classId,
  });

  return (
    <div className="space-y-4">
      <Filters>
        <ClassSelect classes={classes} value={classId} onChange={setClassId} />
      </Filters>
      {classId && data ? (
        <ChartCard title="Xu hướng điểm trung bình lớp" filename="xu-huong-diem">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={data} margin={{ top: 16, right: 16, bottom: 8, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis domain={[0, 100]} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" name="Điểm TB" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <Empty />
      )}
    </div>
  );
}

// ───────────────── Tiện ích dùng chung ─────────────────
function Filters({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-4">{children}</div>;
}
function Empty() {
  return <p className="text-muted-foreground">Vui lòng chọn đủ bộ lọc để xem biểu đồ.</p>;
}
function ClassSelect({ classes, value, onChange }: { classes: ClassOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Lớp</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Chọn lớp" />
        </SelectTrigger>
        <SelectContent>
          {classes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function SemesterSelect({ semesters, value, onChange }: { semesters: SemesterOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Học kỳ</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Chọn học kỳ" />
        </SelectTrigger>
        <SelectContent>
          {semesters.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.academicYear.name} · {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function DistTable({ counts, total }: { counts: Record<Classification, number>; total: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Xếp loại</TableHead>
          <TableHead>Số lượng</TableHead>
          <TableHead>Tỉ lệ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {CLASS_ORDER.map((c) => (
          <TableRow key={c}>
            <TableCell>{CLASSIFICATION_LABEL[c]}</TableCell>
            <TableCell>{counts[c]}</TableCell>
            <TableCell>{total ? `${Math.round((counts[c] / total) * 100)}%` : "0%"}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-medium">
          <TableCell>Tổng cộng</TableCell>
          <TableCell>{total}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}
