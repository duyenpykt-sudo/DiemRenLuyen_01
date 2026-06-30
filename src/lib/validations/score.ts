import { z } from "zod";

const scoreValue = z.coerce
  .number({ invalid_type_error: "Điểm phải là số" })
  .int({ message: "Điểm phải là số nguyên" })
  .min(0, { message: "Điểm tối thiểu là 0" })
  .max(100, { message: "Điểm tối đa là 100" });

const note = z.string().trim().max(500).optional().or(z.literal(""));

// Tạo điểm mới (Mode A — Dialog).
export const scoreCreateSchema = z.object({
  studentId: z.string().min(1, { message: "Vui lòng chọn sinh viên" }),
  semesterId: z.string().min(1, { message: "Thiếu học kỳ" }),
  score: scoreValue,
  note,
});
export type ScoreCreateInput = z.infer<typeof scoreCreateSchema>;

// Cập nhật 1 điểm.
export const scoreUpdateSchema = z.object({
  score: scoreValue,
  note,
});
export type ScoreUpdateInput = z.infer<typeof scoreUpdateSchema>;

// Lưu hàng loạt (Mode B — bảng inline).
export const scoreBatchSchema = z.object({
  classId: z.string().min(1),
  semesterId: z.string().min(1),
  items: z
    .array(
      z.object({
        studentId: z.string().min(1),
        score: scoreValue,
        note,
      })
    )
    .min(1, { message: "Không có dòng nào để lưu" }),
});
export type ScoreBatchInput = z.infer<typeof scoreBatchSchema>;
