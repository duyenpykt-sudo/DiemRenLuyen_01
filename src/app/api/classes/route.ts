import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { classSchema } from "@/lib/validations/catalog";

// GET /api/classes — danh sách lớp kèm khoa, khóa, CVHT và sĩ số.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const data = await prisma.class.findMany({
    orderBy: { code: "asc" },
    include: {
      faculty: { select: { id: true, name: true, code: true } },
      cohort: { select: { id: true, name: true } },
      advisor: { select: { id: true, fullName: true } },
      _count: { select: { students: true } },
    },
  });
  return apiOk(data);
}

// POST /api/classes — tạo lớp mới (bắt buộc có CVHT).
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = classSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const created = await prisma.class.create({ data: parsed.data });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "Class",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "lớp");
  }
}
