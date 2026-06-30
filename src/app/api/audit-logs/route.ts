import { prisma } from "@/lib/db";
import { apiOk } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";

// GET /api/audit-logs — nhật ký thao tác.
// ADMIN xem toàn bộ; vai trò khác chỉ xem log của chính mình (mục 5.10 PRD).
export async function GET() {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const where =
    g.session.user.role === "ADMIN" ? {} : { userId: g.session.user.id };

  const data = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      oldValue: true,
      newValue: true,
      ipAddress: true,
      createdAt: true,
      user: { select: { username: true, fullName: true } },
    },
  });
  return apiOk(data);
}
