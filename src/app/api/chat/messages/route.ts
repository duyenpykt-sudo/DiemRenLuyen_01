import { apiOk, apiError } from "@/lib/api-response";
import { requireRole } from "@/lib/guard";
import { features } from "@/lib/features";
import { prisma } from "@/lib/db";
import type { ChatLink } from "@/lib/chat-assistant";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 30;
const ALL_ROLES = ["ADMIN", "CVHT", "TRUONG_KHOA"] as const;

export type ChatMessageDTO = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  links: ChatLink[];
  createdAt: string;
};

/**
 * GET /api/chat/messages — lấy tối đa 30 tin gần nhất của user hiện tại
 * (theo thứ tự thời gian tăng dần để hiển thị). Mục 5.11 PRD.
 */
export async function GET() {
  if (!features.chatbox) return apiError("Chatbox đang tắt.", 403);
  const g = await requireRole([...ALL_ROLES]);
  if (g.error) return g.error;

  const rows = await prisma.chatMessage.findMany({
    where: { userId: g.session.user.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, role: true, content: true, metadata: true, createdAt: true },
  });

  const messages: ChatMessageDTO[] = rows.reverse().map((m) => {
    let links: ChatLink[] = [];
    if (m.metadata) {
      try {
        const parsed = JSON.parse(m.metadata);
        if (Array.isArray(parsed?.links)) links = parsed.links;
      } catch {
        // metadata hỏng → bỏ qua link
      }
    }
    return {
      id: m.id,
      role: m.role as "USER" | "ASSISTANT",
      content: m.content,
      links,
      createdAt: m.createdAt.toISOString(),
    };
  });

  return apiOk({ messages });
}

/**
 * DELETE /api/chat/messages — xoá toàn bộ lịch sử chat của chính user (mục 5.11).
 */
export async function DELETE() {
  if (!features.chatbox) return apiError("Chatbox đang tắt.", 403);
  const g = await requireRole([...ALL_ROLES]);
  if (g.error) return g.error;

  await prisma.chatMessage.deleteMany({ where: { userId: g.session.user.id } });
  return apiOk({ success: true });
}
