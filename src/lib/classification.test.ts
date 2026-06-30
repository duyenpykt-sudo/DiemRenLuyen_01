import { describe, expect, it } from "vitest";
import {
  classifyScore,
  getYearScore,
  getCourseScore,
} from "@/lib/classification";

describe("classifyScore — các ngưỡng biên (mục 6.1 PRD)", () => {
  // SV đình chỉ → không xếp loại bất kể điểm.
  it("SUSPENDED luôn trả KHONG_XEP_LOAI", () => {
    expect(classifyScore(100, "SUSPENDED")).toBe("KHONG_XEP_LOAI");
    expect(classifyScore(0, "SUSPENDED")).toBe("KHONG_XEP_LOAI");
  });

  it.each([
    [0, "KEM"],
    [34, "KEM"],
    [35, "YEU"],
    [49, "YEU"],
    [50, "TRUNG_BINH"],
    [64, "TRUNG_BINH"],
    [65, "KHA"],
    [79, "KHA"],
    [80, "TOT"],
    [89, "TOT"],
    [90, "XUAT_SAC"],
    [100, "XUAT_SAC"],
  ])("điểm %i (ACTIVE) → %s", (score, expected) => {
    expect(classifyScore(score, "ACTIVE")).toBe(expected);
  });
});

describe("getYearScore — điểm năm (mục 6.2 PRD)", () => {
  it("trung bình làm tròn của 2 HK", () => {
    expect(getYearScore(71, 77)).toBe(74); // (71+77)/2 = 74
    expect(getYearScore(72, 70)).toBe(71); // (72+70)/2 = 71
    expect(getYearScore(80, 81)).toBe(81); // 80.5 → 81 (làm tròn)
  });

  it("thiếu 1 HK → null", () => {
    expect(getYearScore(71, null)).toBeNull();
    expect(getYearScore(null, 77)).toBeNull();
  });
});

describe("getCourseScore — điểm toàn khóa (mục 6.3 PRD)", () => {
  it("trung bình làm tròn + cờ đủ 8 HK", () => {
    const r = getCourseScore([77, 72, 75, 75, 70, 71, 71, 77]);
    expect(r.score).toBe(74);
    expect(r.isComplete).toBe(true);
  });

  it("dưới 8 HK → isComplete=false", () => {
    const r = getCourseScore([80, 70]);
    expect(r.score).toBe(75);
    expect(r.isComplete).toBe(false);
  });

  it("rỗng → null, chưa đủ", () => {
    const r = getCourseScore([]);
    expect(r.score).toBeNull();
    expect(r.isComplete).toBe(false);
  });
});
