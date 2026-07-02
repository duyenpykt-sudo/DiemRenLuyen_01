import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getClassPermission } from "@/lib/scores-access";
import { features } from "@/lib/features";
import {
  buildSheetSamples,
  analyzeExcelWithAI,
  columnHeaderLabels,
} from "@/lib/ai-import";
import { writeAudit } from "@/lib/audit";

// Đọc env lúc chạy để flag có hiệu lực ngay sau khi đổi .env + restart.
export const dynamic = "force-dynamic";

/**
 * POST /api/import/excel/ai-analyze (multipart) — mục 5.5.2.
 * Gửi mẫu file tới Google Gemini để đề xuất ánh xạ cột + gắn cờ dòng nghi ngờ.
 * KHÔNG ghi DB. Trả 403 nếu AI_IMPORT_ENABLED=false hoặc thiếu GEMINI_API_KEY.
 */
export async function POST(req: Request) {
  // 1) Feature flag ĐẦU TIÊN (AI là phần mở rộng của Import Excel).
  if (!features.importExcel || !features.aiImport) {
    return apiError("Tính năng phân tích bằng AI đang tắt.", 403);
  }
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Dữ liệu không hợp lệ.", 400);
  const file = form.get("file");
  const classId = String(form.get("classId") ?? "");
  if (!(file instanceof File)) return apiError("Thiếu file.", 400);
  if (file.size > 5 * 1024 * 1024) {
    return apiError("File vượt quá 5MB.", 400);
  }

  const perm = await getClassPermission(g.session, classId);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền import cho lớp này.", 403);
  }

  let samples;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    samples = buildSheetSamples(buffer);
  } catch (e) {
    return apiError((e as Error).message, 400);
  }

  let analysis;
  try {
    analysis = await analyzeExcelWithAI(samples);
  } catch (e) {
    // Gọi Gemini thất bại → 502, không chặn CVHT nhập tay/parser tất định.
    return apiError(
      `Không phân tích được bằng AI: ${(e as Error).message}`,
      502
    );
  }

  // Nhãn cột của sheet AI đoán → giúp CVHT chỉnh ánh xạ trên combobox.
  const guessed = samples.find((s) => s.sheetName === analysis.sheetGuess);
  const columnHeaders = guessed ? columnHeaderLabels(guessed) : [];

  // Audit log — KHÔNG log nội dung điểm chi tiết.
  await writeAudit({
    userId: g.session.user.id,
    action: "AI_ANALYZE_IMPORT",
    entityType: "Import",
    entityId: classId,
    newValue: {
      filename: file.name,
      sheet: analysis.sheetGuess,
      rowsAnalyzed: guessed?.dataRows.length ?? 0,
    },
    req,
  });

  return apiOk({ ...analysis, columnHeaders });
}
