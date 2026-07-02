import ExcelJS from "exceljs";
import { STUDENT_TEMPLATE_HEADERS } from "@/lib/student-import";

/**
 * Sinh file Excel mẫu danh sách sinh viên (mục 5.3.2.1 PRD).
 * - Sheet "DanhSachSinhVien": header đúng cột + 1 dòng ví dụ (in nghiêng) +
 *   dropdown data-validation cho Giới tính / Trạng thái; MSSV/CCCD/Ngày sinh
 *   để định dạng Text tránh Excel cắt số 0 / tự đổi ngày.
 * - Sheet "HuongDan": mô tả quy tắc từng cột.
 */

const FONT = "Times New Roman";
const GENDER_OPTIONS = ["Nam", "Nữ", "Khác"];
const STATUS_OPTIONS = ["Đang học", "Bảo lưu", "Tốt nghiệp", "Thôi học"];

// Cột định dạng Text để Excel không tự cắt số 0 đầu / đổi định dạng ngày.
const TEXT_COLUMNS = [2, 3, 6]; // MSSV, CCCD, Ngày sinh (1-based)

export function buildStudentTemplate(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Quản lý Điểm Rèn luyện";

  // ── Sheet dữ liệu ──────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("DanhSachSinhVien");
  const widths = [6, 14, 16, 28, 12, 14, 16, 24];
  ws.columns = widths.map((w) => ({ width: w }));

  // Header (dòng 1).
  const header = ws.getRow(1);
  STUDENT_TEMPLATE_HEADERS.forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: FONT, size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDDF2EC" }, // teal nhạt (đồng bộ theme)
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  header.height = 20;

  // Ép định dạng Text cho các cột nhạy cảm (áp cho ~500 dòng đầu).
  for (const col of TEXT_COLUMNS) {
    ws.getColumn(col).numFmt = "@";
  }

  // Dòng ví dụ (dòng 2, in nghiêng) — người dùng XOÁ trước khi import.
  const example = [
    "1",
    "221CTT006",
    "012345678901",
    "Nguyễn Văn A",
    "Nam",
    "15/08/2004",
    "Đang học",
    "(ví dụ — xoá dòng này)",
  ];
  const exRow = ws.getRow(2);
  example.forEach((v, i) => {
    const cell = exRow.getCell(i + 1);
    cell.value = v;
    cell.font = { name: FONT, size: 11, italic: true, color: { argb: "FF9CA3AF" } };
  });

  // Data validation (dropdown) cho Giới tính (E) & Trạng thái (G), dòng 2–501.
  for (let r = 2; r <= 501; r++) {
    ws.getCell(`E${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${GENDER_OPTIONS.join(",")}"`],
    };
    ws.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${STATUS_OPTIONS.join(",")}"`],
    };
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Sheet hướng dẫn ────────────────────────────────────────────────────────
  const hd = wb.addWorksheet("HuongDan");
  hd.columns = [{ width: 16 }, { width: 12 }, { width: 70 }];
  const lines: [string, string, string][] = [
    ["Cột", "Bắt buộc", "Quy tắc"],
    ["STT", "Không", "Số thứ tự, chỉ để tham khảo — không lưu vào hệ thống."],
    ["MSSV", "Có", "3 số + 3 chữ HOA + 3 số. Ví dụ: 221CTT006."],
    ["CCCD", "Có", "Đúng 12 chữ số (giữ nguyên số 0 ở đầu)."],
    ["Họ tên", "Có", "Họ và tên đầy đủ của sinh viên."],
    ["Giới tính", "Không", "Chọn: Nam / Nữ / Khác. Để trống nếu chưa rõ."],
    ["Ngày sinh", "Không", "Định dạng dd/MM/yyyy. Ví dụ: 15/08/2004."],
    [
      "Trạng thái",
      "Không",
      "Chọn: Đang học / Bảo lưu / Tốt nghiệp / Thôi học. Để trống = Đang học.",
    ],
    ["Ghi chú", "Không", "Ghi chú thêm (tuỳ chọn)."],
    ["", "", ""],
    [
      "Lưu ý",
      "",
      "Xoá dòng ví dụ (in nghiêng) trước khi import. Lớp KHÔNG nằm trong file — chọn lớp trên giao diện khi import.",
    ],
  ];
  lines.forEach((row, idx) => {
    const r = hd.getRow(idx + 1);
    row.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      cell.font = { name: FONT, size: 11, bold: idx === 0 };
      cell.alignment = { vertical: "middle", wrapText: i === 2 };
    });
  });

  return wb;
}
