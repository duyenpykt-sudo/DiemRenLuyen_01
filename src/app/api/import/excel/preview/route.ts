import { z } from "zod";
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

// Chỉnh sửa do CVHT duyệt từ đề xuất AI (mục 5.5.2): áp giá trị chuẩn hoá vào
// đúng dòng/trường TRƯỚC khi đối chiếu, để việc match SV + validate điểm đều
// chạy lại server-side (không tin giá trị AI nếu chưa qua bước này).
const overridesSchema = z.array(
  z.object({
    row: z.number().int().positive(),
    field: z.enum(["cccd", "maSV", "hoTen", "diem", "ghiChu"]),
    value: z.string(),
  })
);

// POST /api/import/excel/preview — parse + đối chiếu, KHÔNG ghi DB (mục 5.5).
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
  const semesterId = String(form.get("semesterId") ?? "");
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
  // Giá trị AI đề xuất đã được CVHT duyệt (nếu có).
  const overridesRaw = form.get("overrides");
  let overrides: z.infer<typeof overridesSchema> = [];
  if (typeof overridesRaw === "string" && overridesRaw.trim()) {
    let arr: unknown;
    try {
      arr = JSON.parse(overridesRaw);
    } catch {
      return apiError("Danh sách chỉnh sửa không hợp lệ.", 400);
    }
    const ov = overridesSchema.safeParse(arr);
    if (!ov.success) return apiError("Danh sách chỉnh sửa không hợp lệ.", 400);
    overrides = ov.data;
  }
  if (!(file instanceof File)) return apiError("Thiếu file.", 400);
  if (!semesterId) return apiError("Thiếu học kỳ đích.", 400);
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

  // Áp giá trị CVHT đã duyệt (row 1-based = thứ tự dòng dữ liệu trong preview)
  // TRƯỚC khi đối chiếu, để maSV/cccd sửa lại được re-match, điểm sửa lại được
  // validate. Bỏ qua override trỏ ngoài phạm vi.
  for (const o of overrides) {
    const target = parsed[o.row - 1];
    if (target) target[o.field] = o.value;
  }

  // SV thuộc lớp đích.
  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true, studentCode: true, citizenId: true, fullName: true },
  });
  const byCode = new Map(students.map((s) => [s.studentCode, s]));
  const byCccd = new Map(students.map((s) => [s.citizenId, s]));

  // Điểm ĐÃ CÓ của các SV này tại học kỳ đích → phát hiện "sẽ ghi đè".
  const existing = await prisma.conductScore.findMany({
    where: { semesterId, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true, score: true },
  });
  const existingByStudent = new Map(existing.map((e) => [e.studentId, e.score]));

  // Đối chiếu toàn hệ thống để phân biệt "không thuộc lớp đích" vs "không có trong DB".
  const codes = parsed.map((r) => r.maSV).filter(Boolean);
  const cccds = parsed.map((r) => r.cccd).filter(Boolean);
  const globalStudents = await prisma.student.findMany({
    where: { OR: [{ studentCode: { in: codes } }, { citizenId: { in: cccds } }] },
    select: { studentCode: true, citizenId: true },
  });
  const globalCodes = new Set(globalStudents.map((s) => s.studentCode));
  const globalCccds = new Set(globalStudents.map((s) => s.citizenId));

  const preview = parsed.map((row, idx) => {
    const student = byCode.get(row.maSV) ?? byCccd.get(row.cccd) ?? null;
    const score = Number(row.diem);
    const validScore = Number.isInteger(score) && score >= 0 && score <= 100;
    const existingScore = student
      ? existingByStudent.get(student.id) ?? null
      : null;

    // matchStatus: matched | not_in_target_class | not_in_db
    // action:      create | overwrite | skip
    let matchStatus: "matched" | "not_in_target_class" | "not_in_db";
    let action: "create" | "overwrite" | "skip";
    let error: string | null = null;

    if (student) {
      matchStatus = "matched";
      if (row.diem === "" || !validScore) {
        action = "skip";
        error = "Điểm không hợp lệ (0–100)";
      } else if (existingScore != null) {
        action = "overwrite";
      } else {
        action = "create";
      }
    } else if (globalCodes.has(row.maSV) || globalCccds.has(row.cccd)) {
      matchStatus = "not_in_target_class";
      action = "skip";
      error = "SV không thuộc lớp đích";
    } else {
      matchStatus = "not_in_db";
      action = "skip";
      error = "Không tìm thấy SV trong hệ thống";
    }

    return {
      row: idx + 1,
      maSV: row.maSV,
      cccd: row.cccd,
      hoTen: row.hoTen,
      diem: row.diem,
      note: row.ghiChu,
      matchStatus,
      action,
      studentId: student?.id ?? null,
      studentName: student?.fullName ?? null,
      score: validScore ? score : null,
      existingScore,
      error,
    };
  });

  return apiOk({ classId, semesterId, sheetName, rows: preview });
}
