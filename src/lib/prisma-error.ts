import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-response";

/**
 * Chuyển lỗi Prisma thành response { error } với thông báo tiếng Việt thân thiện.
 * - P2002: trùng giá trị unique.
 * - P2003/P2014: vi phạm khóa ngoại (thường khi xóa bản ghi còn được tham chiếu).
 * - P2025: không tìm thấy bản ghi.
 */
export function handleMutationError(e: unknown, entityLabel: string) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined)?.join(", ");
      return apiError(
        `Giá trị đã tồn tại${target ? ` (trùng: ${target})` : ""}.`,
        409
      );
    }
    if (e.code === "P2003" || e.code === "P2014") {
      return apiError(
        `Không thể xóa ${entityLabel} vì đang được dữ liệu khác tham chiếu.`,
        409
      );
    }
    if (e.code === "P2025") {
      return apiError(`Không tìm thấy ${entityLabel}.`, 404);
    }
  }
  console.error("[api] Lỗi không xác định:", e);
  return apiError("Đã có lỗi xảy ra phía máy chủ.", 500);
}
