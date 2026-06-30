import { apiOk, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { createBackup, listBackups } from "@/lib/backup";

// GET /api/admin/backup — danh sách bản sao lưu.
export async function GET() {
  const g = await requireAdmin();
  if (g.error) return g.error;
  return apiOk(await listBackups());
}

// POST /api/admin/backup — tạo bản sao lưu mới.
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;
  try {
    const filename = await createBackup();
    await writeAudit({
      userId: g.session.user.id,
      action: "BACKUP",
      entityType: "Database",
      newValue: { filename },
      req,
    });
    return apiOk({ filename }, 201);
  } catch (e) {
    console.error("[backup] Lỗi:", e);
    return apiError("Không tạo được bản sao lưu.", 500);
  }
}
