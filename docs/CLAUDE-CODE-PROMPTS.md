# Bộ Prompt cho Claude Code — Theo từng Tuần Roadmap (v1.4)

> **Cách dùng:** Mở Claude Code trong thư mục dự án, đặt file `PRD-DiemRenLuyen.md` ở root, rồi dán lần lượt từng prompt dưới đây.
>
> **Bổ sung v1.3:** 3 prompt làm rõ tính năng (Quản lý Năm học & Học kỳ, Nhập điểm theo Lớp × HK × Năm học, Import bảng tổng hợp HK theo lớp) nằm ở mục **"🆕 Bổ sung v1.3"** cuối file. Dán chúng nếu project đã build xong Tuần 2–4 và cần chỉnh cho khớp PRD v1.3.
>
> **Bổ sung v1.4:** prompt B4 — *AI nhận diện & chuẩn hoá file Excel import (Claude)* — nằm ở mục **"🆕 Bổ sung v1.4"** cuối file. Đứng sau flag `AI_IMPORT_ENABLED` + `ANTHROPIC_API_KEY`.

---

## 📌 Prompt khởi đầu (chạy 1 lần)

```
Đọc file PRD-DiemRenLuyen.md trong thư mục hiện tại. Tóm tắt cho tôi:
1. Mục tiêu chính của app
2. Tech stack đã chốt
3. Mô hình dữ liệu (số bảng, các quan hệ chính)
4. Các milestone tuần
5. Feature flag IMPORT_EXCEL_ENABLED dùng làm gì
Sau khi tóm tắt, đợi tôi xác nhận trước khi bắt đầu code.
```

---

## 🗓️ TUẦN 1 — Khởi tạo + Auth + Feature Flag

```
Bắt đầu Tuần 1 trong Roadmap (mục 13 của PRD v1.2).

Nhiệm vụ:
1. Khởi tạo project Next.js 14 (App Router) + TypeScript strict + Tailwind + ESLint.
2. Cài shadcn/ui (theme Slate, base color Neutral) + các component:
   button, input, label, card, table, dialog, alert-dialog, dropdown-menu, sidebar,
   sonner, toast, select, badge, avatar, tabs, combobox, skeleton.
3. Cài Prisma + SQLite + next-auth v5 (Credentials) + bcryptjs + Zod + react-hook-form
   + @tanstack/react-query.
4. Tạo prisma/schema.prisma EXACT theo mục 4 của PRD.
5. Chạy migration `init`.
6. Viết prisma/seed.ts tạo:
   - 1 Admin: username=admin, password=Admin@123
   - 1 Faculty: code="KHTN_CNTT", name="KHOA KHTN và CNTT"
   - 1 Cohort: name="K22", startYear=2022, endYear=2026
   - 4 AcademicYear: "2022-2023", "2023-2024", "2024-2025", "2025-2026", mỗi năm 2 Semester
   - 1 CVHT: username=hothiduyen, password=Cvht@123, fullName="Hồ Thị Duyên", faculty=KHTN_CNTT
   - 1 Trưởng khoa: username=truongkhoa, password=Tk@123
   - 1 Class: code="DC22CTT01", advisor=Hồ Thị Duyên
7. Layout: sidebar trái (lucide-react icons), topbar có user dropdown + theme toggle (next-themes), main content.
8. Trang /login: form username/password, validate Zod, gọi next-auth signIn, redirect /dashboard.
9. Trang /dashboard: 4 card thống kê (tổng SV, tổng lớp, tổng CVHT, tổng HK) bằng query Prisma.
10. **Feature flag system**:
    - Tạo file src/lib/features.ts với:
      `export const features = { importExcel: process.env.IMPORT_EXCEL_ENABLED === 'true' };`
    - Tạo API GET /api/config/features → trả `{ importExcelEnabled: boolean }` (public, không cần auth).
    - Tạo file .env.example với template (xem mục 11 PRD).
    - Trong README.md mô tả rõ cách bật/tắt flag.
11. Viết README.md hướng dẫn cài đặt từ đầu (Node 20+, clone → install → migrate → seed → run).

Quy ước code:
- TypeScript strict, mọi API route validate Zod.
- Mọi UI tiếng Việt.
- Comment tiếng Việt cho function nghiệp vụ.

Sau khi xong: chạy `npm run dev`, test login admin/Admin@123, screenshot trang login + dashboard.
```

