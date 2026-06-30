"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import { http } from "@/lib/http";
import type { ClassOption, ScoresResponse, SemesterOption } from "@/types/score";
import { ModeA } from "@/components/scores/mode-a";
import { ModeB } from "@/components/scores/mode-b";
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

  const enabled = !!classId && !!semesterId;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Điểm rèn luyện</h1>
        <p className="text-muted-foreground">
          Nhập, sửa điểm rèn luyện theo lớp và học kỳ.
        </p>
      </div>

      {/* Bộ lọc Lớp + Học kỳ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
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
        <div className="space-y-2">
          <Label>Học kỳ</Label>
          <Select value={semesterId} onValueChange={setSemesterId}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn học kỳ" />
            </SelectTrigger>
            <SelectContent>
              {semesters.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.academicYear.name} · {s.name}
                  {s.isLocked ? " (đã chốt)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!enabled ? (
        <p className="text-muted-foreground">
          Vui lòng chọn lớp và học kỳ để xem bảng điểm.
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
