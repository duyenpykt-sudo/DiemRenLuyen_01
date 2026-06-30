import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { studentSchema } from "@/lib/validations/catalog";
import { toStudentData } from "@/lib/entity-helpers";

// GET /api/students — danh sách sinh viên kèm lớp.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const data = await prisma.student.findMany({
    orderBy: { studentCode: "asc" },
    include: {
      class: {
        select: {
          id: true,
          code: true,
          faculty: { select: { name: true } },
        },
      },
    },
  });
  return apiOk(data);
}

// POST /api/students — tạo sinh viên mới.
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = studentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const created = await prisma.student.create({
      data: toStudentData(parsed.data),
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "Student",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "sinh viên");
  }
}
