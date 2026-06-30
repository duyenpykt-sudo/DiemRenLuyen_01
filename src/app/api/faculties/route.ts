import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { facultySchema } from "@/lib/validations/catalog";

// GET /api/faculties — danh sách khoa.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const data = await prisma.faculty.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { classes: true, users: true } } },
  });
  return apiOk(data);
}

// POST /api/faculties — tạo khoa mới.
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = facultySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const created = await prisma.faculty.create({ data: parsed.data });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "Faculty",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "khoa");
  }
}
