import { NextResponse } from "next/server";
import { features } from "@/lib/features";

// Đọc biến môi trường lúc chạy (không prerender tĩnh lúc build) để flag
// có hiệu lực ngay sau khi đổi .env + restart.
export const dynamic = "force-dynamic";

/**
 * GET /api/config/features
 * API public (KHÔNG cần auth) để client biết feature flag nào đang bật.
 * Trả về: { importExcelEnabled: boolean, aiImportEnabled: boolean }
 */
export async function GET() {
  return NextResponse.json({
    importExcelEnabled: features.importExcel,
    aiImportEnabled: features.aiImport,
  });
}
