"use client";

import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Select tích hợp react-hook-form (Controller) — dùng chung cho các dropdown form. */
export function FormSelect<T extends FieldValues>({
  label,
  placeholder,
  control,
  name,
  options,
  error,
}: {
  label: string;
  placeholder: string;
  control: Control<T>;
  name: FieldPath<T>;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={(field.value as string) || ""}
            onValueChange={field.onChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Không có dữ liệu
                </div>
              ) : (
                options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
