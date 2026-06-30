import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { cohortSchema } from "@/lib/validations/catalog";

// GET /api/cohorts — danh sách khóa học.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const data = await prisma.cohort.findMany({
    orderBy: { startYear: "desc" },
    include: { _count: { select: { classes: true } } },
  });
  return apiOk(data);
}

// POST /api/cohorts — tạo khóa học mới.
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = cohortSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const created = await prisma.cohort.create({ data: parsed.data });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "Cohort",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "khóa học");
  }
}
