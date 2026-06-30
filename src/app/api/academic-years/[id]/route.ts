import { prisma } from "@/lib/db";
import { apiOk, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { handleMutationError } from "@/lib/prisma-error";
import { academicYearSchema } from "@/lib/validations/catalog";

type Params = { params: { id: string } };

// PATCH /api/academic-years/[id] — cập nhật thông tin năm học (không đụng học kỳ).
export async function PATCH(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = academicYearSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const old = await prisma.academicYear.findUnique({
      where: { id: params.id },
    });
    const updated = await prisma.academicYear.update({
      where: { id: params.id },
      data: parsed.data,
    });
    await writeAudit({
      userId: g.session.user.id,
      action: "UPDATE",
      entityType: "AcademicYear",
      entityId: updated.id,
      oldValue: old,
      newValue: updated,
      req,
    });
    return apiOk(updated);
  } catch (e) {
    return handleMutationError(e, "năm học");
  }
}

// DELETE /api/academic-years/[id] — xóa năm học + các học kỳ con (nếu chưa có điểm).
export async function DELETE(req: Request, { params }: Params) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  try {
    const old = await prisma.academicYear.findUnique({
      where: { id: params.id },
      include: { semesters: true },
    });
    // Xóa học kỳ con trước; nếu học kỳ đã có điểm → FK chặn (P2003) → báo lỗi.
    await prisma.$transaction([
      prisma.semester.deleteMany({ where: { academicYearId: params.id } }),
      prisma.academicYear.delete({ where: { id: params.id } }),
    ]);
    await writeAudit({
      userId: g.session.user.id,
      action: "DELETE",
      entityType: "AcademicYear",
      entityId: params.id,
      oldValue: old,
      req,
    });
    return apiOk({ id: params.id });
  } catch (e) {
    return handleMutationError(e, "năm học");
  }
}
