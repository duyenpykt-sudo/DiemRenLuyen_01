import { apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { buildStudentTemplate } from "@/lib/student-template";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// GET /api/students/import/template — tải file Excel mẫu danh sách SV (mục 5.3.2.1).
export async function GET() {
  const g = await requireRole(["ADMIN", "CVHT"]);
  if (g.error) return g.error;

  try {
    const wb = buildStudentTemplate();
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition":
          'attachment; filename="mau-danh-sach-sinh-vien.xlsx"',
      },
    });
  } catch (e) {
    console.error("[student-template] Lỗi:", e);
    return apiError("Không tạo được file mẫu.", 500);
  }
}
