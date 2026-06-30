import { z } from "zod";
import {
  GenderSchema,
  RoleSchema,
  StudentStatusSchema,
} from "@/lib/enums";

// ───────────────────────────── Khoa (Faculty) ─────────────────────────────
export const facultySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập mã khoa" })
    .max(50, { message: "Mã khoa quá dài" }),
  name: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập tên khoa" })
    .max(200, { message: "Tên khoa quá dài" }),
});
export type FacultyInput = z.infer<typeof facultySchema>;

// ───────────────────────────── Khóa học (Cohort) ─────────────────────────────
const yearRange = z
  .object({
    startYear: z.coerce
      .number()
      .int()
      .min(2000, { message: "Năm bắt đầu không hợp lệ" })
      .max(2100, { message: "Năm bắt đầu không hợp lệ" }),
    endYear: z.coerce
      .number()
      .int()
      .min(2000, { message: "Năm kết thúc không hợp lệ" })
      .max(2100, { message: "Năm kết thúc không hợp lệ" }),
  })
  .refine((d) => d.endYear >= d.startYear, {
    message: "Năm kết thúc phải ≥ năm bắt đầu",
    path: ["endYear"],
  });

export const cohortSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Vui lòng nhập tên khóa" })
      .max(50, { message: "Tên khóa quá dài" }),
  })
  .and(yearRange);
export type CohortInput = z.infer<typeof cohortSchema>;

// ───────────────────────────── Năm học (AcademicYear) ─────────────────────────────
export const academicYearSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Vui lòng nhập tên năm học" })
      .max(50, { message: "Tên năm học quá dài" }),
  })
  .and(yearRange);
export type AcademicYearInput = z.infer<typeof academicYearSchema>;

// ───────────────────────────── Lớp (Class) ─────────────────────────────
export const classSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập mã lớp" })
    .max(50, { message: "Mã lớp quá dài" }),
  name: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập tên lớp" })
    .max(200, { message: "Tên lớp quá dài" }),
  facultyId: z.string().min(1, { message: "Vui lòng chọn khoa" }),
  cohortId: z.string().min(1, { message: "Vui lòng chọn khóa học" }),
  // Bắt buộc gán CVHT (mục 5.3 PRD).
  advisorId: z.string().min(1, { message: "Vui lòng chọn cố vấn học tập" }),
});
export type ClassInput = z.infer<typeof classSchema>;

// ───────────────────────────── Sinh viên (Student) ─────────────────────────────
export const studentSchema = z.object({
  // MSSV: 3 số + 3 chữ HOA + 3 số (vd 221CTT006).
  studentCode: z
    .string()
    .trim()
    .regex(/^[0-9]{3}[A-Z]{3}[0-9]{3}$/, {
      message: "MSSV phải có dạng 3 số + 3 chữ HOA + 3 số (vd 221CTT006)",
    }),
  // CCCD: đúng 12 chữ số.
  citizenId: z
    .string()
    .trim()
    .regex(/^[0-9]{12}$/, { message: "CCCD phải gồm đúng 12 chữ số" }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập họ tên" })
    .max(100, { message: "Họ tên quá dài" }),
  // Giới tính không bắt buộc: "" = chưa chọn (sẽ lưu null).
  gender: GenderSchema.or(z.literal("")).optional(),
  // Ngày sinh dạng chuỗi yyyy-mm-dd (từ input type=date) hoặc rỗng.
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Ngày sinh không hợp lệ" })
    .optional()
    .or(z.literal("")),
  classId: z.string().min(1, { message: "Vui lòng chọn lớp" }),
  status: StudentStatusSchema.default("ACTIVE"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type StudentInput = z.infer<typeof studentSchema>;

// ───────────────────────────── Người dùng (User) ─────────────────────────────
const userBase = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: "Tên đăng nhập tối thiểu 3 ký tự" })
    .max(50, { message: "Tên đăng nhập quá dài" })
    .regex(/^[a-zA-Z0-9_.]+$/, {
      message: "Tên đăng nhập chỉ gồm chữ, số, dấu _ và .",
    }),
  fullName: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập họ tên" })
    .max(100),
  email: z
    .string()
    .trim()
    .email({ message: "Email không hợp lệ" })
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role: RoleSchema,
  facultyId: z.string().nullish(),
  isActive: z.boolean().default(true),
});

// Tạo mới: bắt buộc có mật khẩu.
export const createUserSchema = userBase.extend({
  password: z
    .string()
    .min(6, { message: "Mật khẩu tối thiểu 6 ký tự" })
    .max(72, { message: "Mật khẩu quá dài" }),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// Cập nhật: mật khẩu để trống = giữ nguyên.
export const updateUserSchema = userBase.extend({
  password: z
    .string()
    .min(6, { message: "Mật khẩu tối thiểu 6 ký tự" })
    .max(72, { message: "Mật khẩu quá dài" })
    .optional()
    .or(z.literal("")),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ───────────────────────────── Học kỳ — khóa/mở ─────────────────────────────
export const lockSemesterSchema = z.object({
  isLocked: z.boolean(),
});
