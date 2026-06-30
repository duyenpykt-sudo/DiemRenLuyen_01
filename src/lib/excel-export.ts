/**
 * Xuất Excel theo đúng mẫu của trường (mục 5.7 + 7 PRD).
 *
 * LƯU Ý KỸ THUẬT: exceljs KHÔNG đọc được file .xls (BIFF cũ) nên không thể
 * "load template" từ file mẫu .xls. Thay vào đó ta sinh file .xlsx trực tiếp,
 * tái tạo 1:1 bố cục đã khảo sát từ file mẫu DC22CTT01-II-25-26.xls:
 *
 *  ── Sheet HỌC KỲ (cột A..G) ──────────────────────────────────────────────
 *   R1: KHOA <tên> (A1:C1) | CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM (D1:G1)
 *   R2: LỚP <mã>  (A2:C2) | Độc lập - Tự do - Hạnh phúc (D2:G2)
 *   R4: BẢNG KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN (HỌC KỲ) (A4:G4)
 *   R5: Học kỳ: <n>   Năm học: <yyyy - yyyy>
 *   R7: TT | Căn cước công dân | Mã sinh viên | Họ và tên | Điểm | Xếp loại | Ghi chú
 *   R8+: dữ liệu; sau đó block THỐNG KÊ (7 mức + Tổng cộng) + dòng ngày + 3 chữ ký.
 *
 *  ── Sheet NĂM HỌC (A..K): thêm HKI/XL, HKII/XL, Cả năm/XL.
 *  ── Sheet KHÓA HỌC (A..O): 8 cột điểm HK I..VIII + Toàn khóa + Xếp loại.
 *  ── Sheet TONG HOP-* (A..P): mỗi dòng 1 lớp, 6 nhóm xếp loại (XS/Tốt/Khá/TB/Yếu/Kém)
 *     kèm tỉ lệ %, header 2 dòng (R7:R8), dòng TỔNG CỘNG, ngày + chữ ký.
 */
import ExcelJS from "exceljs";
import { CLASSIFICATION_LABEL } from "@/lib/classification";
import type { Classification } from "@/lib/enums";

const FONT_NAME = "Times New Roman";

type Align = "left" | "center" | "right";

