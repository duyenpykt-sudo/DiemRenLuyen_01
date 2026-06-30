import { prisma } from "@/lib/db";
import { apiOk } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";

// GET /api/scores/semesters — danh sách học kỳ (kèm tên năm học) cho dropdown.
export async function GET() {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const data = await prisma.semester.findMany({
    orderBy: [{ academicYear: { startYear: "desc" } }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      name: true,
      isLocked: true,
      academicYearId: true,
      academicYear: { select: { name: true } },
    },
  });
  return apiOk(data);
}
