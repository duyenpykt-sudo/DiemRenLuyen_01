import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { getClassPermission } from "@/lib/scores-access";
import { dbError, handleMutationError } from "@/lib/prisma-error";
import { GenderSchema, StudentStatusSchema } from "@/lib/enums";

// Item đã chuẩn hoá ở preview — commit VẪN validate lại (không tin client).
const itemSchema = z.object({
  studentCode: z
    .string()
    .trim()
    .regex(/^[0-9]{3}[A-Z]{3}[0-9]{3}$/, { message: "MSSV sai định dạng" }),
  citizenId: z
    .string()
    .trim()
    .regex(/^[0-9]{12}$/, { message: "CCCD phải gồm đúng 12 chữ số" }),
  fullName: z.string().trim().min(1).max(100),
  gender: GenderSchema.nullable().default(null),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  status: StudentStatusSchema.default("ACTIVE"),
  note: z.string().trim().max(500).nullable().default(null),
});

const commitSchema = z.object({
  classId: z.string().min(1),
  mode: z.enum(["skip", "update"]).default("skip"),
  filename: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

// POST /api/students/import/commit — ghi danh sách SV đã xác nhận (1 transaction).
export async function POST(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  const parsed = commitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { classId, mode, filename, items } = parsed.data;

  const perm = await getClassPermission(g.session, classId);
  if (!perm.klass) return apiError("Không tìm thấy lớp.", 404);
  if (!perm.canMutate) {
    return apiError("Bạn không có quyền import cho lớp này.", 403);
  }

  // Đối chiếu toàn hệ thống (studentCode/citizenId UNIQUE).
  const codes = items.map((i) => i.studentCode);
  const cccds = items.map((i) => i.citizenId);
  let existing;
  try {
    existing = await prisma.student.findMany({
      where: { OR: [{ studentCode: { in: codes } }, { citizenId: { in: cccds } }] },
      select: { id: true, studentCode: true, citizenId: true },
    });
  } catch (e) {
    return dbError(e);
  }
  const byCode = new Map(existing.map((s) => [s.studentCode, s]));
  const byCccd = new Map(existing.map((s) => [s.citizenId, s]));

  // Phân loại thao tác tất định + loại dòng lỗi (trùng file / xung đột) TRƯỚC
  // khi mở transaction, để 1 dòng lỗi không làm hỏng cả mẻ (mục 5.3.2).
  const seenCode = new Set<string>();
  const seenCccd = new Set<string>();
  type Op =
    | { kind: "create"; item: z.infer<typeof itemSchema> }
    | { kind: "update"; id: string; item: z.infer<typeof itemSchema> };
  const ops: Op[] = [];
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    if (seenCode.has(item.studentCode) || seenCccd.has(item.citizenId)) {
      failed++;
      continue;
    }
    seenCode.add(item.studentCode);
    seenCccd.add(item.citizenId);

    const sCode = byCode.get(item.studentCode) ?? null;
    const sCccd = byCccd.get(item.citizenId) ?? null;
    if (sCode && sCccd && sCode.id !== sCccd.id) {
      failed++;
      continue;
    }
    const found = sCode ?? sCccd;
    if (found) {
      if (mode === "update") ops.push({ kind: "update", id: found.id, item });
      else skipped++;
    } else {
      ops.push({ kind: "create", item });
    }
  }

  const toData = (item: z.infer<typeof itemSchema>) => ({
    studentCode: item.studentCode,
    citizenId: item.citizenId,
    fullName: item.fullName,
    gender: item.gender,
    dob: item.dob ? new Date(`${item.dob}T00:00:00.000Z`) : null,
    status: item.status,
    note: item.note,
  });

  // Ghi hợp lệ trong 1 transaction.
  let done;
  try {
    done = await prisma.$transaction(
      ops.map((op) =>
        op.kind === "create"
          ? prisma.student.create({ data: { ...toData(op.item), classId } })
          : prisma.student.update({
              where: { id: op.id },
              data: { ...toData(op.item), classId },
            })
      )
    );
  } catch (e) {
    return handleMutationError(e, "sinh viên");
  }

  const userId = g.session.user.id;
  let created = 0;
  let updated = 0;
  // Audit từng SV (mục 5.3.2): IMPORT_CREATE / IMPORT_UPDATE.
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const rec = done[i];
    if (op.kind === "create") created++;
    else updated++;
    await writeAudit({
      userId,
      action: op.kind === "create" ? "IMPORT_CREATE" : "IMPORT_UPDATE",
      entityType: "Student",
      entityId: rec.id,
      newValue: { studentCode: rec.studentCode, classId, filename: filename ?? null },
      req,
    });
  }

  return apiOk({
    total: items.length,
    created,
    updated,
    skipped,
    failed,
  });
}