function font(opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> {
  return { name: FONT_NAME, size: 11, ...opts };
}

function thin(): Partial<ExcelJS.Borders> {
  const s = { style: "thin" as const };
  return { top: s, left: s, bottom: s, right: s };
}

function setCell(
  ws: ExcelJS.Worksheet,
  addr: string,
  value: ExcelJS.CellValue,
  opts: {
    bold?: boolean;
    size?: number;
    italic?: boolean;
    align?: Align;
    border?: boolean;
    wrap?: boolean;
  } = {}
) {
  const cell = ws.getCell(addr);
  cell.value = value;
  cell.font = font({ bold: opts.bold, size: opts.size, italic: opts.italic });
  cell.alignment = {
    horizontal: opts.align ?? "left",
    vertical: "middle",
    wrapText: opts.wrap ?? false,
  };
  if (opts.border) cell.border = thin();
}

// Định dạng tên năm học "2025-2026" → "2025 - 2026" (giống mẫu).
function spacedYear(name: string): string {
  return name.replace(/\s*-\s*/, " - ");
}

const STAT_ORDER: Classification[] = [
  "XUAT_SAC",
  "TOT",
  "KHA",
  "TRUNG_BINH",
  "YEU",
  "KEM",
  "KHONG_XEP_LOAI",
];

function countByClass(items: (Classification | null)[]): Record<Classification, number> {
  const c: Record<Classification, number> = {
    XUAT_SAC: 0,
    TOT: 0,
    KHA: 0,
    TRUNG_BINH: 0,
    YEU: 0,
    KEM: 0,
    KHONG_XEP_LOAI: 0,
  };
  for (const it of items) if (it) c[it]++;
  return c;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// ════════════════════ Dữ liệu đầu vào ════════════════════
export type SheetMeta = {
  facultyName: string;
  classCode: string;
  advisorName: string;
};

export type SemesterRowData = {
  cccd: string;
  studentCode: string;
  fullName: string;
  score: number | null;
  classification: Classification | null;
  note: string;
};

export type YearRowData = {
  cccd: string;
  studentCode: string;
  fullName: string;
  hk1: number | null;
  cls1: Classification | null;
  hk2: number | null;
  cls2: Classification | null;
  year: number | null;
  clsYear: Classification | null;
  note: string;
};

export type CohortRowData = {
  cccd: string;
  studentCode: string;
  fullName: string;
  scores: (number | null)[]; // 8 học kỳ
  total: number | null;
  classification: Classification | null;
  note: string;
};

export type FacultyClassRow = {
  classCode: string;
  total: number; // sĩ số có điểm
  counts: Record<Classification, number>;
};

// Block THỐNG KÊ cho sheet 1 lớp (đặt từ dòng `startRow`). Trả về dòng kế tiếp.
function writeStatsBlock(
  ws: ExcelJS.Worksheet,
  startRow: number,
  classifications: (Classification | null)[],
  percentWithSymbol: boolean
): number {
  const counts = countByClass(classifications);
  const total = classifications.filter((c) => c !== null).length;

  let r = startRow;
  setCell(ws, `C${r}`, "THỐNG KÊ:", { bold: true });
  r++;
  setCell(ws, `D${r}`, "Xếp loại", { bold: true, align: "center", border: true });
  setCell(ws, `E${r}`, "Số lượng", { bold: true, align: "center", border: true });
  setCell(ws, `F${r}`, "Tỉ lệ (%)", { bold: true, align: "center", border: true });
  r++;
  for (const k of STAT_ORDER) {
    const n = counts[k];
    const pct = total ? (n / total) * 100 : 0;
    const pctText = percentWithSymbol
      ? `${Math.round(pct)}%`
      : pct === 0
        ? "0"
        : pct.toFixed(2);
    setCell(ws, `D${r}`, CLASSIFICATION_LABEL[k], { border: true });
    setCell(ws, `E${r}`, pad2(n), { align: "center", border: true });
    setCell(ws, `F${r}`, pctText, { align: "center", border: true });
    r++;
  }
  setCell(ws, `D${r}`, "Tổng cộng", { bold: true, border: true });
  setCell(ws, `E${r}`, pad2(total), { bold: true, align: "center", border: true });
  setCell(ws, `F${r}`, "", { border: true });
  return r + 1;
}

// 3 chữ ký cho sheet 1 lớp.
function writeClassSignatures(
  ws: ExcelJS.Worksheet,
  startRow: number,
  advisorName: string,
  colDate: string,
  colKhoa: string,
  colCvht: string,
  colLt: string
) {
  const year = new Date().getFullYear();
  let r = startRow + 1;
  setCell(ws, `${colDate}${r}`, `Đắk Lắk, ngày      tháng       năm ${year}`, {
    italic: true,
    align: "center",
  });
  r++;
  setCell(ws, `${colKhoa}${r}`, "Trưởng khoa", { bold: true, align: "center" });
  setCell(ws, `${colCvht}${r}`, "Cố vấn học tập", { bold: true, align: "center" });
  setCell(ws, `${colLt}${r}`, "Lớp trưởng", { bold: true, align: "center" });
  // Tên CVHT dưới nhãn (cách vài dòng cho chữ ký).
  setCell(ws, `${colCvht}${r + 4}`, advisorName, { align: "center", italic: true });
}

function commonTitle(
  ws: ExcelJS.Worksheet,
  meta: SheetMeta,
  lastCol: string,
  title: string
) {
  ws.mergeCells(`A1:C1`);
  ws.mergeCells(`D1:${lastCol}1`);
  ws.mergeCells(`A2:C2`);
  ws.mergeCells(`D2:${lastCol}2`);
  ws.mergeCells(`A4:${lastCol}4`);
  setCell(ws, "A1", `KHOA ${meta.facultyName.replace(/^KHOA\s*/i, "")}`, { bold: true });
  setCell(ws, "D1", "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, align: "center" });
  setCell(ws, "A2", `LỚP ${meta.classCode}`, { bold: true });
  setCell(ws, "D2", "Độc lập - Tự do - Hạnh phúc", { bold: true, align: "center" });
  setCell(ws, "A4", title, { bold: true, size: 13, align: "center" });
}

// ──────────────────────── 1. Export theo Học kỳ ────────────────────────
export function exportClassSemester(data: {
  meta: SheetMeta;
  semesterNumber: number;
  academicYearName: string;
  rows: SemesterRowData[];
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("HỌC KỲ");
  ws.columns = [
    { width: 5 },
    { width: 18 },
    { width: 13 },
    { width: 26 },
    { width: 8 },
    { width: 12 },
    { width: 14 },
  ];
  commonTitle(ws, data.meta, "G", "BẢNG KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN (HỌC KỲ)");
  setCell(ws, "C5", `Học kỳ: ${data.semesterNumber}`, { align: "center" });
  setCell(ws, "D5", `Năm học: ${spacedYear(data.academicYearName)}`);

  const header = ["TT", "Căn cước công dân", "Mã sinh viên", "Họ và tên", "Điểm", "Xếp loại", "Ghi chú"];
  header.forEach((h, i) =>
    setCell(ws, `${String.fromCharCode(65 + i)}7`, h, {
      bold: true,
      align: "center",
      border: true,
      wrap: true,
    })
  );

  let r = 8;
  data.rows.forEach((row, idx) => {
    setCell(ws, `A${r}`, idx + 1, { align: "center", border: true });
    setCell(ws, `B${r}`, row.cccd, { align: "center", border: true });
    setCell(ws, `C${r}`, row.studentCode, { align: "center", border: true });
    setCell(ws, `D${r}`, row.fullName, { border: true });
    setCell(ws, `E${r}`, row.score ?? "", { align: "center", border: true });
    setCell(ws, `F${r}`, row.classification ? CLASSIFICATION_LABEL[row.classification] : "", { align: "center", border: true });
    setCell(ws, `G${r}`, row.note, { border: true });
    r++;
  });

  const afterStats = writeStatsBlock(ws, r + 1, data.rows.map((x) => x.classification), false);
  writeClassSignatures(ws, afterStats, data.meta.advisorName, "E", "B", "D", "E");
  ws.mergeCells(`E${afterStats + 2}:G${afterStats + 2}`); // "Lớp trưởng"
  return wb;
}

// ──────────────────────── 2. Export theo Năm học ────────────────────────
export function exportClassYear(data: {
  meta: SheetMeta;
  academicYearName: string;
  rows: YearRowData[];
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("NĂM HỌC");
  ws.columns = [
    { width: 5 }, { width: 18 }, { width: 13 }, { width: 26 },
    { width: 7 }, { width: 10 }, { width: 7 }, { width: 10 },
    { width: 8 }, { width: 10 }, { width: 14 },
  ];
  commonTitle(ws, data.meta, "K", "BẢNG KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN (NĂM HỌC)");
  setCell(ws, "D5", `Năm học: ${spacedYear(data.academicYearName)}`);

  const header = ["TT", "Căn cước công dân", "Mã sinh viên", "Họ và tên", "HKI", "Xếp loại", "HKII", "Xếp loại", "Cả năm", "Xếp loại", "Ghi chú"];
  header.forEach((h, i) =>
    setCell(ws, `${String.fromCharCode(65 + i)}7`, h, { bold: true, align: "center", border: true, wrap: true })
  );

  let r = 8;
  const lbl = (c: Classification | null) => (c ? CLASSIFICATION_LABEL[c] : "");
  data.rows.forEach((row, idx) => {
    setCell(ws, `A${r}`, idx + 1, { align: "center", border: true });
    setCell(ws, `B${r}`, row.cccd, { align: "center", border: true });
    setCell(ws, `C${r}`, row.studentCode, { align: "center", border: true });
    setCell(ws, `D${r}`, row.fullName, { border: true });
    setCell(ws, `E${r}`, row.hk1 ?? "—", { align: "center", border: true });
    setCell(ws, `F${r}`, lbl(row.cls1), { align: "center", border: true });
    setCell(ws, `G${r}`, row.hk2 ?? "—", { align: "center", border: true });
    setCell(ws, `H${r}`, lbl(row.cls2), { align: "center", border: true });
    setCell(ws, `I${r}`, row.year ?? "—", { align: "center", border: true });
    setCell(ws, `J${r}`, lbl(row.clsYear), { align: "center", border: true });
    setCell(ws, `K${r}`, row.note, { border: true });
    r++;
  });

  const afterStats = writeStatsBlock(ws, r + 1, data.rows.map((x) => x.clsYear), true);
  writeClassSignatures(ws, afterStats, data.meta.advisorName, "E", "B", "D", "E");
  ws.mergeCells(`E${afterStats + 2}:K${afterStats + 2}`);
  return wb;
}

// ──────────────────────── 3. Export theo Khóa học ────────────────────────
export function exportClassCohort(data: {
  meta: SheetMeta;
  cohortName: string; // "2022-2026"
  rows: CohortRowData[];
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KHÓA HỌC");
  ws.columns = [
    { width: 5 }, { width: 18 }, { width: 13 }, { width: 26 },
    ...Array.from({ length: 8 }, () => ({ width: 9 })),
    { width: 12 }, { width: 12 }, { width: 12 },
  ];
  commonTitle(ws, data.meta, "O", "BẢNG KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN (KHÓA HỌC)");
  setCell(ws, "D5", `Khóa học: ${data.cohortName}`);

  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  const header = ["TT", "Căn cước công dân", "Mã sinh viên", "Họ và tên", ...roman.map((x) => `Điểm HK ${x}`), "Điểm TOÀN KHÓA", "Xếp loại", "Ghi chú"];
  header.forEach((h, i) => {
    const col = i < 26 ? String.fromCharCode(65 + i) : "";
    setCell(ws, `${col}7`, h, { bold: true, align: "center", border: true, wrap: true });
  });

  let r = 8;
  data.rows.forEach((row, idx) => {
    setCell(ws, `A${r}`, idx + 1, { align: "center", border: true });
    setCell(ws, `B${r}`, row.cccd, { align: "center", border: true });
    setCell(ws, `C${r}`, row.studentCode, { align: "center", border: true });
    setCell(ws, `D${r}`, row.fullName, { border: true });
    for (let k = 0; k < 8; k++) {
      setCell(ws, `${String.fromCharCode(69 + k)}${r}`, row.scores[k] ?? "", { align: "center", border: true });
    }
    setCell(ws, `M${r}`, row.total ?? "", { align: "center", border: true });
    setCell(ws, `N${r}`, row.classification ? CLASSIFICATION_LABEL[row.classification] : "", { align: "center", border: true });
    setCell(ws, `O${r}`, row.note, { border: true });
    r++;
  });

  const afterStats = writeStatsBlock(ws, r + 1, data.rows.map((x) => x.classification), true);
  writeClassSignatures(ws, afterStats, data.meta.advisorName, "I", "B", "E", "J");
  ws.mergeCells(`J${afterStats + 2}:O${afterStats + 2}`);
  return wb;
}

// ──────────────────────── 4. Export Tổng hợp Khoa ────────────────────────
const FAC_CATS: Classification[] = ["XUAT_SAC", "TOT", "KHA", "TRUNG_BINH", "YEU", "KEM"];

export function exportFacultySummary(data: {
  facultyName: string;
  scope: "HK" | "NH" | "TK";
  subtitle: string; // "HỌC KỲ: II, NĂM HỌC: 2025-2026" ...
  classes: FacultyClassRow[];
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const sheetName = data.scope === "HK" ? "TONG HOP-HK" : data.scope === "NH" ? "TONG HOP-NH" : "TONG HOP-TK";
  const ws = wb.addWorksheet(sheetName);
  ws.columns = [
    { width: 5 }, { width: 13 }, { width: 6 },
    ...Array.from({ length: 12 }, () => ({ width: 8 })),
    { width: 12 },
  ];

  ws.mergeCells("A1:B1");
  ws.mergeCells("C1:P1");
  ws.mergeCells("A2:B2");
  ws.mergeCells("C2:P2");
  ws.mergeCells("A4:P4");
  ws.mergeCells("A5:P5");
  setCell(ws, "A1", "TRƯỜNG ĐẠI HỌC PHÚ YÊN", { bold: true });
  setCell(ws, "C1", "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, align: "center" });
  setCell(ws, "A2", `KHOA ${data.facultyName.replace(/^KHOA\s*/i, "")}`, { bold: true });
  setCell(ws, "C2", "Độc lập - Tự do - Hạnh phúc", { bold: true, align: "center" });
  const scopeTitle = data.scope === "HK" ? "HỌC KỲ" : data.scope === "NH" ? "NĂM HỌC" : "TOÀN KHÓA";
  setCell(ws, "A4", `TỔNG HỢP KẾT QUẢ RÈN LUYỆN CỦA SINH VIÊN HỆ CHÍNH QUY (${scopeTitle})`, { bold: true, size: 13, align: "center" });
  setCell(ws, "A5", data.subtitle, { bold: true, align: "center" });

  // Header 2 dòng (R7:R8).
  ws.mergeCells("A7:A8");
  ws.mergeCells("B7:B8");
  ws.mergeCells("C7:C8");
  ws.mergeCells("D7:O7");
  ws.mergeCells("P7:P8");
  setCell(ws, "A7", "STT", { bold: true, align: "center", border: true });
  setCell(ws, "B7", "LỚP", { bold: true, align: "center", border: true });
  setCell(ws, "C7", "SL", { bold: true, align: "center", border: true });
  setCell(ws, "D7", "KẾT QUẢ XẾP LOẠI", { bold: true, align: "center", border: true });
  setCell(ws, "P7", "GHI CHÚ", { bold: true, align: "center", border: true });
  const subHeaders = ["XS", "Tỉ lệ %", "Tốt", "Tỉ lệ %", "Khá", "Tỉ lệ %", "TB", "Tỉ lệ %", "Yếu", "Tỉ lệ %", "Kém", "Tỉ lệ %"];
  subHeaders.forEach((h, i) =>
    setCell(ws, `${String.fromCharCode(68 + i)}8`, h, { bold: true, align: "center", border: true, wrap: true })
  );

  let r = 9;
  const totals: Record<Classification, number> = countByClass([]);
  let totalSL = 0;
  data.classes.forEach((cls, idx) => {
    setCell(ws, `A${r}`, idx + 1, { align: "center", border: true });
    setCell(ws, `B${r}`, cls.classCode, { align: "center", border: true });
    setCell(ws, `C${r}`, pad2(cls.total), { align: "center", border: true });
    totalSL += cls.total;
    FAC_CATS.forEach((cat, ci) => {
      const n = cls.counts[cat];
      totals[cat] += n;
      const pct = cls.total ? Math.round((n / cls.total) * 100) : 0;
      setCell(ws, `${String.fromCharCode(68 + ci * 2)}${r}`, pad2(n), { align: "center", border: true });
      setCell(ws, `${String.fromCharCode(69 + ci * 2)}${r}`, `${pct}%`, { align: "center", border: true });
    });
    setCell(ws, `P${r}`, "", { border: true });
    r++;
  });

  // Dòng TỔNG CỘNG.
  setCell(ws, `A${r}`, "", { border: true });
  setCell(ws, `B${r}`, "TỔNG CỘNG", { bold: true, align: "center", border: true });
  setCell(ws, `C${r}`, pad2(totalSL), { bold: true, align: "center", border: true });
  FAC_CATS.forEach((cat, ci) => {
    const n = totals[cat];
    const pct = totalSL ? Math.round((n / totalSL) * 100) : 0;
    setCell(ws, `${String.fromCharCode(68 + ci * 2)}${r}`, pad2(n), { bold: true, align: "center", border: true });
    setCell(ws, `${String.fromCharCode(69 + ci * 2)}${r}`, `${pct}%`, { bold: true, align: "center", border: true });
  });
  setCell(ws, `P${r}`, "", { border: true });

  // Ngày + chữ ký (TRƯỞNG KHOA / Người lập bảng).
  const year = new Date().getFullYear();
  const dr = r + 2;
  ws.mergeCells(`I${dr}:N${dr}`);
  setCell(ws, `I${dr}`, `Đắk Lắk, ngày      tháng       năm ${year}`, { italic: true, align: "center" });
  setCell(ws, `B${dr + 1}`, "TRƯỞNG KHOA", { bold: true, align: "center" });
  ws.mergeCells(`I${dr + 1}:N${dr + 1}`);
  setCell(ws, `I${dr + 1}`, "Người lập bảng", { bold: true, align: "center" });
  return wb;
}
