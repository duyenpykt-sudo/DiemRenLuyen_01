import { apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { getClassPermission } from "@/lib/scores-access";
import {
  exportClassSemester,
  exportClassYear,
  exportClassCohort,
  exportFacultySummary,
} from "@/lib/excel-export";
import {
  buildClassSemester,
  buildClassYear,
  buildClassCohort,
  buildFacultySummary,
} from "@/lib/export-data";
import type ExcelJS from "exceljs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fileResponse(buffer: ArrayBuffer, filename: string) {
  return new Response(buffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}

// GET /api/export/excel?type=class-semester|class-year|class-cohort|faculty-summary&...
export async function GET(req: Request) {
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;
  const session = g.session;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const classId = searchParams.get("classId") ?? "";
  const semesterId = searchParams.get("semesterId") ?? "";
  const academicYearId = searchParams.get("academicYearId") ?? "";

  // Các export theo lớp: cần quyền XEM lớp đó.
  async function ensureClassView() {
    const perm = await getClassPermission(session, classId);
    if (!perm.klass) return apiError("Không tìm thấy lớp.", 404);
    if (!perm.canView) return apiError("Bạn không có quyền xuất lớp này.", 403);
    return null;
  }

  let wb: ExcelJS.Workbook | null = null;
  let filename = "export";

  try {
    if (type === "class-semester") {
      const denied = await ensureClassView();
      if (denied) return denied;
      const data = await buildClassSemester(classId, semesterId);
      if (!data) return apiError("Thiếu dữ liệu lớp/học kỳ.", 404);
      wb = exportClassSemester(data);
      filename = data.filenameHint;
    } else if (type === "class-year") {
      const denied = await ensureClassView();
      if (denied) return denied;
      const data = await buildClassYear(classId, academicYearId);
      if (!data) return apiError("Thiếu dữ liệu lớp/năm học.", 404);
      wb = exportClassYear(data);
      filename = data.filenameHint;
    } else if (type === "class-cohort") {
      const denied = await ensureClassView();
      if (denied) return denied;
      const data = await buildClassCohort(classId);
      if (!data) return apiError("Thiếu dữ liệu lớp/khóa học.", 404);
      wb = exportClassCohort(data);
      filename = data.filenameHint;
    } else if (type === "faculty-summary") {
      // Chỉ Trưởng khoa (khoa mình) và Admin.
      const role = session.user.role;
      if (role === "CVHT") {
        return apiError("Bạn không có quyền xuất tổng hợp khoa.", 403);
      }
      const scope = (searchParams.get("scope") ?? "HK") as "HK" | "NH" | "TK";
      const facultyId =
        role === "ADMIN"
          ? (searchParams.get("facultyId") ?? session.user.facultyId ?? "")
          : (session.user.facultyId ?? "");
      if (!facultyId) return apiError("Thiếu thông tin khoa.", 400);

      const data = await buildFacultySummary(facultyId, scope, {
        semesterId,
        academicYearId,
        cohortId: searchParams.get("cohortId") ?? undefined,
      });
      if (!data) return apiError("Không tìm thấy khoa.", 404);
      wb = exportFacultySummary(data);
      filename = data.filenameHint;
    } else {
      return apiError("Loại export không hợp lệ.", 400);
    }

    const buffer = await wb.xlsx.writeBuffer();
    await writeAudit({
      userId: session.user.id,
      action: "EXPORT_EXCEL",
      entityType: "Export",
      newValue: { type, classId, semesterId, academicYearId, filename },
      req,
    });
    return fileResponse(buffer as ArrayBuffer, filename);
  } catch (e) {
    console.error("[export] Lỗi:", e);
    return apiError("Không tạo được file Excel.", 500);
  }
}
