import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { academicYearSchema } from "@/lib/validations/catalog";

// GET /api/academic-years — danh sách năm học kèm các học kỳ con.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const data = await prisma.academicYear.findMany({
    orderBy: { startYear: "desc" },
    include: {
      semesters: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          name: true,
          isLocked: true,
          // Số bản ghi điểm đang gắn (mục 5.3.1) — dùng cho badge + chặn xóa.
          _count: { select: { conductScores: true } },
        },
      },
    },
  });
  return apiOk(data);
}

// POST /api/academic-years — tạo năm học + tự sinh 2 học kỳ (HK1, HK2).
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = academicYearSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const created = await prisma.academicYear.create({
      data: {
        ...parsed.data,
        semesters: {
          create: [
            { number: 1, name: "Học kỳ 1" },
            { number: 2, name: "Học kỳ 2" },
          ],
        },
      },
      include: { semesters: true },
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "CREATE",
      entityType: "AcademicYear",
      entityId: created.id,
      newValue: created,
      req,
    });
    return apiOk(created, 201);
  } catch (e) {
    return handleMutationError(e, "năm học");
  }
}
