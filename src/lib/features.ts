/**
 * Feature flags điều khiển qua biến môi trường (mục 5.5 + flag IMPORT_EXCEL_ENABLED).
 *
 * Đọc ở server. Client lấy giá trị qua API public GET /api/config/features.
 * Khi đổi giá trị trong .env phải restart server để có hiệu lực.
 */
export const features = {
  // Bật/tắt tính năng Import Excel. Mặc định OFF (ẩn nút UI + API trả 403).
  importExcel: process.env.IMPORT_EXCEL_ENABLED === "true",

  // Bật/tắt AI nhận diện file Excel import (Google Gemini) — mục 5.5.2.
  // Chỉ bật khi flag = true VÀ có GEMINI_API_KEY. Đây là điều kiện đủ để hiện
  // nút "Phân tích bằng AI"; nút chỉ hoạt động trong luồng Import (importExcel).
  aiImport:
    process.env.AI_IMPORT_ENABLED === "true" &&
    !!process.env.GEMINI_API_KEY?.trim(),

  // Bật/tắt Chatbox trợ lý (mục 5.11). Chỉ bật khi flag = true VÀ có
  // GEMINI_API_KEY. false → ẩn floating button + API /api/chat trả 403.
  chatbox:
    process.env.CHATBOX_ENABLED === "true" &&
    !!process.env.GEMINI_API_KEY?.trim(),
};
