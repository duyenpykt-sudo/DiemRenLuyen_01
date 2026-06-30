import { prisma } from "@/lib/db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOCK"
  | "UNLOCK"
  | "IMPORT_EXCEL"
  | "EXPORT_EXCEL";

interface WriteAuditParams {
  userId: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  req?: Request;
}

/**
 * Ghi audit log cho mọi mutation (yêu cầu nghiệp vụ bắt buộc — CLAUDE.md).
 * oldValue/newValue được JSON.stringify; lấy IP + User-Agent từ request nếu có.
 * Không bao giờ throw để tránh làm hỏng mutation chính — chỉ log lỗi.
 */
export async function writeAudit({
  userId,
  action,
  entityType,
  entityId,
  oldValue,
  newValue,
  req,
}: WriteAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId ?? null,
        oldValue: oldValue !== undefined ? JSON.stringify(oldValue) : null,
        newValue: newValue !== undefined ? JSON.stringify(newValue) : null,
        ipAddress:
          req?.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
        userAgent: req?.headers.get("user-agent") ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] Không ghi được audit log:", e);
  }
}
