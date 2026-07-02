import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { AiImportAnalysisSchema, buildSheetSamples } from "./ai-import";

describe("AiImportAnalysisSchema", () => {
  const valid = {
    sheetGuess: "HỌC KỲ",
    columnMapping: {
      stt: { col: 0, confidence: 0.98 },
      cccd: { col: 1, confidence: 0.95 },
      maSV: { col: 2, confidence: 0.99 },
      hoTen: { col: 3, confidence: 0.97 },
      diem: { col: 4, confidence: 0.9 },
      ghiChu: null,
    },
    rowAnomalies: [
      { row: 12, field: "diem", value: "85đ", suggestedValue: "85", reason: "Điểm có ký tự thừa" },
    ],
  };

  it("chấp nhận cấu trúc hợp lệ", () => {
    expect(AiImportAnalysisSchema.safeParse(valid).success).toBe(true);
  });

  it("từ chối confidence ngoài [0,1]", () => {
    const bad = { ...valid, columnMapping: { ...valid.columnMapping, diem: { col: 4, confidence: 1.5 } } };
    expect(AiImportAnalysisSchema.safeParse(bad).success).toBe(false);
  });

  it("từ chối field anomaly không hợp lệ", () => {
    const bad = { ...valid, rowAnomalies: [{ row: 1, field: "khac", value: "x", suggestedValue: null, reason: "y" }] };
    expect(AiImportAnalysisSchema.safeParse(bad).success).toBe(false);
  });
});

describe("buildSheetSamples", () => {
  function makeBuffer(dataRowCount: number): Buffer {
    const aoa: string[][] = [];
    // 7 dòng header (mục 5.5.2: dữ liệu bắt đầu từ dòng 8)
    for (let i = 0; i < 6; i++) aoa.push([`tiêu đề ${i}`]);
    aoa.push(["TT", "CCCD", "Mã SV", "Họ tên", "Điểm", "Xếp loại", "Ghi chú"]);
    for (let i = 0; i < dataRowCount; i++) {
      aoa.push([String(i + 1), "012345678901", `221CTT${i}`, `SV ${i}`, "80", "TOT", ""]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HỌC KỲ");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  it("lấy tối đa 15 dòng dữ liệu mẫu, đánh số row 1-based", () => {
    const samples = buildSheetSamples(makeBuffer(30));
    expect(samples).toHaveLength(1);
    const s = samples[0];
    expect(s.sheetName).toBe("HỌC KỲ");
    expect(s.headerRows).toHaveLength(7);
    expect(s.dataRows).toHaveLength(15);
    expect(s.dataRows[0].row).toBe(1);
    expect(s.dataRows[14].row).toBe(15);
  });

  it("giữ đúng số dòng khi ít hơn 15", () => {
    const samples = buildSheetSamples(makeBuffer(3));
    expect(samples[0].dataRows).toHaveLength(3);
  });
});
