import type { Gender, StudentStatus } from "@/lib/enums";

// Kiểu client-safe cho luồng Import sinh viên (mục 5.3.2) — KHÔNG kéo theo
// dependency server (xlsx/@google/genai) vào bundle client.

export type NormalizedStudentPreview = {
  studentCode: string;
  citizenId: string;
  fullName: string;
  gender: Gender | null;
  dob: string | null;
  status: StudentStatus;
  note: string | null;
};

type ColumnRef = { col: number; confidence: number };

export type AiStudentImportAnalysis = {
  sheetGuess: string;
  columnMapping: {
    stt: ColumnRef | null;
    mssv: ColumnRef | null;
    cccd: ColumnRef | null;
    hoTen: ColumnRef | null;
    gioiTinh: ColumnRef | null;
    ngaySinh: ColumnRef | null;
    trangThai: ColumnRef | null;
    ghiChu: ColumnRef | null;
  };
  rowAnomalies: {
    row: number;
    field:
      | "stt"
      | "mssv"
      | "cccd"
      | "hoTen"
      | "gioiTinh"
      | "ngaySinh"
      | "trangThai"
      | "ghiChu";
    value: string;
    suggestedValue: string | null;
    reason: string;
  }[];
};