---

## 🗓️ TUẦN 2 — Quản lý danh mục (CRUD)

```
Tiếp tục Tuần 2.

Chỉ Admin truy cập /admin/* (dùng middleware Next.js check role).

Tạo CRUD pages (mỗi page: list + filter + create dialog + edit dialog + delete confirm):

1. /admin/faculties — Khoa
2. /admin/cohorts — Khóa học
3. /admin/academic-years — Năm học (kèm tạo Semester con với nút "Khóa HK")
4. /admin/classes — Lớp (form có dropdown Faculty + Cohort + Advisor)
5. /admin/students — Sinh viên (form validate MSSV regex ^[0-9]{3}[A-Z]{3}[0-9]{3}$, CCCD 12 số)
6. /admin/users — Người dùng (role Admin/CVHT/Trưởng khoa, password bcrypt 10 rounds)

Yêu cầu:
- Mỗi page dùng TanStack Query (useQuery + useMutation) gọi API routes.
- API routes validate Zod, return chuẩn { data, error }.
- Bảng dùng shadcn Table + pagination 10/page + sort cột.
- Search box debounce 300ms.
- Toast (sonner) báo success/error.
- AlertDialog confirm cho delete.
- Mỗi mutation ghi audit log (CREATE/UPDATE/DELETE + entityType + old/new value).

Sau khi xong: tạo thử 1 record mỗi entity, screenshot /admin/students.
```

---

## 🗓️ TUẦN 3 — Nhập điểm (2 mode) + CLI seed + Audit log

```
Tiếp tục Tuần 3. Quan trọng: làm CẢ 2 MODE nhập điểm.

1. lib/classification.ts với classifyScore(score, studentStatus) theo mục 6.1 PRD.
   Viết unit test (vitest) đủ case biên: 0, 34, 35, 49, 50, 64, 65, 79, 80, 89, 90, 100, SUSPENDED.

2. Trang /scores (CVHT + Admin):
   - 2 dropdown filter top: Chọn Lớp (CVHT chỉ thấy lớp mình) + Chọn HK.
   - **Tabs chuyển 2 mode:**
     
     **Tab "Form Dialog"** (Mode A):
     - Bảng: STT | CCCD | MSSV | Họ tên | Điểm | Xếp loại | Ghi chú | Hành động
     - Nút "+ Thêm điểm" mở Dialog có combobox chọn SV (tìm theo MSSV/Họ tên),
       input điểm 0-100, ô xếp loại auto, input ghi chú, nút Lưu.
     - Nút "Sửa" mỗi dòng mở Dialog prefill.
     - Nút "Xóa" AlertDialog confirm.
     
     **Tab "Bảng inline"** (Mode B):
     - Bảng cùng cấu trúc nhưng cột Điểm + Ghi chú là editable cell.
     - Click cell → input mode; blur → save auto qua PATCH.
     - Xếp loại update real-time client-side khi điểm thay đổi.
     - Server-side recompute lại classification trước khi lưu.
     - Nút "Lưu tất cả" footer (batch save).
     - Progress bar khi đang lưu hàng loạt.

   - Nếu semester.isLocked=true: banner đỏ "HK đã chốt", ẩn nút thêm/sửa/xóa cả 2 tab.
   - Mọi mutation ghi audit log với oldValue/newValue (JSON.stringify).

3. CLI seed Excel — scripts/seed-excel.ts:
   - npm script: `"seed:excel": "tsx scripts/seed-excel.ts"`
   - Args: --file=<path>
   - Đọc 4 sheet HỌC KỲ, HỌC KỲ 2, NĂM HỌC, KHÓA HỌC từ file Excel.
   - Tạo Khoa/Lớp/Khóa/Năm học/HK/SV/Điểm. Idempotent (upsert).
   - In log số bản ghi created/updated/skipped.
   - Ghi audit log với user="SYSTEM_SEED".
   - Test: `npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls`
     → 14 SV + điểm 8 HK trong DB.

4. Trang /students/[id]:
   - Header avatar + info SV (CCCD, MSSV, lớp, status).
   - Tab "Điểm các HK": bảng các HK có điểm.
   - Tab "Biểu đồ tiến triển": LineChart (recharts) trục X = HK, Y = điểm.

5. Trang /audit-logs:
   - Bảng filter: user, action, entityType, khoảng ngày (date range picker).
   - CVHT chỉ thấy log của chính mình; Admin thấy all.
   - Click row → Dialog hiện oldValue/newValue dạng JSON pretty.

Bảo mật:
- API /api/scores/* check session.user.role + ownership (CVHT chỉ access scores
  thuộc lớp họ advise). Trưởng khoa POST/PATCH/DELETE → 403.

Sau khi xong: 
- Chạy CLI seed thành công.
- Login CVHT, nhập điểm bằng cả 2 mode, screenshot mỗi mode.
```

