import { Prisma } from "@prisma/client";
import { apiError } from "@/lib/api-response";

/**
 * Chuyển lỗi Prisma thành response { error } với thông báo tiếng Việt thân thiện.
 * - P2002: trùng giá trị unique.
 * - P2003/P2014: vi phạm khóa ngoại (thường khi xóa bản ghi còn được tham chiếu).
 * - P2025: không tìm thấy bản ghi.
 */
export function handleMutationError(e: unknown, entityLabel: string) {
  if (isDbUnreachable(e)) {
    return apiError(
      "Không kết nối được cơ sở dữ liệu (Supabase có thể đang tạm dừng). Vui lòng thử lại sau ít giây.",
      503
    );
  }
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

/** Lỗi không kết nối được DB (Supabase tạm dừng, mạng…): P1001/P1002/P1008/P1017. */
export function isDbUnreachable(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    ["P1001", "P1002", "P1008", "P1017"].includes(e.code)
  );
}

/**
 * Trả response thân thiện cho lỗi thao tác DB đọc (không phải mutation unique):
 * - DB không kết nối được → 503 kèm gợi ý thử lại.
 * - Còn lại → 500 chung.
 */
export function dbError(e: unknown) {
  if (isDbUnreachable(e)) {
    return apiError(
      "Không kết nối được cơ sở dữ liệu (Supabase có thể đang tạm dừng). Vui lòng thử lại sau ít giây.",
      503
    );
  }
  console.error("[api] Lỗi DB:", e);
  return apiError("Đã có lỗi xảy ra phía máy chủ.", 500);
}
