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

/**
 * Ánh xạ cột do AI đề xuất và CVHT đã duyệt (mục 5.5.2).
 * Mỗi trường là index cột (0-based); trường không có cột → undefined.
 */
export type ColumnMapping = {
  stt?: number;
  cccd?: number;
  maSV?: number;
  hoTen?: number;
  diem?: number;
  ghiChu?: number;
};

/**
 * Parse sheet theo ánh xạ cột tuỳ ý (khi header/cột lệch mẫu chuẩn).
 * Vẫn giữ quy tắc: dữ liệu từ dòng 8 (index 7), dừng ở "THỐNG KÊ" / 3 dòng trống.
 */
export function parseHocKyBufferWithMapping(
  buffer: Buffer,
  sheetName: string,
  map: ColumnMapping
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
  const at = (r: string[], col?: number) =>
    col === undefined ? "" : clean(r[col]);

  const out: ParsedRow[] = [];
  let emptyStreak = 0;
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const maSV = at(r, map.maSV);
    const hoTen = at(r, map.hoTen);
    if (/THỐNG KÊ/i.test(at(r, map.stt)) || /THỐNG KÊ/i.test(maSV)) break;
    if (!maSV && !hoTen) {
      emptyStreak++;
      if (emptyStreak >= 3) break;
      continue;
    }
    emptyStreak = 0;
    out.push({
      stt: at(r, map.stt),
      cccd: at(r, map.cccd),
      maSV,
      hoTen,
      diem: at(r, map.diem),
      xepLoai: "",
      ghiChu: at(r, map.ghiChu),
    });
  }
  return out;
}
