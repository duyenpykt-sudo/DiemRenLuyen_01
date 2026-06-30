import type { Prisma } from "@prisma/client";
import type { StudentInput } from "@/lib/validations/catalog";

/** Chuẩn hóa input form sinh viên thành dữ liệu Prisma (xử lý dob/gender/note rỗng). */
export function toStudentData(
  input: StudentInput
): Prisma.StudentUncheckedCreateInput {
  return {
    studentCode: input.studentCode,
    citizenId: input.citizenId,
    fullName: input.fullName,
    classId: input.classId,
    status: input.status,
    gender: input.gender || null,
    dob: input.dob ? new Date(`${input.dob}T00:00:00.000Z`) : null,
    note: input.note || null,
  };
}

/** Các trường an toàn của User để trả về client (KHÔNG bao giờ lộ passwordHash). */
export const userSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  facultyId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  faculty: { select: { id: true, name: true } },
} as const;
