import * as XLSX from "xlsx";

/**
 * Đọc sheet điểm theo học kỳ (HỌC KỲ / HỌC KỲ 2) từ buffer Excel (.xls/.xlsx).
 * Quy tắc parse (mục 5.5 PRD):
 * - Bỏ qua dòng 1–6, header ở dòng 7, dữ liệu từ dòng 8 (index 7).
 * - Cột: TT | CCCD | Mã SV | Họ tên | Điểm | Xếp loại | Ghi chú.
 * - Dừng khi gặp "THỐNG KÊ:" hoặc 3 dòng trống liên tiếp.
 */
export type ParsedRow = {
  stt: string;
  cccd: string;
  maSV: string;
  hoTen: string;
  diem: string;
  xepLoai: string;
  ghiChu: string;
};

const clean = (v: unknown) => String(v ?? "").trim();

export function parseHocKyBuffer(
  buffer: Buffer,
  sheetName: string
): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Không tìm thấy sheet "${sheetName}" trong file.`);
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  });

  const out: ParsedRow[] = [];
  let emptyStreak = 0;
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const maSV = clean(r[2]);
    const hoTen = clean(r[3]);
    // Dừng khi gặp dòng thống kê.
    if (/THỐNG KÊ/i.test(clean(r[0])) || /THỐNG KÊ/i.test(maSV)) break;
    if (!maSV && !hoTen) {
      emptyStreak++;
      if (emptyStreak >= 3) break;
      continue;
    }
    emptyStreak = 0;
    out.push({
      stt: clean(r[0]),
      cccd: clean(r[1]),
      maSV,
      hoTen,
      diem: clean(r[4]),
      xepLoai: clean(r[5]),
      ghiChu: clean(r[6]),
    });
  }
  return out;
}

export const IMPORT_SHEETS = ["HỌC KỲ", "HỌC KỲ 2"] as const;
