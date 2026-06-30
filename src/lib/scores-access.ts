import type { Session } from "next-auth";
import { prisma } from "@/lib/db";

/**
 * Quyền truy cập điểm theo lớp (mục 6.4 PRD):
 * - ADMIN: xem + sửa mọi lớp.
 * - CVHT: chỉ lớp mình phụ trách (advisorId = mình) — xem + sửa.
 * - TRUONG_KHOA: chỉ lớp trong khoa mình — CHỈ XEM (không sửa).
 */
export type ClassPermission = {
  klass: { id: string; facultyId: string; advisorId: string } | null;
  canView: boolean;
  canMutate: boolean;
};

export async function getClassPermission(
  session: Session,
  classId: string
): Promise<ClassPermission> {
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, facultyId: true, advisorId: true },
  });
  if (!klass) return { klass: null, canView: false, canMutate: false };

  const { role, id: userId, facultyId } = session.user;
  const isAdmin = role === "ADMIN";
  const isOwnerCvht = role === "CVHT" && klass.advisorId === userId;
  const isFacultyHead =
    role === "TRUONG_KHOA" && !!facultyId && klass.facultyId === facultyId;

  return {
    klass,
    canView: isAdmin || isOwnerCvht || isFacultyHead,
    canMutate: isAdmin || isOwnerCvht,
  };
}

/** Danh sách lớp người dùng hiện tại được XEM (cho dropdown trang /scores). */
export async function getViewableClasses(session: Session) {
  const { role, id: userId, facultyId } = session.user;
  const where =
    role === "ADMIN"
      ? {}
      : role === "CVHT"
        ? { advisorId: userId }
        : { facultyId: facultyId ?? "__none__" }; // TRUONG_KHOA

  return prisma.class.findMany({
    where,
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      faculty: { select: { name: true } },
    },
  });
}