---

## 🗓️ TUẦN 4 — Export Excel + Import Excel (sau feature flag)

```
Tiếp tục Tuần 4. TUẦN KHÓ NHẤT. Đọc kỹ mục 5.5, 5.7, 7 PRD.

PHẦN A — Export Excel (PRIORITY CAO)

1. Cài exceljs.

2. Copy file DC22CTT01-II-25-26.xls vào public/sample/ và sample/.

3. Mở file mẫu bằng exceljs, đọc CHI TIẾT từng sheet (HỌC KỲ, HỌC KỲ 2, NĂM HỌC,
   KHÓA HỌC, TONG HOP-*). Document trong comment lib/excel-export.ts:
   - Vị trí merged cells.
   - Font, alignment, border của các cell quan trọng.

4. Tạo 4 template files trong templates/ (copy từ file mẫu, xóa data, giữ format):
   - mau-rl-hocky.xlsx
   - mau-rl-namhoc.xlsx
   - mau-rl-khoahoc.xlsx
   - mau-tonghop-khoa.xlsx (3 sheet TONG HOP-*)

5. lib/excel-export.ts với 4 function:
   - exportClassSemester(classId, semesterId)
   - exportClassYear(classId, academicYearId)
   - exportClassCohort(classId)
   - exportFacultySummary(facultyId, scope: "HK"|"NH"|"TK")

6. Mỗi function: load template → ghi data đúng cell → tính sẵn % thống kê → save buffer.

7. API GET /api/export/excel?type=...&classId=...&semesterId=... → trả file.

8. UI:
   - Nút "Xuất Excel HK" trên /scores.
   - Nút "Xuất Năm học" trên chi tiết lớp tab Năm.
   - Nút "Xuất Khóa học" trên chi tiết lớp tab Khóa.
   - Trang /stats có nút "Xuất Tổng hợp Khoa" cho Trưởng khoa (3 sheet).

9. Ghi audit log EXPORT_EXCEL với metadata.

KIỂM TRA BẮT BUỘC PHẦN A:
- Export file HỌC KỲ cho lớp DC22CTT01 → so cell-by-cell với file mẫu.
- Kiểm tra: dòng tiêu đề, merged cells, font, border, block THỐNG KÊ, dòng ngày, 3 chữ ký.
- Lệch chỗ nào → fix cho khớp.

----------

PHẦN B — Import Excel (SAU FEATURE FLAG, PRIORITY THẤP HƠN)

1. lib/excel-import.ts với parseHocKySheet(filePath, sheetName):
   - Skip dòng 1-6, header dòng 7, data từ dòng 8.
   - Dừng khi gặp "THỐNG KÊ:" hoặc 3 dòng trống.
   - Trả array { stt, cccd, maSV, hoTen, diem, xepLoai, ghiChu }.

2. API POST /api/import/excel/preview (multipart):
   - **ĐẦU TIÊN check feature flag features.importExcel — nếu false return 403.**
   - Body: { classId, semesterId, file }.
   - Parse file → đối chiếu SV theo maSV (fallback cccd).
   - Return preview JSON: [{ row, matched, student?, score, action, error? }].

3. API POST /api/import/excel/commit:
   - **Check flag tương tự.**
   - Ghi DB.
   - Ghi audit log IMPORT_EXCEL với { filename, rowsTotal, rowsSuccess, rowsFailed }.

4. UI trang /scores:
   - Component <ImportExcelButton /> KHỞI CHẠY check features qua API
     GET /api/config/features. Nếu importExcelEnabled=false → component
     render null (không hiện nút). Nếu true → hiện nút "Import Excel".
   - Click nút → Dialog 3 bước:
     (1) Upload file (.xls/.xlsx, max 5MB).
     (2) Preview bảng kết quả parse (highlight dòng lỗi đỏ, dòng match xanh).
     (3) Confirm → call commit API.

KIỂM TRA PHẦN B:
- Đặt IMPORT_EXCEL_ENABLED=false trong .env → restart dev → vào /scores
  thì KHÔNG thấy nút Import Excel. Gọi trực tiếp API /api/import/excel/preview
  bằng curl → 403.
- Đặt IMPORT_EXCEL_ENABLED=true → restart → nút hiện → import file mẫu
  thành công → 14 SV vào DB chính xác.

Báo cáo: screenshot Export (cạnh file mẫu) + screenshot 2 trạng thái flag (nút ẩn/hiện).
```

