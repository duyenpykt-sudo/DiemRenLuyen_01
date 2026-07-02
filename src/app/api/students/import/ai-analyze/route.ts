import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getClassPermission } from "@/lib/scores-access";
import { features } from "@/lib/features";
import { writeAudit } from "@/lib/audit";
import {
  buildStudentSheetSamples,
  analyzeStudentSheetWithAI,
  studentColumnHeaderLabels,
} from "@/lib/ai-student-import";

// Đọc env lúc chạy để flag có hiệu lực ngay sau khi đổi .env + restart.
export const dynamic = "force-dynamic";

/**
 * POST /api/students/import/ai-analyze (multipart) — mục 5.3.2.2.
 * Dùng chung flag AI_IMPORT_ENABLED (+ GEMINI_API_KEY) với mục 5.5.2.
 * Gửi mẫu file tới Gemini đề xuất ánh xạ cột + gắn cờ dòng nghi ngờ. KHÔNG ghi DB.
 */
export async function POST(req: Request) {
  if (!features.aiImport) {
    return apiError("Tính năng phân tích bằng AI đang tắt.", 403);
  }
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Dữ liệu không hợp lệ.", 400);
  const file = form.get("file");
  const classId = String(form.get("classId") ?? "");
  if (!(file instanceof File)) return apiError("Thiếu file.", 400);
  if (file.size > 5 * 1024 * 1024) return apiError("File vượt quá 5MB.", 400);

  const perm = await getClassPermission(g.session, classId);
  if (!perm.klass) return apiError("Không tìm thấy lớp.", 404);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền import cho lớp này.", 403);
  }

  let samples;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    samples = buildStudentSheetSamples(buffer);
  } catch (e) {
    return apiError((e as Error).message, 400);
  }

  let analysis;
  try {
    analysis = await analyzeStudentSheetWithAI(samples);
  } catch (e) {
    return apiError(`Không phân tích được bằng AI: ${(e as Error).message}`, 502);
  }

  const guessed = samples.find((s) => s.sheetName === analysis.sheetGuess);
  const columnHeaders = guessed ? studentColumnHeaderLabels(guessed) : [];

  await writeAudit({
    userId: g.session.user.id,
    action: "AI_ANALYZE_IMPORT_STUDENTS",
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
