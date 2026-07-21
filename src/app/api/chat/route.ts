import { z } from "zod";

import { apiOk, apiError, apiValidationError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { features } from "@/lib/features";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildChatDataContext } from "@/lib/chat-data";
import {
  askChatAssistant,
  type ChatHistoryItem,
} from "@/lib/chat-assistant";

// Đọc env lúc chạy để flag có hiệu lực ngay sau khi đổi .env + restart.
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập nội dung câu hỏi.")
    .max(1000, "Nội dung tối đa 1.000 ký tự."),
});

// Số tin nhắn gần nhất đính kèm làm ngữ cảnh ngắn hạn (mục 5.11 PRD).
const HISTORY_LIMIT = 30;

/**
 * POST /api/chat — Chatbox trợ lý (mục 5.11).
 * Nhận { message }, trả { answer, links }. Read-only: không ghi dữ liệu nghiệp vụ,
 * chỉ lưu lịch sử hội thoại của chính user + audit log ở mức metadata.
 */
export async function POST(req: Request) {
  if (!features.chatbox) {
    return apiError("Chatbox đang tắt.", 403);
  }
  const g = await requireRole(["ADMIN", "CVHT", "TRUONG_KHOA"]);
  if (g.error) return g.error;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { message } = parsed.data;

  const userId = g.session.user.id;

  // Lịch sử ngắn hạn (chỉ USER/ASSISTANT) theo thứ tự thời gian.
  const recent = await prisma.chatMessage.findMany({
    where: { userId, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  const history: ChatHistoryItem[] = recent
    .reverse()
    .map((m) => ({ role: m.role as "USER" | "ASSISTANT", content: m.content }));

  // Ngữ cảnh dữ liệu đã lọc theo quyền (mục 6.4 + 6.6).
  const dataContext = await buildChatDataContext(g.session, message);

  let result;
  try {
    result = await askChatAssistant({
      message,
      history,
      dataContext: dataContext.text,
    });
  } catch (e) {
    return apiError(
      `Không thể kết nối AI, vui lòng thử lại sau. (${(e as Error).message})`,
      502
    );
  }

  // Lưu lượt hỏi + trả lời của chính user (dữ liệu cá nhân).
  await prisma.chatMessage.createMany({
    data: [
      { userId, role: "USER", content: message },
      {
        userId,
        role: "ASSISTANT",
        content: result.answer,
        metadata:
          result.links.length > 0
            ? JSON.stringify({ links: result.links })
            : null,
      },
    ],
  });

  // Audit chỉ metadata — KHÔNG log nguyên văn câu hỏi/câu trả lời (mục 5.11).
  await writeAudit({
    userId,
    action: "CHATBOX_ASK",
    entityType: "Chatbox",
    newValue: {
      messageLength: message.length,
      usedDataScope: dataContext.scope,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash",
    },
    req,
  });

  return apiOk({ answer: result.answer, links: result.links });
}
