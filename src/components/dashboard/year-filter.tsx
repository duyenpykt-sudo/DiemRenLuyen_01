"use client";

import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type YearOption = { id: string; name: string };

/**
 * Combobox lọc Dashboard theo Năm học (mục 5.2.1 PRD).
 * Đổi năm → đẩy `?ay=<id>` lên URL để server component render lại số liệu.
 */
export function DashboardYearFilter({
  years,
  value,
}: {
  years: YearOption[];
  value: string;
}) {
  const router = useRouter();
  if (years.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="dashboard-year" className="text-sm text-muted-foreground">
        Năm học
      </Label>
      <Select
        value={value}
        onValueChange={(v) => router.push(`/dashboard?ay=${v}`)}
      >
        <SelectTrigger id="dashboard-year" className="h-9 w-[160px]">
          <SelectValue />
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
  );
}
