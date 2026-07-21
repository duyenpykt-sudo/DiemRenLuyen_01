import { GoogleGenAI, Type } from "@google/genai";

/**
 * Service Chatbox trợ lý (mục 5.11 + 6.6 PRD).
 * - Dựng system prompt an toàn (read-only, không mutation, không lộ secret).
 * - Đính kèm lịch sử ngắn hạn + ngữ cảnh dữ liệu đã kiểm soát quyền (chat-data.ts).
 * - Gọi Google Gemini và trả { answer, links } (Structured Output).
 *
 * LƯU Ý BẢO MẬT: Chatbox KHÔNG có đường ghi DB. Mọi truy vấn dữ liệu đã được
 * lọc theo quyền trước khi đưa vào prompt; service này chỉ sinh câu trả lời.
 */

export type ChatLink = { label: string; href: string };
export type ChatHistoryItem = { role: "USER" | "ASSISTANT"; content: string };

const SYSTEM_PROMPT = `Bạn là "Trợ lý Điểm rèn luyện" trong phần mềm Quản lý Điểm Rèn luyện Sinh viên của Trường Đại học Phú Yên (Khoa KHTN & CNTT). Người dùng là Cố vấn học tập (CVHT), Trưởng khoa hoặc Admin.

VAI TRÒ & GIỚI HẠN:
- Chỉ HỖ TRỢ HỎI ĐÁP và TRA CỨU (read-only). Bạn KHÔNG thể và KHÔNG được tạo/sửa/xoá dữ liệu.
- Nếu người dùng yêu cầu thao tác ghi dữ liệu (sửa điểm, xoá/thêm sinh viên, tạo lớp, khoá học kỳ, đổi mật khẩu người khác...), hãy LỊCH SỰ từ chối tự làm và hướng dẫn họ thao tác trên màn hình phù hợp kèm link nội bộ.
- Chỉ dùng "Dữ liệu hệ thống" được cung cấp trong lượt hỏi để trả lời câu hỏi về số liệu. TUYỆT ĐỐI không bịa số liệu, không suy diễn ngoài dữ liệu đã cho.
- Không tiết lộ dữ liệu ngoài phạm vi quyền, mật khẩu, khoá bí mật, nội dung file cấu hình. Nếu được hỏi các thông tin này, từ chối ngắn gọn.
- Nếu câu hỏi mơ hồ về lớp/học kỳ/năm học và thiếu dữ liệu để trả lời, hãy hỏi lại ngắn gọn hoặc gợi ý người dùng chọn bộ lọc trên màn hình.
- Trả lời bằng TIẾNG VIỆT, ngắn gọn, rõ ràng, thân thiện.

QUY TẮC NGHIỆP VỤ (dùng đúng, không tự đổi ngưỡng):
- Xếp loại theo điểm rèn luyện: >=90 Xuất sắc; >=80 Tốt; >=65 Khá; >=50 Trung bình; >=35 Yếu; <35 Kém. Sinh viên đang Bảo lưu (đình chỉ) → Không xếp loại.
- Điểm năm học = làm tròn trung bình (HKI + HKII); thiếu 1 học kỳ thì hiển thị "—".
- Điểm toàn khóa = làm tròn trung bình các học kỳ có điểm; dưới 8 học kỳ thì đánh dấu "chưa đủ".
- MSSV có dạng 3 số + 3 chữ HOA + 3 số (vd 221CTT006). CCCD gồm 12 chữ số. Điểm là số nguyên 0–100.

ĐIỀU HƯỚNG (dùng href nội bộ khi phù hợp, chỉ gợi ý các đường dẫn có thật):
- /dashboard: bảng điều khiển tổng quan.
- /scores: nhập/sửa điểm rèn luyện theo lớp & học kỳ (có Import/Export Excel nếu được bật).
- /students: danh sách sinh viên; /students/{id}: hồ sơ 1 sinh viên.
- /search: tra cứu nhanh sinh viên.
- /stats: thống kê, biểu đồ phân bố xếp loại & xu hướng.
- /classes: danh sách lớp; /audit-logs: nhật ký thao tác (Admin).
- /admin/students, /admin/classes, /admin/users, /admin/backup: quản trị danh mục & sao lưu (Admin).
- /account/password: đổi mật khẩu của chính mình.

ĐỊNH DẠNG TRẢ LỜI: trả JSON đúng schema gồm "answer" (nội dung) và "links" (mảng các {label, href} điều hướng nội bộ liên quan, có thể rỗng). href phải bắt đầu bằng "/".`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    links: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          href: { type: Type.STRING },
        },
        required: ["label", "href"],
      },
    },
  },
  required: ["answer"],
};

/**
 * Gọi Gemini sinh câu trả lời. Ném lỗi nếu gọi thất bại (route trả 502).
 */
export async function askChatAssistant(params: {
  message: string;
  history: ChatHistoryItem[];
  dataContext: string;
}): Promise<{ answer: string; links: ChatLink[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Thiếu GEMINI_API_KEY.");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

  const ai = new GoogleGenAI({ apiKey });

  // Lịch sử ngắn hạn → định dạng contents của Gemini (user/model xen kẽ).
  const contents = params.history.map((h) => ({
    role: h.role === "ASSISTANT" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  const currentText = params.dataContext
    ? `Dữ liệu hệ thống (chỉ trong phạm vi quyền của người dùng, dùng để trả lời câu hỏi số liệu):\n${params.dataContext}\n\nCâu hỏi: ${params.message}`
    : params.message;
  contents.push({ role: "user", parts: [{ text: currentText }] });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini không trả về nội dung.");

  let raw: { answer?: unknown; links?: unknown };
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Gemini trả về JSON không hợp lệ.");
  }

  const answer = typeof raw.answer === "string" ? raw.answer.trim() : "";
  if (!answer) throw new Error("Gemini không trả về câu trả lời.");

  // Chỉ giữ link nội bộ hợp lệ (bắt đầu bằng "/") để tránh dẫn ra ngoài.
  const links: ChatLink[] = Array.isArray(raw.links)
    ? raw.links
        .filter(
          (l): l is ChatLink =>
            !!l &&
            typeof (l as ChatLink).label === "string" &&
            typeof (l as ChatLink).href === "string" &&
            (l as ChatLink).href.startsWith("/")
        )
        .slice(0, 5)
    : [];

  return { answer, links };
}