---

## 🗓️ TUẦN 5 — Tra cứu + Thống kê + Biểu đồ

```
Tiếp tục Tuần 5.

1. Tra cứu (/search):
   - Search bar topbar: nhập MSSV hoặc CCCD → enter → /students/[id].
   - Trang /search filter nâng cao: Khoa, Lớp, Năm học, HK, Xếp loại, khoảng điểm.
   - Kết quả bảng SV match, click → chi tiết.

2. Thống kê (/stats):
   - Tab "Lớp": chọn lớp + HK → BarChart phân bố 7 xếp loại + bảng số liệu.
   - Tab "Khoa" (Trưởng khoa + Admin): chọn năm học → PieChart tổng hợp khoa + bảng so sánh lớp.
   - Tab "Xu hướng": LineChart điểm TB của 1 lớp qua 8 HK.
   - Mỗi biểu đồ có nút "Tải PNG" (html2canvas).

3. Trang /classes/[id]:
   - Header: code, tên, sĩ số, CVHT.
   - 4 tab: Sinh viên / Điểm HK / Tổng hợp Năm / Tổng hợp Khóa.
   - Mỗi tab có nút Export tương ứng.

4. Dashboard nâng cấp:
   - Admin: 4 card + BarChart phân bố xếp loại toàn hệ thống.
   - CVHT: card "Lớp phụ trách", badge "X/Y SV đã có điểm HK hiện tại".
   - Trưởng khoa: card tổng SV khoa + PieChart tổng hợp.

5. lib/score-aggregate.ts với:
   - getYearScore(studentId, academicYearId): Math.round((hk1+hk2)/2), null nếu thiếu.
   - getCohortScore(studentId, cohortId): Math.round(sum/count), flag isComplete.
   - Hiển thị "—" cho null.

Screenshot /stats + /classes/[DC22CTT01] tab Khóa học.
```

---

## 🗓️ TUẦN 6 — Polish + Backup + Test E2E

