"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type StudentOption = {
  studentId: string;
  studentCode: string;
  fullName: string;
};

/** Combobox tìm sinh viên theo MSSV/họ tên (dùng trong dialog thêm điểm). */
export function StudentCombobox({
  students,
  value,
  onChange,
}: {
  students: StudentOption[];
  value: string;
  onChange: (studentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = students.find((s) => s.studentId === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected
            ? `${selected.studentCode} — ${selected.fullName}`
            : "Chọn sinh viên…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Tìm theo MSSV hoặc họ tên…" />
          <CommandList>
            <CommandEmpty>Không tìm thấy sinh viên.</CommandEmpty>
            <CommandGroup>
              {students.map((s) => (
                <CommandItem
                  key={s.studentId}
                  value={`${s.studentCode} ${s.fullName}`}
                  onSelect={() => {
                    onChange(s.studentId);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === s.studentId ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {s.studentCode} — {s.fullName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
