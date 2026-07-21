import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { getViewableClasses } from "@/lib/scores-access";
import { CLASSIFICATION_LABEL } from "@/lib/classification";
import type { Classification } from "@/lib/enums";

/**
 * Helper đọc dữ liệu READ-ONLY, đã áp dụng row-level access (mục 6.4 + 6.6 PRD)
 * để dựng "ngữ cảnh dữ liệu" tối thiểu đưa vào prompt Chatbox.
 *
 * NGUYÊN TẮC:
 * - Chỉ trả dữ liệu trong phạm vi quyền của user (CVHT: lớp mình; Trưởng khoa:
 *   khoa mình; Admin: tất cả) — dùng chung getViewableClasses.
 * - KHÔNG bao giờ đưa passwordHash, secret, hay dữ liệu ngoài phạm vi vào context.
 * - Chỉ lấy dữ liệu tối thiểu cần thiết (tránh gửi cả DB tới Gemini).
 */

const STUDENT_CODE_RE = /\b[0-9]{3}[A-Z]{3}[0-9]{3}\b/g;
const MAX_CLASSES_IN_CONTEXT = 40;
const MAX_STUDENTS_LOOKUP = 3;

export type ChatDataContext = {
  /** Mô tả ngắn phạm vi dữ liệu đã dùng — ghi vào audit (usedDataScope). */
  scope: string;
  /** Chuỗi ngữ cảnh (tiếng Việt) chèn vào prompt. Rỗng nếu không có dữ liệu. */
  text: string;
};

/** Ids của các lớp user được xem — để giới hạn mọi truy vấn khác trong phạm vi. */
async function viewableClassIds(session: Session): Promise<string[]> {
  const classes = await getViewableClasses(session);
  return classes.map((c) => c.id);
}

/**
 * Dựng ngữ cảnh dữ liệu cho một câu hỏi. Luôn kèm tóm tắt các lớp trong phạm vi;
 * nếu câu hỏi nhắc tới MSSV cụ thể (và thuộc phạm vi), kèm chi tiết điểm SV đó.
 */
export async function buildChatDataContext(
  session: Session,
  message: string
): Promise<ChatDataContext> {
  const classIds = await viewableClassIds(session);
  const parts: string[] = [];
  const scopeTags: string[] = [];

  // 1) Tóm tắt các lớp trong phạm vi (mã, tên, khoa, sĩ số).
  if (classIds.length > 0) {
    const classes = await prisma.class.findMany({
      where: { id: { in: classIds } },
      orderBy: { code: "asc" },
      take: MAX_CLASSES_IN_CONTEXT,
      select: {
        code: true,
        name: true,
        faculty: { select: { name: true } },
        _count: { select: { students: true } },
      },
    });
    const lines = classes.map(
      (c) =>
        `- ${c.code} (${c.name}) — Khoa ${c.faculty.name}, ${c._count.students} SV`
    );
    parts.push(`Các lớp trong phạm vi quyền của bạn:\n${lines.join("\n")}`);
    scopeTags.push(`classes:${classes.length}`);
  } else {
    parts.push("Bạn hiện không phụ trách/không có lớp nào trong phạm vi quyền.");
    scopeTags.push("classes:0");
  }

  // 2) Nếu câu hỏi có MSSV → tra cứu chi tiết (chỉ SV thuộc lớp trong phạm vi).
  const codes = [...new Set(message.toUpperCase().match(STUDENT_CODE_RE) ?? [])]
    .slice(0, MAX_STUDENTS_LOOKUP);
  if (codes.length > 0 && classIds.length > 0) {
    const students = await prisma.student.findMany({
      where: { studentCode: { in: codes }, classId: { in: classIds } },
      select: {
        studentCode: true,
        fullName: true,
        status: true,
        class: { select: { code: true } },
        conductScores: {
          orderBy: { semester: { academicYear: { startYear: "asc" } } },
          select: {
            score: true,
            classification: true,
            semester: {
              select: {
                number: true,
                academicYear: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    for (const s of students) {
      const scoreLines =
        s.conductScores.length > 0
          ? s.conductScores
              .map(
                (sc) =>
                  `    • ${sc.semester.academicYear.name} HK${sc.semester.number}: ${sc.score} điểm — ${CLASSIFICATION_LABEL[sc.classification as Classification]}`
              )
              .join("\n")
          : "    • Chưa có điểm rèn luyện.";
      parts.push(
        `Sinh viên ${s.studentCode} — ${s.fullName} (lớp ${s.class.code}):\n${scoreLines}`
      );
    }
    scopeTags.push(`students:${students.length}`);
    // MSSV được hỏi nhưng không thuộc phạm vi → báo cho model biết để từ chối.
    const foundCodes = new Set(students.map((s) => s.studentCode));
    const outOfScope = codes.filter((c) => !foundCodes.has(c));
    if (outOfScope.length > 0) {
      parts.push(
        `Lưu ý: các MSSV sau KHÔNG thuộc phạm vi quyền của bạn (không được tiết lộ dữ liệu): ${outOfScope.join(", ")}.`
      );
      scopeTags.push("outOfScope");
    }
  }

  return {
    scope: scopeTags.join(",") || "none",
    text: parts.join("\n\n"),
  };
}