```
Tuần cuối.

1. Backup DB:
   - /admin/backup: nút "Sao lưu ngay" → copy prisma/dev.db → backups/backup-YYYYMMDD-HHmm.db.
   - List backup, nút "Khôi phục" (cảnh báo overwrite).

2. Đổi mật khẩu:
   - /account/password: form đổi password (validate password cũ).
   - Admin reset password user khác qua /admin/users.

3. Phím tắt:
   - Ctrl+K: command palette (cmdk) — search SV, navigate.
   - Ctrl+S trên /scores tab Inline: lưu tất cả.

4. UX polish:
   - Loading skeleton.
   - Empty state đẹp.
   - Error boundary.
   - 404 page tiếng Việt.

5. Test E2E (Playwright):
   - Login → CRUD điểm Mode A → Export → so số dòng.
   - Phân quyền: CVHT không vào được /admin.
   - Xếp loại biên: 89 → Khá; 90 → Tốt.
   - Feature flag: flag tắt thì không thấy nút Import.

6. README.md hoàn thiện:
   - Yêu cầu hệ thống.
   - Cài đặt từng bước.
   - **Cách bật/tắt feature flag IMPORT_EXCEL_ENABLED**.
   - Cách backup/restore.
   - Cách thêm CVHT mới.
   - Troubleshooting.

7. Đóng gói:
   - npm run build:standalone.
   - Bonus: npm run package:exe (pkg/nexe đóng gói .exe Windows).

Chạy test, gửi report. Tag git v1.0.0.
```

---

## 🆕 Bổ sung v1.3 — Làm rõ 3 nhóm tính năng

> Dán 3 prompt dưới đây (theo thứ tự) sau khi đã xong Tuần 2–4, để chỉnh cho khớp PRD v1.3 (mục 5.3.1, 5.4, 5.5). Nếu build mới, có thể lồng vào Tuần 2/3/4 tương ứng.

### 🅰️ Prompt B1 — Quản lý Năm học & Học kỳ (bổ sung mục 5.3.1)

```
Đọc mục 5.3.1 PRD-DiemRenLuyen.md (v1.3). Bổ sung/hoàn thiện trang quản lý danh mục
"Năm học & Học kỳ" (chỉ Admin) tại /admin/academic-years.

Yêu cầu:
1. Model dùng đúng AcademicYear + Semester đã có trong schema (mục 4) — KHÔNG thêm field mới.

2. Quản lý Năm học (AcademicYear):
   - Dialog thêm/sửa: field name, startYear, endYear.
   - Zod schema riêng: startYear ∈ 2000..2100; endYear === startYear + 1; name UNIQUE.
   - Auto-fill: khi nhập startYear → tự set endYear = startYear+1 và name = `${startYear}-${endYear}`
     (vẫn cho sửa tay).
   - Checkbox "Tạo sẵn HK1 & HK2": khi tạo Năm học mới, tạo luôn 2 Semester (number 1,2;
     name "Học kỳ 1"/"Học kỳ 2").

3. Quản lý Học kỳ (Semester):
   - Dialog thêm/sửa: combobox academicYearId, number (1|2), name, switch isLocked.
   - Zod: number ∈ {1,2}; enforce UNIQUE(academicYearId, number) — trả lỗi rõ ràng khi trùng.
   - name auto gợi ý theo number.

4. UI: bảng nhóm theo Năm học → xổ danh sách HK con; badge Khóa/Mở + số ConductScore đang gắn.

5. Ràng buộc xóa: nếu AcademicYear/Semester còn ConductScore tham chiếu → CHẶN xóa,
   toast cảnh báo, gợi ý dùng "Khóa" thay vì xóa.

6. Mọi thao tác thêm/sửa/xóa/khóa ghi audit log (entityType 'AcademicYear' | 'Semester',
   old/new value JSON).

7. Các combobox chọn HK ở /scores, import, export phải đọc từ danh mục này (nguồn duy nhất);
   khi chọn Năm học thì HK lọc theo academicYearId.

Sau khi xong: tạo thử Năm học "2026-2027" + 2 HK, thử tạo HK trùng number (phải báo lỗi),
screenshot trang danh mục.
```

