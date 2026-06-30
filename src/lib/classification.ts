import type { Classification, StudentStatus } from "@/lib/enums";

/**
 * Tính xếp loại rèn luyện từ điểm số và trạng thái sinh viên.
 * Quy tắc chốt theo mục 6.1 PRD — KHÔNG được tự đổi ngưỡng.
 * Sinh viên đang đình chỉ (SUSPENDED) → không xếp loại.
 */
export function classifyScore(
  score: number,
  studentStatus: StudentStatus
): Classification {
  if (studentStatus === "SUSPENDED") return "KHONG_XEP_LOAI";
  if (score >= 90) return "XUAT_SAC";
  if (score >= 80) return "TOT";
  if (score >= 65) return "KHA";
  if (score >= 50) return "TRUNG_BINH";
  if (score >= 35) return "YEU";
  return "KEM";
}

/** Nhãn tiếng Việt cho từng mức xếp loại — dùng hiển thị trên UI và Excel. */
export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  XUAT_SAC: "Xuất sắc",
  TOT: "Tốt",
  KHA: "Khá",
  TRUNG_BINH: "Trung bình",
  YEU: "Yếu",
  KEM: "Kém",
  KHONG_XEP_LOAI: "Không xếp loại",
};

/**
 * Điểm năm học = trung bình làm tròn của HKI và HKII.
 * Thiếu 1 học kỳ → trả về null (UI hiển thị "—").
 */
export function getYearScore(
  hkiScore: number | null | undefined,
  hkiiScore: number | null | undefined
): number | null {
  if (hkiScore == null || hkiiScore == null) return null;
  return Math.round((hkiScore + hkiiScore) / 2);
}

/**
 * Điểm toàn khóa = trung bình làm tròn của các học kỳ có điểm.
 * Trả về điểm và cờ "đủ 8 học kỳ hay chưa" (mục 6.3 PRD).
 */
export function getCourseScore(scores: number[]): {
  score: number | null;
  isComplete: boolean;
} {
  if (scores.length === 0) return { score: null, isComplete: false };
  const sum = scores.reduce((acc, s) => acc + s, 0);
  return {
    score: Math.round(sum / scores.length),
    isComplete: scores.length >= 8,
  };
}
