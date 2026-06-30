import { NextResponse } from "next/server";
import { features } from "@/lib/features";

/**
 * GET /api/config/features
 * API public (KHÔNG cần auth) để client biết feature flag nào đang bật.
 * Trả về: { importExcelEnabled: boolean }
 */
export async function GET() {
  return NextResponse.json({
    importExcelEnabled: features.importExcel,
  });
}