### 🅱️ Prompt B2 — Nhập điểm theo Lớp × Học kỳ × Năm học (bổ sung mục 5.4)

```
Đọc mục 5.4 PRD-DiemRenLuyen.md (v1.3). Chỉnh trang /scores để bắt buộc chọn đủ 3 chiều
trước khi nhập điểm.

Yêu cầu:
1. Bộ lọc top gồm 3 dropdown phụ thuộc nhau, theo thứ tự:
   Năm học → Học kỳ (chỉ hiện HK thuộc năm học đã chọn) → Lớp (CVHT chỉ thấy lớp mình advise;
   Admin thấy tất cả).
2. Chỉ khi chọn đủ 3 → mới load bảng SV của lớp đó cho đúng semesterId để nhập điểm.
   Trước đó hiện empty state hướng dẫn.
3. Mỗi ô điểm map đúng 1 ConductScore theo UNIQUE(studentId, semesterId).
4. Giữ nguyên 2 mode (Form Dialog + Bảng inline) đã có; chỉ thay đổi phần filter + điều kiện load.
5. Nếu Semester.isLocked=true → banner "HK đã chốt" + readonly (giữ như cũ).
6. Xếp loại recompute server-side khi lưu (không tin client).
7. Không đổi API contract nếu đã đúng; chỉ đảm bảo semesterId truyền lên khớp HK+Năm học đã chọn.

Sau khi xong: login CVHT, chọn 2025-2026 → HK1 → DC22CTT01, nhập 1 điểm mỗi mode,
screenshot bộ lọc 3 tầng.
```

### 🅲 Prompt B3 — Import bảng tổng hợp điểm HK theo lớp (bổ sung mục 5.5)

```
Đọc mục 5.5 PRD-DiemRenLuyen.md (v1.3). Hoàn thiện Import Excel từ "Bảng tổng hợp điểm
rèn luyện từng học kỳ theo lớp" (sheet HỌC KỲ / HỌC KỲ 2). Giữ nguyên feature flag
IMPORT_EXCEL_ENABLED (mục CLAUDE.md).

Yêu cầu:
1. Dialog import chọn đích theo 3 chiều Năm học → Học kỳ → Lớp (như /scores).
2. Bước preview (POST /api/import/excel/preview) trả cho mỗi dòng:
   { row, cccd, maSV, hoTen, diem, xepLoai (RECOMPUTE server-side), matchStatus, action, error? }
   - matchStatus: matched | not_in_db | not_in_target_class
   - action: create | overwrite | skip
3. Quy tắc:
   - Đối chiếu SV theo maSV trước, fallback cccd.
   - Xếp loại LUÔN recompute từ điểm (mục 6.1), KHÔNG lấy cột "Xếp loại" trong Excel.
   - Nếu SV đã có điểm ở HK đích (trùng UNIQUE studentId+semesterId) → action=overwrite,
     đánh dấu "sẽ ghi đè", mặc định KHÔNG tick; CVHT tick mới cập nhật.
   - maSV không thuộc lớp đích → matchStatus=not_in_target_class, mặc định skip + cảnh báo.
   - Điểm không phải integer 0-100 → error, chặn commit dòng đó.
   - Dừng parse khi gặp "THỐNG KÊ:" hoặc 3 dòng trống liên tiếp.
4. Commit (POST /api/import/excel/commit): chỉ ghi các dòng hợp lệ + được chọn;
   audit log IMPORT_EXCEL kèm { filename, classId, semesterId, academicYearId,
   rowsSuccess, rowsOverwritten, rowsSkipped, rowsFailed }.
5. Cả preview + commit check features.importExcel đầu handler → 403 nếu tắt.
6. UI preview: highlight màu theo action (create=xanh, overwrite=vàng, skip=xám, error=đỏ),
   checkbox chọn/bỏ từng dòng, đếm tổng theo action.

Kiểm tra:
- Flag=true, import file mẫu DC22CTT01-II-25-26.xls (sheet HỌC KỲ) vào DC22CTT01/HK1/2025-2026
  → preview đúng, commit → điểm vào DB.
- Import lại lần 2 → tất cả dòng thành "overwrite" (mặc định không tick → không đổi gì).
- Flag=false → nút ẩn + API 403.
Screenshot preview có đủ 4 màu trạng thái.
```

