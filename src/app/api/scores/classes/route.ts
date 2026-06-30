import { apiOk } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { getViewableClasses } from "@/lib/scores-access";

// GET /api/scores/classes — các lớp người dùng được xem (lọc theo vai trò).
export async function GET() {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const data = await getViewableClasses(g.session);
  return apiOk(data);
}
