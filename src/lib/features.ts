/**
 * Feature flags điều khiển qua biến môi trường (mục 5.5 + flag IMPORT_EXCEL_ENABLED).
 *
 * Đọc ở server. Client lấy giá trị qua API public GET /api/config/features.
 * Khi đổi giá trị trong .env phải restart server để có hiệu lực.
 */
export const features = {
  // Bật/tắt tính năng Import Excel. Mặc định OFF (ẩn nút UI + API trả 403).
  importExcel: process.env.IMPORT_EXCEL_ENABLED === "true",
};