---

## 🆕 Bổ sung v1.4 — AI nhận diện file Excel import

> Dán prompt B4 sau khi đã xong Import Excel (Tuần 4 / prompt B3). Đây là phần mở rộng của Import, không phải luồng độc lập.

### 🅳 Prompt B4 — AI nhận diện & chuẩn hoá file import (bổ sung mục 5.5.2)

```
Đọc mục 5.5.2 PRD-DiemRenLuyen.md (v1.4). Thêm tính năng AI nhận diện & chuẩn hoá
file Excel import, đứng sau feature flag AI_IMPORT_ENABLED + ANTHROPIC_API_KEY.
CHỈ hoạt động khi CẢ IMPORT_EXCEL_ENABLED và AI_IMPORT_ENABLED đều bật.

Kỹ thuật (bám Tech Stack đã chốt):
1. Dùng SDK CHÍNH THỨC @anthropic-ai/sdk. Model mặc định "claude-opus-4-8",
   đọc từ env AI_IMPORT_MODEL (cho phép claude-haiku-4-5 / claude-sonnet-4-6).
2. Ép JSON bằng Structured Outputs: client.messages.parse() với
   output_config: { format: { type: "json_schema", schema } }. KHÔNG dùng prefill
   (đã bỏ trên model 4.x). Với thinking, nếu cần dùng { type: "adaptive" }.
3. lib/features.ts thêm: aiImport = AI_IMPORT_ENABLED === 'true' && !!ANTHROPIC_API_KEY.
   GET /api/config/features trả thêm { aiImportEnabled: boolean }.

Server (lib/ai-import.ts):
- Hàm analyzeExcelWithAI(sheets): chỉ gửi cho model tên các sheet + header dòng 1–7
  + tối đa ~15 dòng dữ liệu mẫu (không gửi toàn bộ file nếu >200 dòng).
- Zod schema AiImportAnalysisSchema đúng như mục 5.5.2:
  { sheetGuess, columnMapping: { stt|cccd|maSV|hoTen|diem|ghiChu: {col, confidence} },
    rowAnomalies: [{ row, field, value, suggestedValue, reason }] }.
- VALIDATE lại toàn bộ output của model bằng Zod trước khi trả client (không tin cấu trúc trả về).
- Áp ánh xạ cột (từ mẫu) cho TOÀN file bằng code tất định, không nhờ AI đọc hết file.
- Xử lý lỗi: thiếu/ sai ANTHROPIC_API_KEY, hết quota, timeout → thông báo tiếng Việt,
  fallback về parser tất định (mục 5.5), không chặn nhập tay.

API:
- POST /api/import/excel/ai-analyze → trả AiImportAnalysisSchema.
  ĐẦU HÀM check features.aiImport — false thì trả 403.
  Gọi Anthropic thất bại → 502 + message tiếng Việt.
- Ghi audit log action=AI_ANALYZE_IMPORT với { filename, sheet, rowsAnalyzed }
  (KHÔNG log nội dung điểm chi tiết vào oldValue/newValue).

Ranh giới bắt buộc:
- AI CHỈ đề xuất; mọi thay đổi phải CVHT duyệt tay trên preview trước commit. Không ghi thẳng vào DB.
- Xếp loại LUÔN recompute server-side từ điểm (mục 6.1) — không lấy từ AI/Excel.
- Ưu tiên parser tất định: nếu parser map đủ cột + không lỗi thì KHÔNG gọi AI.
  AI chỉ chạy khi parser thiếu cột/lỗi HOẶC CVHT bấm "Phân tích bằng AI".
- suggestedValue của AI (vd "85đ"→85) phải qua lại validation Zod (điểm int 0–100…) ở server.

UI (mở rộng Dialog import ở /scores):
- Nút "Phân tích bằng AI" chỉ hiện khi aiImportEnabled=true (check qua /api/config/features).
- Trước lần chạy đầu: hiện CẢNH BÁO quyền riêng tư "Dữ liệu sẽ được gửi tới dịch vụ AI (Anthropic)
  để phân tích" + checkbox xác nhận, mới cho gọi.
- Hiển thị: ánh xạ cột AI đề xuất (combobox cho CVHT sửa) + danh sách dòng nghi ngờ
  (mỗi dòng có nút "Áp giá trị đề xuất" / "Bỏ qua").
- Sau khi CVHT chốt ánh xạ → dựng lại bảng → về đúng preview chuẩn của 5.5 (recompute xếp loại) → commit.

Kiểm tra:
- AI_IMPORT_ENABLED=false (hoặc thiếu key) → nút ẩn; gọi trực tiếp API → 403; import tất định vẫn chạy.
- AI_IMPORT_ENABLED=true → tạo 1 file test đổi tên cột "Mã SV"→"MSSV" + 1 điểm "85đ"
  → AI map đúng cột + gắn cờ dòng điểm lỗi + đề xuất 85 → CVHT duyệt → commit → điểm=85 trong DB.
Screenshot: cảnh báo quyền riêng tư + bảng ánh xạ cột + danh sách dòng nghi ngờ.
```

