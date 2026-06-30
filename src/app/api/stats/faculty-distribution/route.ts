import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { buildFacultySummary } from "@/lib/export-data";

// GET /api/stats/faculty-distribution?academicYearId=&facultyId= — tổng hợp khoa theo năm.
// Chỉ Trưởng khoa (khoa mình) và Admin.
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const sp = new URL(req.url).searchParams;
  const academicYearId = sp.get("academicYearId") ?? "";
  const facultyId =
    g.session.user.role === "ADMIN"
      ? (sp.get("facultyId") ?? g.session.user.facultyId ?? "")
      : (g.session.user.facultyId ?? "");
  if (!facultyId) return apiError("Thiếu thông tin khoa.", 400);
  if (!academicYearId) return apiError("Thiếu năm học.", 400);

  const data = await buildFacultySummary(facultyId, "NH", { academicYearId });
  if (!data) return apiError("Không tìm thấy khoa.", 404);
  return apiOk({ classes: data.classes, subtitle: data.subtitle });
}
