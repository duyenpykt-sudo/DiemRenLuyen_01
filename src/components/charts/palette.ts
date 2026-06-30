import type { Classification } from "@/lib/enums";

// Màu cố định cho từng mức xếp loại (đồng bộ giữa các biểu đồ).
export const CLASS_COLORS: Record<Classification, string> = {
  XUAT_SAC: "#7c3aed",
  TOT: "#16a34a",
  KHA: "#2563eb",
  TRUNG_BINH: "#ca8a04",
  YEU: "#ea580c",
  KEM: "#dc2626",
  KHONG_XEP_LOAI: "#9ca3af",
};
