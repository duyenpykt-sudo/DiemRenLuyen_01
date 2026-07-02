import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { z } from "zod";

/**
 * AI nhận diện & chuẩn hoá file import DANH SÁCH SINH VIÊN (Google Gemini) —
 * mục 5.3.2.2 PRD. Song song với mục 5.5.2 (import điểm) nhưng cho các trường
 * hồ sơ SV. Vai trò AI: CHỈ đề xuất — ánh xạ cột + gắn cờ dòng nghi ngờ; CVHT
 * duyệt tay; mọi giá trị vẫn validate lại bằng Zod server-side.
 */

const columnRefSchema = z.object({
  col: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const AiStudentImportAnalysisSchema = z.object({
  sheetGuess: z.string(),
  columnMapping: z.object({
    stt: columnRefSchema.nullable(),
    mssv: columnRefSchema.nullable(),
    cccd: columnRefSchema.nullable(),
    hoTen: columnRefSchema.nullable(),
    gioiTinh: columnRefSchema.nullable(),
    ngaySinh: columnRefSchema.nullable(),
    trangThai: columnRefSchema.nullable(),
    ghiChu: columnRefSchema.nullable(),
  }),
  rowAnomalies: z.array(
    z.object({
      row: z.number().int().positive(),
      field: z.enum([
        "stt",
        "mssv",
        "cccd",
        "hoTen",
        "gioiTinh",
        "ngaySinh",
        "trangThai",
        "ghiChu",
      ]),
      value: z.string(),
      suggestedValue: z.string().nullable(),
      reason: z.string(),
    })
  ),
});

export type AiStudentImportAnalysis = z.infer<
  typeof AiStudentImportAnalysisSchema
>;

// ── Mẫu dữ liệu gửi model (danh sách SV: header 1 dòng, dữ liệu từ dòng 2) ────
const MAX_SAMPLE_ROWS = 15;
const HEADER_ROWS = 1;
const MAX_COLS = 10;

export type SheetSample = {
  sheetName: string;
  headerRows: string[][];
  dataRows: { row: number; cells: string[] }[];
};

const clean = (v: unknown) => String(v ?? "").trim();
const trimRow = (r: string[]) => r.slice(0, MAX_COLS).map(clean);

export function buildStudentSheetSamples(buffer: Buffer): SheetSample[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });
    const headerRows = rows.slice(0, HEADER_ROWS).map(trimRow);
    const dataRows: SheetSample["dataRows"] = [];
    for (let i = HEADER_ROWS; i < rows.length; i++) {
      const cells = trimRow(rows[i] ?? []);
      if (cells.every((c) => c === "")) continue;
      dataRows.push({ row: dataRows.length + 1, cells });
      if (dataRows.length >= MAX_SAMPLE_ROWS) break;
    }
    return { sheetName, headerRows, dataRows };
  });
}

/** Nhãn gợi ý mỗi cột (0-based) từ dòng tiêu đề — dựng combobox chỉnh ánh xạ. */
export function studentColumnHeaderLabels(
  sample: SheetSample,
  maxCols = MAX_COLS
): string[] {
  const labels: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const parts = sample.headerRows
      .map((r) => r[c] ?? "")
      .filter((v) => v !== "");
    labels.push([...new Set(parts)].join(" / "));
  }
  return labels;
}

// ── responseSchema cho Gemini (Structured Output) ────────────────────────────
const geminiColumnRef = {
  type: Type.OBJECT,
  nullable: true,
  properties: {
    col: { type: Type.INTEGER },
    confidence: { type: Type.NUMBER },
  },
  required: ["col", "confidence"],
};

const FIELDS = [
  "stt",
  "mssv",
  "cccd",
  "hoTen",
  "gioiTinh",
  "ngaySinh",
  "trangThai",
  "ghiChu",
] as const;

const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    sheetGuess: { type: Type.STRING },
    columnMapping: {
      type: Type.OBJECT,
      properties: Object.fromEntries(FIELDS.map((f) => [f, geminiColumnRef])),
      required: [...FIELDS],
    },
    rowAnomalies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          row: { type: Type.INTEGER },
          field: { type: Type.STRING, enum: [...FIELDS] },
          value: { type: Type.STRING },
          suggestedValue: { type: Type.STRING, nullable: true },
          reason: { type: Type.STRING },
        },
        required: ["row", "field", "value", "reason"],
      },
    },
  },
  required: ["sheetGuess", "columnMapping", "rowAnomalies"],
};

const SYSTEM_PROMPT = `Bạn là trợ lý nhận diện cấu trúc file Excel "Danh sách sinh viên" của một trường đại học Việt Nam.
File có thể đổi tên cột, xê dịch cột, và một số ô dữ liệu chưa chuẩn.

Nhiệm vụ (CHỈ đề xuất, con người sẽ duyệt lại):
1. Chọn "sheetGuess" là sheet chứa danh sách sinh viên.
2. Ánh xạ cột: với mỗi trường (stt, mssv, cccd, hoTen, gioiTinh, ngaySinh, trangThai, ghiChu) cho biết chỉ số cột (col, 0-based trong mảng cells) + độ tin cậy 0..1. Nếu không có cột tương ứng, trả null.
3. Gắn cờ dòng dữ liệu nghi ngờ (rowAnomalies), dùng đúng "row" đã cho trong dữ liệu mẫu:
   - MSSV sai định dạng 3 số + 3 chữ HOA + 3 số (vd 221CTT006); CCCD khác 12 chữ số; ngày sinh sai định dạng dd/MM/yyyy; giới tính không thuộc {Nam,Nữ,Khác}; trạng thái không thuộc {Đang học,Bảo lưu,Tốt nghiệp,Thôi học}; nghi đảo cột Họ tên/Mã; dòng có vẻ là tiêu đề lẫn vào.
   - "value" = giá trị gốc; "suggestedValue" = giá trị chuẩn hoá đề xuất (chuỗi) nếu chắc chắn, ngược lại null; "reason" = lý do NGẮN bằng tiếng Việt.
Chỉ dựa trên dữ liệu được cung cấp. Trả JSON đúng schema.`;

/** Gọi Gemini phân tích mẫu danh sách SV. Ném lỗi nếu gọi thất bại (route xử lý 502). */
export async function analyzeStudentSheetWithAI(
  samples: SheetSample[]
): Promise<AiStudentImportAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Thiếu GEMINI_API_KEY.");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

  const ai = new GoogleGenAI({ apiKey });
  const userPayload = JSON.stringify(
    samples.map((s) => ({
      sheetName: s.sheetName,
      headerRows: s.headerRows,
      dataRows: s.dataRows,
    }))
  );

  const response = await ai.models.generateContent({
    model,
    contents: `Dữ liệu mẫu các sheet (JSON):\n${userPayload}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: geminiResponseSchema,
      temperature: 0,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini không trả về nội dung.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Gemini trả về JSON không hợp lệ.");
  }

  const parsed = AiStudentImportAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Kết quả AI không đúng định dạng mong đợi.");
  }
  return parsed.data;
}
