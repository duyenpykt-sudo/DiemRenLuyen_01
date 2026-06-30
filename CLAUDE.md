# CLAUDE.md — Hướng dẫn cho Claude Code

> **File này Claude Code đọc TRƯỚC tiên khi mở project. Hãy đọc kỹ trước khi code.**

---

## 🎯 Project

Ứng dụng web **Quản lý Điểm Rèn luyện Sinh viên** cho Trường Đại học Phú Yên, Khoa KHTN và CNTT. Phục vụ Cố vấn học tập (CVHT) và Trưởng khoa quản lý điểm rèn luyện theo học kỳ, năm học, toàn khóa. Chạy local trên máy CVHT.

---

## 📚 Tài liệu phải đọc (thứ tự ưu tiên)

1. **`./PRD-DiemRenLuyen.md`** — Yêu cầu sản phẩm chi tiết. **PHẢI ĐỌC TOÀN BỘ** trước khi bắt đầu mỗi tuần. Là nguồn sự thật duy nhất khi có xung đột.
2. **`./docs/CLAUDE-CODE-PROMPTS.md`** — Prompt cụ thể theo từng tuần Roadmap. Người dùng sẽ dán từng đoạn.
3. **`./docs/README-Quick-Start.md`** — Checklist + tham chiếu nhanh cho người dùng.
4. **`./sample/DC22CTT01-II-25-26.xls`** — File Excel mẫu của trường, dùng để:
   - CLI seed dữ liệu lần đầu (Tuần 3).
   - Đối chiếu format khi Export Excel (Tuần 4).

---

## ⚙️ Tech Stack (đã chốt — không tự thay đổi)

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript strict |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Form & Validation | react-hook-form + Zod |
| Server state | TanStack Query |
| ORM | Prisma 5 |
| DB | SQLite (`prisma/dev.db`) |
| Auth | next-auth v5 (Credentials) + bcryptjs |
| Excel I/O | exceljs (chính) + xlsx (đọc file `.xls` cũ) |
| Charts | recharts |
| Notification | sonner |
| Test | vitest + playwright |

---

## 🔑 Quy ước code (BẮT BUỘC)

- **TypeScript strict mode**: bật `strict: true` trong `tsconfig.json`. Không dùng `any` trừ trường hợp cực kỳ cần.
- **Mọi text UI bằng tiếng Việt**: button, label, message, error.
- **Mọi API route validate input bằng Zod**: tạo schema riêng cho mỗi endpoint, không bypass.
- **Mọi mutation ghi audit log**: dùng helper `lib/audit.ts` (sẽ tạo Tuần 3).
- **Server-side recompute mọi giá trị quan trọng**: không tin client (vd: xếp loại từ điểm).
- **Comment tiếng Việt** cho function nghiệp vụ (`classifyScore`, `getYearScore`…).
- **Prisma migration tên kebab-case**: vd `add-conduct-score`, `lock-semester-field`.
- **Đường dẫn import**: dùng alias `@/...` (cấu hình trong `tsconfig.json`).
- **Component shadcn**: chạy `npx shadcn-ui@latest add <name>`, không tự copy code.

---

## 🔒 Quy tắc bảo mật (BẮT BUỘC)

- Password hash bằng `bcryptjs` 10 rounds.
- Phiên đăng nhập dùng HttpOnly cookie qua next-auth.
- Mọi API route check session + role trước khi xử lý.
- **Row-level access** (mục 6.4 PRD):
  - `CVHT`: chỉ thấy/sửa scores thuộc lớp có `advisorId = currentUser.id`.
  - `TRUONG_KHOA`: chỉ ĐỌC trong khoa mình (`facultyId`), không POST/PATCH/DELETE.
  - `ADMIN`: full access.
- Trưởng khoa gọi `POST/PATCH/DELETE /api/scores` → trả **403**.

---

## 🚩 Feature flag

Biến môi trường trong `.env`:

```
IMPORT_EXCEL_ENABLED=false   # mặc định: ẨN nút Import Excel
```

Khi `false`:
- Component `<ImportExcelButton />` render `null`.
- API `/api/import/excel/*` trả **403** ngay từ đầu hàm handler.

Khi `true`:
- Nút hiện trên `/scores`.
- API hoạt động bình thường.

API helper: `GET /api/config/features` → `{ importExcelEnabled: boolean }` (public, không cần auth) để client check.

---

## 📐 Quy tắc nghiệp vụ tóm tắt

### Xếp loại từ điểm:
```typescript
SUSPENDED → KHONG_XEP_LOAI
score >= 90 → XUAT_SAC
score >= 80 → TOT
score >= 65 → KHA
score >= 50 → TRUNG_BINH
score >= 35 → YEU
score <  35 → KEM
```

### Tính điểm:
- **Điểm năm** = `Math.round((HKI + HKII) / 2)`. Thiếu 1 HK → hiển thị "—".
- **Điểm toàn khóa** = `Math.round(sum / count)` các HK có điểm. < 8 HK → flag "chưa đủ".

### Validation:
- MSSV: regex `^[0-9]{3}[A-Z]{3}[0-9]{3}$` (vd `221CTT006`).
- CCCD: đúng 12 chữ số.
- Điểm: integer 0–100.
- UNIQUE(studentId, semesterId).

---

## 🗓️ Workflow

Người dùng đi theo Roadmap 6 tuần (mục 13 PRD). Mỗi tuần họ sẽ dán 1 prompt từ `./docs/CLAUDE-CODE-PROMPTS.md`. Khi nhận prompt mới:

1. Mở `./PRD-DiemRenLuyen.md` đọc mục tương ứng trước.
2. Confirm hiểu yêu cầu với người dùng nếu có điểm mơ hồ.
3. Code theo đúng specs, không sáng tạo thêm tính năng.
4. Sau khi xong: chạy thử, screenshot, mô tả những gì đã làm.
5. Đề xuất commit message: `feat: Tuần N — <tóm tắt>`.

---

## ❗ Các sai lầm cần tránh

- ❌ Không đọc PRD trước khi code — sẽ làm thiếu hoặc sai.
- ❌ Không thêm field vào Prisma schema ngoài specs mục 4 — gây drift.
- ❌ Không tự đổi quy tắc xếp loại — số ngưỡng đã được chốt.
- ❌ Không bỏ qua audit log cho mutation — yêu cầu nghiệp vụ.
- ❌ Không bỏ qua check role trong API — gây lỗ hổng bảo mật.
- ❌ Không "đẹp hóa" file Excel export — phải khớp 1:1 với file mẫu.
- ❌ Không tin client tính classification — luôn recompute server-side.

---

## 🆘 Khi gặp khó khăn

- Specs mơ hồ → **hỏi người dùng**, đừng đoán.
- Export Excel không khớp mẫu → mở file mẫu bằng exceljs, log từng cell, so sánh.
- Cấu trúc DB không hợp lý cho 1 query → **không tự đổi schema**, hỏi trước.
- Thư viện không chạy → kiểm tra version Node, chỉ install package có trong allowlist hoặc đã đề xuất.

---

## 📞 Tài khoản & dữ liệu seed mặc định

| User | Username | Password | Role |
|---|---|---|---|
| Admin | `admin` | `Admin@123` | ADMIN |
| CVHT | `hothiduyen` | `Cvht@123` | CVHT |
| Trưởng khoa | `truongkhoa` | `Tk@123` | TRUONG_KHOA |

Yêu cầu đổi password ngay lần đầu đăng nhập (sau Tuần 1).
