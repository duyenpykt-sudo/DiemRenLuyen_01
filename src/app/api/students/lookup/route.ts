import { prisma } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getViewableClasses } from "@/lib/scores-access";

// GET /api/students/lookup?q=<MSSV hoặc CCCD> — tra cứu nhanh 1 SV (cho ô tìm ở topbar).
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return apiError("Vui lòng nhập MSSV hoặc CCCD.", 400);

  const classes = await getViewableClasses(g.session);
  const scopeIds = classes.map((c) => c.id);

  const student = await prisma.student.findFirst({
    where: {
      classId: { in: scopeIds },
      OR: [{ studentCode: q }, { citizenId: q }],
    },
    select: { id: true },
  });
  if (!student) return apiError("Không tìm thấy sinh viên.", 404);
  return apiOk({ id: student.id });
}
