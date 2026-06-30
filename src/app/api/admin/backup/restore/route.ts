import { z } from "zod";
import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { restoreBackup } from "@/lib/backup";

const schema = z.object({ filename: z.string().min(1) });

// POST /api/admin/backup/restore — khôi phục DB từ 1 bản sao lưu.
export async function POST(req: Request) {
  const g = await requireAdmin();
  if (g.error) return g.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    await restoreBackup(parsed.data.filename);
    await writeAudit({
      userId: g.session.user.id,
      action: "RESTORE",
      entityType: "Database",
      newValue: { filename: parsed.data.filename },
      req,
    });
    return apiOk({ restored: parsed.data.filename });
  } catch (e) {
    return apiError((e as Error).message || "Không khôi phục được.", 500);
  }
}
