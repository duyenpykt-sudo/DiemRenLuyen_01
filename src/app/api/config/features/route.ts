import { apiOk } from "@/lib/api-response";
import { features } from "@/lib/features";

// Đọc biến môi trường lúc chạy (không prerender tĩnh lúc build) để flag
// có hiệu lực ngay sau khi đổi .env + restart.
export const dynamic = "force-dynamic";

/**
 * GET /api/config/features
 * API public (KHÔNG cần auth) để client biết feature flag nào đang bật.
 * Dùng bao { data, error } thống nhất để client `http.get` bóc đúng payload.
 * data = { importExcelEnabled: boolean, aiImportEnabled: boolean }
 */
export async function GET() {
  return apiOk({
    importExcelEnabled: features.importExcel,
    aiImportEnabled: features.aiImport,
    chatboxEnabled: features.chatbox,
  });
}
