import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import { z } from "zod";

/**
 * AI nhận diện & chuẩn hoá file Excel import (Google Gemini) — mục 5.5.2 PRD.
 *
 * Vai trò AI: CHỈ hỗ trợ — đề xuất ánh xạ cột + gắn cờ dòng dữ liệu nghi ngờ.
 * Mọi thay đổi phải CVHT duyệt tay; xếp loại luôn recompute server-side.
 * Toàn bộ output của model được validate lại bằng Zod trước khi tin dùng.
 */

// ── Schema kết quả (server trả cho client) ───────────────────────────────────
const columnRefSchema = z.object({
  col: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});

export const AiImportAnalysisSchema = z.object({
  // Sheet AI cho là "bảng điểm học kỳ".
  sheetGuess: z.string(),
  // Ánh xạ cột (index 0-based) + độ tin cậy. Cột không nhận diện được = null.
  columnMapping: z.object({
    stt: columnRefSchema.nullable(),
    cccd: columnRefSchema.nullable(),
    maSV: columnRefSchema.nullable(),
    hoTen: columnRefSchema.nullable(),
    diem: columnRefSchema.nullable(),
    ghiChu: columnRefSchema.nullable(),
  }),
  // Dòng dữ liệu nghi ngờ (row = số thứ tự dòng dữ liệu, 1-based).
  rowAnomalies: z.array(
    z.object({
      row: z.number().int().positive(),
      field: z.enum(["stt", "cccd", "maSV", "hoTen", "diem", "ghiChu"]),
      value: z.string(),
      suggestedValue: z.string().nullable(),
      reason: z.string(),
    })
  ),
});

export type AiImportAnalysis = z.infer<typeof AiImportAnalysisSchema>;
export type AiColumnMapping = AiImportAnalysis["columnMapping"];

// ── Mẫu dữ liệu gửi cho model ────────────────────────────────────────────────
const MAX_SAMPLE_ROWS = 15; // số dòng dữ liệu mẫu gửi model (mục 5.5.2)
const HEADER_ROWS = 7; // 7 dòng đầu (tiêu đề) — dữ liệu bắt đầu từ dòng 8
const MAX_COLS = 12;

export type SheetSample = {
  sheetName: string;
  headerRows: string[][]; // dòng 1–7
  dataRows: { row: number; cells: string[] }[]; // row 1-based trong vùng dữ liệu
};

const clean = (v: unknown) => String(v ?? "").trim();
const trimRow = (r: string[]) => r.slice(0, MAX_COLS).map(clean);

/** Đọc buffer Excel → mẫu (tên sheet + header + tối đa 15 dòng dữ liệu). */
export function buildSheetSamples(buffer: Buffer): SheetSample[] {
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
      if (cells.every((c) => c === "")) continue; // bỏ dòng trống khi lấy mẫu
      dataRows.push({ row: dataRows.length + 1, cells });
      if (dataRows.length >= MAX_SAMPLE_ROWS) break;
    }
    return { sheetName, headerRows, dataRows };
  });
}

/**
 * Nhãn gợi ý cho từng cột (0-based) dựng từ các dòng tiêu đề — giúp CVHT
 * chỉnh lại ánh xạ cột trên UI (combobox) thay vì chỉ thấy "Cột 0..11".
 */
export function columnHeaderLabels(
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

const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    sheetGuess: { type: Type.STRING },
    columnMapping: {
      type: Type.OBJECT,
      properties: {
        stt: geminiColumnRef,
        cccd: geminiColumnRef,
        maSV: geminiColumnRef,
        hoTen: geminiColumnRef,
        diem: geminiColumnRef,
        ghiChu: geminiColumnRef,
      },
      required: ["stt", "cccd", "maSV", "hoTen", "diem", "ghiChu"],
    },
    rowAnomalies: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          row: { type: Type.INTEGER },
          field: {
            type: Type.STRING,
            enum: ["stt", "cccd", "maSV", "hoTen", "diem", "ghiChu"],
          },
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

const SYSTEM_PROMPT = `Bạn là trợ lý nhận diện cấu trúc file Excel "Bảng tổng hợp điểm rèn luyện học kỳ theo lớp" của một trường đại học Việt Nam.
File thay đổi định dạng theo từng năm: đổi tên cột/sheet, xê dịch cột, và một số ô dữ liệu chưa chuẩn.

Nhiệm vụ (CHỈ đề xuất, con người sẽ duyệt lại):
1. Chọn "sheetGuess" là sheet chứa bảng điểm học kỳ.
2. Ánh xạ cột: với mỗi trường (stt, cccd, maSV, hoTen, diem, ghiChu) cho biết chỉ số cột (col, 0-based trong mảng cells) + độ tin cậy 0..1. Nếu không có cột tương ứng, trả null.
3. Gắn cờ dòng dữ liệu nghi ngờ (rowAnomalies), dùng đúng "row" đã cho trong dữ liệu mẫu:
   - diem có ký tự lạ hoặc ngoài 0..100; MSSV sai định dạng 3 số + 3 chữ HOA + 3 số (vd 221CTT006); CCCD khác 12 chữ số; nghi đảo cột Họ tên/Mã; dòng có vẻ là tiêu đề/thống kê lẫn vào.
   - "value" = giá trị gốc; "suggestedValue" = giá trị chuẩn hoá đề xuất (chuỗi) nếu chắc chắn, ngược lại null; "reason" = lý do NGẮN bằng tiếng Việt.
Chỉ dựa trên dữ liệu được cung cấp. Trả JSON đúng schema.`;

/** Gọi Gemini phân tích mẫu Excel. Ném lỗi nếu gọi thất bại (route xử lý 502). */
export async function analyzeExcelWithAI(
  samples: SheetSample[]
): Promise<AiImportAnalysis> {
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

  // KHÔNG tin cấu trúc trả về dù đã khai báo responseSchema — validate lại.
  const parsed = AiImportAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Kết quả AI không đúng định dạng mong đợi.");
  }
  return parsed.data;
}
