import { z } from "zod";

/**
 * Các "enum" của hệ thống.
 *
 * SQLite (DB đã chốt) không hỗ trợ native enum trong Prisma, nên trong
 * schema.prisma các cột này là String. Ở tầng ứng dụng ta dùng const object
 * + union type + Zod schema để đảm bảo type-safety và validate giá trị hợp lệ
 * ở cả client lẫn server (thay thế hoàn toàn cho native enum).
 */

// ───────────────────────────── Role ─────────────────────────────
export const Role = {
  ADMIN: "ADMIN",
  CVHT: "CVHT",
  TRUONG_KHOA: "TRUONG_KHOA",
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const RoleSchema = z.enum(["ADMIN", "CVHT", "TRUONG_KHOA"]);

// ──────────────────────────── Gender ────────────────────────────
export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const GenderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

// ─────────────────────────── StudentStatus ───────────────────────────
export const StudentStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  GRADUATED: "GRADUATED",
  DROPPED: "DROPPED",
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];
export const StudentStatusSchema = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "GRADUATED",
  "DROPPED",
]);

// ─────────────────────────── Classification ───────────────────────────
export const Classification = {
  XUAT_SAC: "XUAT_SAC",
  TOT: "TOT",
  KHA: "KHA",
  TRUNG_BINH: "TRUNG_BINH",
  YEU: "YEU",
  KEM: "KEM",
  KHONG_XEP_LOAI: "KHONG_XEP_LOAI",
} as const;
export type Classification =
  (typeof Classification)[keyof typeof Classification];
export const ClassificationSchema = z.enum([
  "XUAT_SAC",
  "TOT",
  "KHA",
  "TRUNG_BINH",
  "YEU",
  "KEM",
  "KHONG_XEP_LOAI",
]);
