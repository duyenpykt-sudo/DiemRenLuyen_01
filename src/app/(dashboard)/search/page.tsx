"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { http } from "@/lib/http";
import { CLASSIFICATION_LABEL } from "@/lib/classification";
import { CLASS_ORDER } from "@/lib/stats";
import type { Classification } from "@/lib/enums";
import type { ClassOption, SemesterOption } from "@/types/score";
import { ClassificationBadge } from "@/components/scores/classification-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

type SearchRow = {
  id: string;
  studentCode: string;
  citizenId: string;
  fullName: string;
  classCode: string;
  score: number | null;
  classification: Classification | null;
};

const ALL = "__all__";

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [facultyId, setFacultyId] = useState(ALL);
  const [classId, setClassId] = useState(ALL);
  const [yearId, setYearId] = useState(ALL);
  const [semesterId, setSemesterId] = useState(ALL);
  const [classification, setClassification] = useState(ALL);
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [submitted, setSubmitted] = useState(() =>
    params.get("q") ? buildQuery({ q: params.get("q")! }) : ""
  );

  const { data: classes = [] } = useQuery({
    queryKey: ["scores", "classes"],
    queryFn: () => http.get<ClassOption[]>("/api/scores/classes"),
  });
  const { data: semesters = [] } = useQuery({
    queryKey: ["scores", "semesters"],
    queryFn: () => http.get<SemesterOption[]>("/api/scores/semesters"),
  });

  const faculties = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c) => m.set(c.facultyId, c.faculty.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [classes]);
  const years = useMemo(() => {
    const m = new Map<string, string>();
    semesters.forEach((s) => m.set(s.academicYearId, s.academicYear.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [semesters]);
  const semOfYear = semesters.filter((s) => yearId === ALL || s.academicYearId === yearId);
  const classOfFaculty = classes.filter((c) => facultyId === ALL || c.facultyId === facultyId);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => http.get<SearchRow[]>(`/api/search/students?${submitted}`),
    enabled: submitted !== "",
  });

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(
      buildQuery({
        q,
        facultyId: facultyId === ALL ? "" : facultyId,
        classId: classId === ALL ? "" : classId,
        semesterId: semesterId === ALL ? "" : semesterId,
        classification: classification === ALL ? "" : classification,
        minScore,
        maxScore,
      })
    );
  }

  const showScore = submitted.includes("semesterId=");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tra cứu sinh viên</h1>
        <p className="text-muted-foreground">
          Tìm theo MSSV/CCCD/họ tên và lọc nâng cao. Lọc theo điểm/xếp loại cần chọn học kỳ.
        </p>
      </div>

      <form onSubmit={onSearch} className="space-y-4 rounded-md border p-4">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Từ khóa</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="MSSV / CCCD / họ tên" />
          </div>
          <FilterSelect label="Khoa" value={facultyId} onChange={(v) => { setFacultyId(v); setClassId(ALL); }} options={faculties.map((f) => ({ value: f.id, label: f.name }))} />
          <FilterSelect label="Lớp" value={classId} onChange={setClassId} options={classOfFaculty.map((c) => ({ value: c.id, label: c.code }))} />
          <FilterSelect label="Năm học" value={yearId} onChange={(v) => { setYearId(v); setSemesterId(ALL); }} options={years.map((y) => ({ value: y.id, label: y.name }))} />
          <FilterSelect label="Học kỳ" value={semesterId} onChange={setSemesterId} options={semOfYear.map((s) => ({ value: s.id, label: `${s.academicYear.name} · ${s.name}` }))} />
          <FilterSelect label="Xếp loại" value={classification} onChange={setClassification} options={CLASS_ORDER.map((c) => ({ value: c, label: CLASSIFICATION_LABEL[c] }))} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Điểm từ</Label>
              <Input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>đến</Label>
              <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
            </div>
          </div>
        </div>
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" />
          Tìm kiếm
        </Button>
      </form>

      {submitted === "" ? (
        <p className="text-muted-foreground">Nhập điều kiện rồi bấm Tìm kiếm.</p>
      ) : isFetching ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">STT</TableHead>
                <TableHead>MSSV</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>CCCD</TableHead>
                <TableHead>Lớp</TableHead>
                {showScore && <TableHead>Điểm</TableHead>}
                {showScore && <TableHead>Xếp loại</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showScore ? 7 : 5} className="h-24 text-center text-muted-foreground">
                    Không tìm thấy sinh viên phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/students/${r.id}`)}
                  >
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.studentCode}</TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.citizenId}</TableCell>
                    <TableCell>{r.classCode}</TableCell>
                    {showScore && <TableCell>{r.score ?? "—"}</TableCell>}
                    {showScore && (
                      <TableCell>
                        {r.classification ? <ClassificationBadge classification={r.classification} /> : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function buildQuery(obj: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v) sp.set(k, v);
  return sp.toString();
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SearchInner />
    </Suspense>
  );
}
