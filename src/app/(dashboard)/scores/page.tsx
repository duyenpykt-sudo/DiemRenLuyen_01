"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import { http } from "@/lib/http";
import type { ClassOption, ScoresResponse, SemesterOption } from "@/types/score";
import { ModeA } from "@/components/scores/mode-a";
import { ModeB } from "@/components/scores/mode-b";
import { ExportMenu } from "@/components/scores/export-menu";
import { ImportExcelButton } from "@/components/scores/import-excel-button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ScoresPage() {
  const qc = useQueryClient();
  // Bộ lọc 3 chiều (mục 5.4): Năm học → Học kỳ → Lớp.
  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [semesterId, setSemesterId] = useState("");

  const { data: classes = [] } = useQuery({
    queryKey: ["scores", "classes"],
    queryFn: () => http.get<ClassOption[]>("/api/scores/classes"),
  });
  const { data: semesters = [] } = useQuery({
    queryKey: ["scores", "semesters"],
    queryFn: () => http.get<SemesterOption[]>("/api/scores/semesters"),
  });

  // Danh sách Năm học (duy nhất) suy ra từ các học kỳ.
  const years = Array.from(
    new Map(
      semesters.map((s) => [s.academicYearId, s.academicYear.name])
    ).entries()
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => b.name.localeCompare(a.name));

  // Học kỳ chỉ hiện các HK thuộc năm học đã chọn.
  const semestersOfYear = semesters.filter(
    (s) => s.academicYearId === academicYearId
  );

  const enabled = !!academicYearId && !!classId && !!semesterId;
  const scoresKey = ["scores", classId, semesterId];
  const { data, isLoading, isFetching } = useQuery({
    queryKey: scoresKey,
    queryFn: () =>
      http.get<ScoresResponse>(
        `/api/scores?classId=${classId}&semesterId=${semesterId}`
      ),
    enabled,
  });

  const onChanged = () => qc.invalidateQueries({ queryKey: scoresKey });
  const locked = data?.semester.isLocked ?? false;

  const selectedClass = classes.find((c) => c.id === classId);
  const selectedSemester = semesters.find((s) => s.id === semesterId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Điểm rèn luyện</h1>
          <p className="text-muted-foreground">
            Nhập, sửa điểm rèn luyện theo lớp và học kỳ.
          </p>
        </div>
        {enabled && data && selectedClass && selectedSemester && (
          <div className="flex items-center gap-2">
            {data.canMutate && !locked && (
              <ImportExcelButton
                classId={classId}
                semesterId={semesterId}
                onDone={onChanged}
              />
            )}
            <ExportMenu
              classId={classId}
              semesterId={semesterId}
              academicYearId={selectedSemester.academicYearId}
              cohortId={selectedClass.cohortId}
            />
          </div>
        )}
      </div>

      {/* Bộ lọc 3 chiều: Năm học → Học kỳ → Lớp (mục 5.4) */}
      <div className="grid gap-4 sm:grid-cols-3 lg:max-w-3xl">
        <div className="space-y-2">
          <Label>Năm học</Label>
          <Select
            value={academicYearId}
            onValueChange={(v) => {
              setAcademicYearId(v);
              setSemesterId(""); // đổi năm → bỏ chọn học kỳ cũ
            }}
          >
            <SelectTrigger>
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
        <div className="space-y-2">
          <Label>Học kỳ</Label>
          <Select
            value={semesterId}
            onValueChange={setSemesterId}
            disabled={!academicYearId}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={academicYearId ? "Chọn học kỳ" : "Chọn năm học trước"}
              />
            </SelectTrigger>
            <SelectContent>
              {semestersOfYear.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.isLocked ? " (đã chốt)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Lớp</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn lớp" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!enabled ? (
        <p className="text-muted-foreground">
          Vui lòng chọn đủ Năm học, Học kỳ và Lớp để xem bảng điểm.
        </p>
      ) : isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : data ? (
        <>
          {locked && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <Lock className="h-4 w-4" />
              Học kỳ đã chốt — không thể thêm/sửa/xóa điểm.
            </div>
          )}

          <Tabs defaultValue="form">
            <TabsList>
              <TabsTrigger value="form">Form Dialog</TabsTrigger>
              <TabsTrigger value="inline">Bảng inline</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="pt-4">
              <ModeA
                classId={classId}
                semesterId={semesterId}
                rows={data.rows}
                canMutate={data.canMutate}
                locked={locked}
                onChanged={onChanged}
              />
            </TabsContent>
            <TabsContent value="inline" className="pt-4">
              <ModeB
                classId={classId}
                semesterId={semesterId}
                rows={data.rows}
                canMutate={data.canMutate}
                locked={locked}
                onChanged={onChanged}
              />
            </TabsContent>
          </Tabs>
          {isFetching && (
            <p className="text-xs text-muted-foreground">Đang cập nhật…</p>
          )}
        </>
      ) : null}
    </div>
  );
}
