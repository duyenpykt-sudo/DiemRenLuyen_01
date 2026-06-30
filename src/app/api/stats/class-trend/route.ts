import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getClassPermission } from "@/lib/scores-access";
import { classTrend } from "@/lib/stats";

// GET /api/stats/class-trend?classId= — xu hướng điểm TB của lớp qua các HK.
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const classId = new URL(req.url).searchParams.get("classId") ?? "";
  if (!classId) return apiError("Thiếu lớp.", 400);

  const perm = await getClassPermission(g.session, classId);
  if (!perm.canView) return apiError("Bạn không có quyền xem lớp này.", 403);

  return apiOk(await classTrend(classId));
}
