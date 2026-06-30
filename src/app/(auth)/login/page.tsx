import { GraduationCap, BarChart3, ShieldCheck, FileSpreadsheet } from "lucide-react";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Cột thương hiệu — ẩn trên mobile */}
      <div className="bg-gradient-brand relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {/* Vệt sáng trang trí */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-lg font-bold tracking-tight">Điểm Rèn luyện</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Quản lý điểm rèn luyện
            <br />
            nhanh, gọn, chính xác.
          </h1>
          <p className="max-w-md text-white/80">
            Hệ thống dành cho Cố vấn học tập và Trưởng khoa — Khoa KHTN và CNTT,
            Trường Đại học Phú Yên.
          </p>
          <ul className="space-y-3 text-sm text-white/90">
            <li className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 shrink-0 text-white/80" />
              Thống kê &amp; biểu đồ phân bố xếp loại trực quan
            </li>
            <li className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-white/80" />
              Xuất Excel đúng mẫu của trường chỉ với một cú nhấp
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-white/80" />
              Phân quyền chặt chẽ theo vai trò &amp; nhật ký thao tác
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} Trường Đại học Phú Yên
        </p>
      </div>

      {/* Cột form đăng nhập */}
      <div className="flex items-center justify-center p-4 sm:p-8">
        <LoginForm />
      </div>
    </main>
  );
}
