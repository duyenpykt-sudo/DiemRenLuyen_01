import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getClassPermission } from "@/lib/scores-access";
import { dbError } from "@/lib/prisma-error";
import {
  parseStudentBuffer,
  normalizeStudentRow,
  type StudentColumnMapping,
  type RawStudentRow,
} from "@/lib/student-import";

// Giá trị AI đề xuất đã được CVHT duyệt — áp vào đúng dòng/trường TRƯỚC khi chuẩn hoá.
const overrideFields = [
  "mssv",
  "cccd",
  "hoTen",
  "gioiTinh",
  "ngaySinh",
  "trangThai",
  "ghiChu",
] as const;
const overridesSchema = z.array(
  z.object({
    row: z.number().int().positive(),
    field: z.enum(overrideFields),
    value: z.string(),
  })
);

// POST /api/students/import/preview — parse + validate + đối chiếu, KHÔNG ghi DB.
export async function POST(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Dữ liệu không hợp lệ.", 400);
  const file = form.get("file");
  const classId = String(form.get("classId") ?? "");
  const mode = String(form.get("mode") ?? "skip") === "update" ? "update" : "skip";
  const sheetName = String(form.get("sheetName") ?? "") || undefined;

  if (!(file instanceof File)) return apiError("Thiếu file.", 400);
  if (!classId) return apiError("Thiếu lớp đích.", 400);
  if (file.size > 5 * 1024 * 1024) return apiError("File vượt quá 5MB.", 400);

  // Ánh xạ cột do AI đề xuất + CVHT duyệt (mục 5.3.2.2).
  let mapping: StudentColumnMapping | undefined;
  const mappingRaw = form.get("columnMapping");
  if (typeof mappingRaw === "string" && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw) as StudentColumnMapping;
    } catch {
      return apiError("Ánh xạ cột không hợp lệ.", 400);
    }
  }
  let overrides: z.infer<typeof overridesSchema> = [];
  const overridesRaw = form.get("overrides");
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

  const perm = await getClassPermission(g.session, classId);
  if (!perm.klass) return apiError("Không tìm thấy lớp.", 404);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền import cho lớp này.", 403);
  }

  let rows: RawStudentRow[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rows = parseStudentBuffer(buffer, sheetName, mapping);
  } catch (e) {
    return apiError((e as Error).message, 400);
  }
  if (rows.length === 0) {
    return apiError("Không đọc được dòng sinh viên nào trong file.", 400);
  }

  // Áp override đã duyệt (row 1-based theo thứ tự dòng dữ liệu).
  for (const o of overrides) {
    const target = rows[o.row - 1];
    if (target) target[o.field] = o.value;
  }

  // Chuẩn hoá + validate từng dòng.
  const normalized = rows.map((r) => ({ raw: r, res: normalizeStudentRow(r) }));

  // Đối chiếu SV đã tồn tại (studentCode/citizenId là UNIQUE toàn hệ thống).
  const codes = normalized
    .map((n) => n.res.data?.studentCode)
    .filter((v): v is string => !!v);
  const cccds = normalized
    .map((n) => n.res.data?.citizenId)
    .filter((v): v is string => !!v);
  let existing;
  try {
    existing = await prisma.student.findMany({
      where: { OR: [{ studentCode: { in: codes } }, { citizenId: { in: cccds } }] },
      select: {
        id: true,
        studentCode: true,
        citizenId: true,
        classId: true,
        class: { select: { code: true } },
      },
    });
  } catch (e) {
    return dbError(e);
  }
  const byCode = new Map(existing.map((s) => [s.studentCode, s]));
  const byCccd = new Map(existing.map((s) => [s.citizenId, s]));

  // Phát hiện trùng trong chính file.
  const seenCode = new Set<string>();
  const seenCccd = new Set<string>();

  const preview = normalized.map((n, idx) => {
    const base = {
      row: idx + 1,
      mssv: n.raw.mssv,
      cccd: n.raw.cccd,
      hoTen: n.raw.hoTen,
      gioiTinh: n.raw.gioiTinh,
      ngaySinh: n.raw.ngaySinh,
      trangThai: n.raw.trangThai,
      ghiChu: n.raw.ghiChu,
    };
    if (!n.res.data) {
      return { ...base, status: "error" as const, error: n.res.error, existingClass: null, data: null };
    }
    const d = n.res.data;
    if (seenCode.has(d.studentCode) || seenCccd.has(d.citizenId)) {
      return {
        ...base,
        status: "error" as const,
        error: "Trùng MSSV/CCCD với dòng khác trong file",
        existingClass: null,
        data: null,
      };
    }
    seenCode.add(d.studentCode);
    seenCccd.add(d.citizenId);

    const sCode = byCode.get(d.studentCode) ?? null;
    const sCccd = byCccd.get(d.citizenId) ?? null;
    if (sCode && sCccd && sCode.id !== sCccd.id) {
      return {
        ...base,
        status: "error" as const,
        error: "MSSV và CCCD thuộc 2 sinh viên khác nhau trong hệ thống",
        existingClass: null,
        data: null,
      };
    }
    const found = sCode ?? sCccd;
    if (found) {
      return {
        ...base,
        status: mode === "update" ? ("update" as const) : ("skip" as const),
        error: null,
        existingClass: found.class.code,
        data: d,
      };
    }
    return { ...base, status: "new" as const, error: null, existingClass: null, data: d };
  });

  const summary = {
    total: preview.length,
    new: preview.filter((r) => r.status === "new").length,
    update: preview.filter((r) => r.status === "update").length,
    skip: preview.filter((r) => r.status === "skip").length,
    error: preview.filter((r) => r.status === "error").length,
  };

  return apiOk({ classId, mode, rows: preview, summary });
}
