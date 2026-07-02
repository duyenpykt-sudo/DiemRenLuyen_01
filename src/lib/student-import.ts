import * as XLSX from "xlsx";
import type { Gender, StudentStatus } from "@/lib/enums";

/**
 * Đọc danh sách sinh viên từ buffer Excel (.xls/.xlsx) — mục 5.3.2 PRD.
 *
 * Cột mẫu (0-based): STT | MSSV | CCCD | Họ tên | Giới tính | Ngày sinh | Trạng thái | Ghi chú.
 * Header ở dòng 1, dữ liệu từ dòng 2 (index 1). Có thể truyền ánh xạ cột tuỳ ý
 * (khi header/cột lệch mẫu — do AI đề xuất ở mục 5.3.2.2).
 */

const clean = (v: unknown) => String(v ?? "").trim();

// Thứ tự cột mặc định của file mẫu.
export const STUDENT_TEMPLATE_HEADERS = [
  "STT",
  "MSSV",
  "CCCD",
  "Họ tên",
  "Giới tính",
  "Ngày sinh",
  "Trạng thái",
  "Ghi chú",
] as const;

const DEFAULT_MAPPING: Required<StudentColumnMapping> = {
  stt: 0,
  mssv: 1,
  cccd: 2,
  hoTen: 3,
  gioiTinh: 4,
  ngaySinh: 5,
  trangThai: 6,
  ghiChu: 7,
};

const DATA_START_ROW = 1; // dữ liệu bắt đầu từ dòng 2 (index 1)

export type StudentColumnMapping = {
  stt?: number;
  mssv?: number;
  cccd?: number;
  hoTen?: number;
  gioiTinh?: number;
  ngaySinh?: number;
  trangThai?: number;
  ghiChu?: number;
};

export type RawStudentRow = {
  stt: string;
  mssv: string;
  cccd: string;
  hoTen: string;
  gioiTinh: string;
  ngaySinh: string;
  trangThai: string;
  ghiChu: string;
};

/** Đọc sheet danh sách SV → mảng dòng thô. */
export function parseStudentBuffer(
  buffer: Buffer,
  sheetName?: string,
  mapping?: StudentColumnMapping
): RawStudentRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const name = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) throw new Error("File không có sheet dữ liệu.");

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  });

  const map = { ...DEFAULT_MAPPING, ...mapping };
  const at = (r: string[], col?: number) =>
    col === undefined ? "" : clean(r[col]);

  const out: RawStudentRow[] = [];
  let emptyStreak = 0;
  for (let i = DATA_START_ROW; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const mssv = at(r, map.mssv);
    const cccd = at(r, map.cccd);
    const hoTen = at(r, map.hoTen);
    if (!mssv && !cccd && !hoTen) {
      emptyStreak++;
      if (emptyStreak >= 3) break;
      continue;
    }
    emptyStreak = 0;
    out.push({
      stt: at(r, map.stt),
      mssv,
      cccd,
      hoTen,
      gioiTinh: at(r, map.gioiTinh),
      ngaySinh: at(r, map.ngaySinh),
      trangThai: at(r, map.trangThai),
      ghiChu: at(r, map.ghiChu),
    });
  }
  return out;
}

// ── Chuẩn hoá giá trị tiếng Việt → giá trị enum của hệ thống ──────────────────

/** Giới tính: Nam/Nữ/Khác (hoặc M/F) → enum; rỗng → null. */
export function normalizeGender(raw: string): Gender | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (["nam", "male", "m", "1"].includes(v)) return "MALE";
  if (["nữ", "nu", "female", "f", "0"].includes(v)) return "FEMALE";
  if (["khác", "khac", "other"].includes(v)) return "OTHER";
  return null;
}

/** Trạng thái: nhãn tiếng Việt → enum; rỗng → ACTIVE (mặc định). */
export function normalizeStatus(raw: string): StudentStatus {
  const v = raw.trim().toLowerCase();
  if (!v) return "ACTIVE";
  if (["đang học", "dang hoc", "active"].includes(v)) return "ACTIVE";
  if (["bảo lưu", "bao luu", "đình chỉ", "dinh chi", "suspended"].includes(v))
    return "SUSPENDED";
  if (["tốt nghiệp", "tot nghiep", "đã tốt nghiệp", "graduated"].includes(v))
    return "GRADUATED";
  if (["thôi học", "thoi hoc", "đã nghỉ", "da nghi", "dropped"].includes(v))
    return "DROPPED";
  return "ACTIVE";
}

/**
 * Ngày sinh: chấp nhận dd/MM/yyyy, d/M/yyyy, yyyy-MM-dd → chuỗi ISO "yyyy-MM-dd".
 * Trả null nếu rỗng; trả undefined nếu có giá trị nhưng không hợp lệ (để báo lỗi).
 */
export function normalizeDob(raw: string): string | null | undefined {
  const v = raw.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const slash = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (slash) {
    d = Number(slash[1]);
    m = Number(slash[2]);
    y = Number(slash[3]);
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    return undefined;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100)
    return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

const STUDENT_CODE_RE = /^[0-9]{3}[A-Z]{3}[0-9]{3}$/;
const CCCD_RE = /^[0-9]{12}$/;

export type NormalizedStudent = {
  studentCode: string;
  citizenId: string;
  fullName: string;
  gender: Gender | null;
  dob: string | null; // ISO yyyy-MM-dd
  status: StudentStatus;
  note: string | null;
};

/**
 * Chuẩn hoá + validate 1 dòng thô. Trả { data } nếu hợp lệ, ngược lại { error }.
 * Dùng chung cho preview và commit (không tin client — commit validate lại).
 */
export function normalizeStudentRow(
  raw: RawStudentRow
): { data: NormalizedStudent; error: null } | { data: null; error: string } {
  const studentCode = raw.mssv.trim().toUpperCase();
  const citizenId = raw.cccd.trim();
  const fullName = raw.hoTen.trim();

  if (!studentCode) return err("Thiếu MSSV");
  if (!STUDENT_CODE_RE.test(studentCode))
    return err("MSSV sai định dạng (vd 221CTT006)");
  if (!citizenId) return err("Thiếu CCCD");
  if (!CCCD_RE.test(citizenId)) return err("CCCD phải gồm đúng 12 chữ số");
  if (!fullName) return err("Thiếu họ tên");

  const dob = normalizeDob(raw.ngaySinh);
  if (dob === undefined) return err("Ngày sinh sai định dạng (dd/MM/yyyy)");

  return {
    data: {
      studentCode,
      citizenId,
      fullName,
      gender: normalizeGender(raw.gioiTinh),
      dob,
      status: normalizeStatus(raw.trangThai),
      note: raw.ghiChu.trim() || null,
    },
    error: null,
  };

  function err(message: string) {
    return { data: null as null, error: message };
  }
}
