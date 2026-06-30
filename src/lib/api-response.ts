import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Định dạng response API thống nhất: { data, error }.
 * - Thành công: { data: <payload>, error: null }
 * - Thất bại:   { data: null, error: "<thông báo tiếng Việt>" }
 */
export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message }, { status });
}

/** Trả response 422 với thông báo lỗi validation Zod đầu tiên (tiếng Việt). */
export function apiValidationError(error: ZodError) {
  return apiError(error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", 422);
}
