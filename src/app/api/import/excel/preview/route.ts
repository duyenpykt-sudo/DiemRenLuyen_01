import { prisma } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getClassPermission } from "@/lib/scores-access";
import { features } from "@/lib/features";
import {
  parseHocKyBuffer,
  parseHocKyBufferWithMapping,
  type ColumnMapping,
} from "@/lib/excel-import";

// POST /api/import/excel/preview — parse + đối chiếu, KHÔNG ghi DB.
export async function POST(req: Request) {
  // 1) Kiểm tra feature flag ĐẦU TIÊN.
  if (!features.importExcel) {
    return apiError("Tính năng Import Excel đang tắt.", 403);
  }
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Dữ liệu không hợp lệ.", 400);
  const file = form.get("file");
  const classId = String(form.get("classId") ?? "");
  const sheetName = String(form.get("sheetName") ?? "HỌC KỲ");
  // Ánh xạ cột do AI đề xuất + CVHT duyệt (mục 5.5.2). Nếu không có → parser tất định.
  const mappingRaw = form.get("columnMapping");
  let mapping: ColumnMapping | null = null;
  if (typeof mappingRaw === "string" && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw) as ColumnMapping;
    } catch {
      return apiError("Ánh xạ cột không hợp lệ.", 400);
    }
  }
  if (!(file instanceof File)) return apiError("Thiếu file.", 400);
  if (file.size > 5 * 1024 * 1024) {
    return apiError("File vượt quá 5MB.", 400);
  }

  const perm = await getClassPermission(g.session, classId);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền import cho lớp này.", 403);
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = mapping
      ? parseHocKyBufferWithMapping(buffer, sheetName, mapping)
      : parseHocKyBuffer(buffer, sheetName);
  } catch (e) {
    return apiError((e as Error).message, 400);
  }

  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, studentCode: true, citizenId: true, fullName: true },
  });
  const byCode = new Map(students.map((s) => [s.studentCode, s]));
  const byCccd = new Map(students.map((s) => [s.citizenId, s]));

  const preview = parsed.map((row, idx) => {
    const student = byCode.get(row.maSV) ?? byCccd.get(row.cccd) ?? null;
    const score = Number(row.diem);
    const validScore = Number.isInteger(score) && score >= 0 && score <= 100;

    let error: string | null = null;
    if (!student) error = "Không tìm thấy SV trong lớp (theo MSSV/CCCD)";
    else if (row.diem === "" || !validScore) error = "Điểm không hợp lệ (0–100)";

    return {
      row: idx + 1,
      maSV: row.maSV,
      cccd: row.cccd,
      hoTen: row.hoTen,
      diem: row.diem,
      note: row.ghiChu,
      matched: !!student,
      studentId: student?.id ?? null,
      studentName: student?.fullName ?? null,
      score: validScore ? score : null,
      error,
    };
  });

  return apiOk({ classId, sheetName, rows: preview });
}
