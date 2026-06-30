import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getClassPermission } from "@/lib/scores-access";
import { classDistribution } from "@/lib/stats";

// GET /api/stats/class-distribution?classId=&semesterId= — phân bố xếp loại 1 lớp/HK.
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classId") ?? "";
  const semesterId = sp.get("semesterId") ?? "";
  if (!classId || !semesterId) return apiError("Thiếu lớp hoặc học kỳ.", 400);

  const perm = await getClassPermission(g.session, classId);
  if (!perm.canView) return apiError("Bạn không có quyền xem lớp này.", 403);

  return apiOk(await classDistribution(classId, semesterId));
}