---

## 🆘 Prompt sửa lỗi thường gặp

### Schema sai:
```
Dừng. So sánh schema.prisma hiện tại với mục 4 PRD-DiemRenLuyen.md.
Liệt kê các khác biệt rồi sửa cho khớp PRD.
```

### Export Excel không khớp mẫu:
```
File export lệch với templates/mau-rl-hocky.xlsx ở: [mô tả].
Đọc lại mục 7 PRD. Mở cả 2 file bằng exceljs, log cell address + value + style
chỗ bị lệch. Fix code rồi export lại để tôi đối chiếu.
```

### Feature flag không hoạt động:
```
Audit lib/features.ts và mọi nơi check flag. Mục 5.5 PRD quy định khi
IMPORT_EXCEL_ENABLED=false:
- Nút "Import Excel" PHẢI ẩn trên UI.
- API /api/import/excel/* PHẢI return 403.
Test 2 trạng thái flag và báo cáo kết quả.
```

### Phân quyền lỏng:
```
Audit tất cả API route. Liệt kê route nào CVHT có thể gọi mà không check ownership.
Mục 6.4 PRD: CVHT chỉ access lớp họ advise; Trưởng khoa chỉ đọc trong khoa mình.
Bổ sung middleware/guard cho route thiếu.
```

### Refactor:
```
Dừng tính năng mới. Đọc src/lib/ và src/app/api/. Tìm code lặp, function dài >80 dòng,
magic string. Đề xuất refactor (không code ngay). Đợi tôi duyệt.
```

---

## 💡 Mẹo dùng Claude Code

1. Luôn để PRD ở root.
2. Commit sau mỗi tuần.
3. Yêu cầu Claude confirm trước khi code module dài.
4. Test thủ công sau mỗi prompt.
5. Excel export lệch → gửi screenshot 2 file cạnh nhau, ép so từng cell.
6. Bug khó → bảo Claude `console.log` từng bước.
7. Cuối tuần: `Review code tuần X, đề xuất 3 cải tiến nhỏ trước khi sang tuần X+1`.

— Hết —
