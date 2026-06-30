# Tóm tắt nhanh & Checklist khởi động (v1.2)

## 📁 Bạn có 3 file:

| File | Dùng khi nào |
|---|---|
| **`PRD-DiemRenLuyen.md`** (v1.2) | Tài liệu yêu cầu sản phẩm đầy đủ. Để ở root project. |
| **`CLAUDE-CODE-PROMPTS.md`** | Bộ prompt sẵn cho 6 tuần Roadmap. |
| **`README-Quick-Start.md`** *(file này)* | Checklist khởi động & các quyết định cần chốt. |

---

## 🔄 Thay đổi v1.0 → v1.2

- **Nhập điểm thủ công**: làm cả **2 mode** — Form Dialog đơn giản + Bảng inline editable, người dùng chọn qua tab.
- **Import Excel**: implement đầy đủ specs, NHƯNG đứng sau **feature flag** `IMPORT_EXCEL_ENABLED` trong `.env`. Mặc định `false` → nút ẩn, API trả 403. Khi cần dùng đổi `true` rồi restart.
- **CLI seed Excel**: thêm `npm run seed:excel -- --file=<path>` để nhập nhanh dữ liệu cũ lúc cài đặt (chạy 1 lần bởi admin/dev).

---

## ✅ Quyết định đã chốt trong PRD

- **Tech stack**: Next.js 14 + TypeScript + Prisma + SQLite + Tailwind + shadcn/ui + next-auth v5 + exceljs
- **Vai trò**: Admin / CVHT / Trưởng khoa
- **Quy mô**: ~200 SV, 5 lớp, 1 khoa, 4 năm dữ liệu
- **Xếp loại**: 6 mức + "Không xếp loại" (kỷ luật)
- **Triển khai**: localhost trên máy CVHT
- **Audit log**: bật cho mọi thao tác sửa điểm
- **Feature flag**: chỉ Import Excel có flag; các tính năng khác bật mặc định

## ⚠️ Quyết định bạn có thể muốn xem lại

Đọc nhanh các điểm sau trong PRD trước khi code:

1. **Tài khoản mặc định** (mục 5.1): `admin / Admin@123` — bạn có muốn đổi không?
2. **CVHT chỉ thấy lớp được gán** (mục 2 + 6.4) — đúng ý bạn chứ?
3. **Trưởng khoa không sửa điểm** (mục 2) — có cần cho phép override khi CVHT vắng?
4. **Học kỳ "khóa" được** (mục 5.4) — ai có quyền khóa/mở khóa? Hiện PRD: Admin.
5. **Backup tự động hay thủ công** (mục 9 + Tuần 6) — hiện thủ công.
6. **Đóng gói .exe** (Tuần 6) — đang để bonus. Có bắt buộc không?

---

## 🚀 Checklist trước khi mở Claude Code

- [ ] Cài **Node.js 20 LTS** (chấp nhận 20–22). ⛔ **KHÔNG dùng Node 24** — gây lỗi 500 khi đăng nhập ở chế độ dev (xem mục ⚠️ Yêu cầu Node bên dưới).
- [ ] Cài Git.
- [ ] Tạo folder: `mkdir diem-renluyen && cd diem-renluyen && git init`.
- [ ] Copy 3 file `.md` + file Excel mẫu `DC22CTT01-II-25-26.xls` vào folder.
- [ ] Mở Claude Code trong folder này.
- [ ] Dán **Prompt khởi đầu** từ `CLAUDE-CODE-PROMPTS.md` để Claude tóm tắt PRD.
- [ ] Xác nhận Claude hiểu đúng → bắt đầu **Tuần 1**.

---

## 📋 Quy trình làm việc đề xuất

1. Đọc mục Roadmap tương ứng trước mỗi tuần.
2. Dán prompt tuần đó vào Claude Code — không tự sửa nhiều.
3. Sau khi Claude xong:
   - Chạy `npm run dev`, test theo Acceptance Criteria (mục 12 PRD).
   - Commit: `git commit -m "feat: Tuần N - <nội dung>"`.
4. Lỗi → dùng các **Prompt sửa lỗi** ở cuối `CLAUDE-CODE-PROMPTS.md`.
5. Không nhảy cóc — xong tuần 1 mới sang tuần 2.

---

## 🧪 Test thủ công bắt buộc sau từng tuần

| Tuần | Kiểm tra |
|---|---|
| 1 | Login admin → dashboard. File `.env.example` có `IMPORT_EXCEL_ENABLED=false`. API `/api/config/features` trả `{importExcelEnabled: false}`. |
| 2 | Tạo được 1 Khoa, 1 Lớp, 1 SV qua UI admin. |
| 3 | Chạy CLI seed thành công 14 SV. Nhập điểm bằng Mode A (Dialog) và Mode B (Inline) đều hoạt động. Audit log đầy đủ. |
| 4 | **Phần A**: Export file Excel → so cell-by-cell với file mẫu, không lệch. **Phần B**: `IMPORT_EXCEL_ENABLED=false` → nút ẩn; chuyển `=true` + restart → nút hiện + import thành công. |
| 5 | Tìm `221CTT006` ra trang SV; biểu đồ tiến triển 8 HK đúng. |
| 6 | Tạo backup → xóa 1 SV → khôi phục → SV xuất hiện lại. Playwright pass. |

---

## ⚠️ Yêu cầu phiên bản Node (BẮT BUỘC)

Dự án dùng **Next.js 14.2** → chỉ chạy ổn trên **Node 20–22 (LTS)**. **Node 24 không tương thích.**

**Triệu chứng khi chạy sai Node (24+):**
- Đăng nhập ở `npm run dev` báo lỗi **500** tại `/api/auth/providers`, console hiện:
  `Jest worker encountered child process exceptions, exceeding retry limit`.
- Bản production (`npm run serve`) vẫn chạy được vì đã compile sẵn lúc build.

**Kiểm tra & khắc phục:**
```powershell
node -v                     # phải là v20.x (hoặc 22.x)
```
Nếu là v24 → chuyển về Node 20 bằng nvm-windows:
```powershell
# Cài nvm-windows (1 lần): winget install CoreyButler.NVMforWindows
nvm install 20.18.1
nvm use 20.18.1
node -v                     # xác nhận v20.18.1
```
> Đã khóa sẵn trong repo: `engines` (package.json), `.nvmrc` (`20`), `.npmrc` (`engine-strict=true`)
> → `npm install` sẽ **báo lỗi** nếu chạy sai phiên bản Node.

---

## 🚩 Cách bật/tắt Import Excel

**Tắt (mặc định):**
```
# .env
IMPORT_EXCEL_ENABLED=false
```
→ Nút "Import Excel" ẩn trên UI. Gọi trực tiếp API → 403.

**Bật:**
```
# .env
IMPORT_EXCEL_ENABLED=true
```
→ Restart server (`Ctrl+C` → `npm run dev`). Nút hiện trên trang `/scores`.

---

## 🆘 Khi nào liên hệ tôi (Claude trong chat này) thay vì Claude Code?

- Khi muốn **thay đổi PRD** (thêm tính năng, đổi quy tắc nghiệp vụ).
- Khi Claude Code **lệch hướng nhiều lần** dù đã dùng prompt sửa lỗi.
- Khi cần **bổ sung module mới** (vd: thông báo email, công khai cho SV tra cứu).
- Khi muốn **migrate sang stack khác** (vd: SQLite → PostgreSQL).

---

## 📞 Tham chiếu nhanh

- **MSSV**: `^[0-9]{3}[A-Z]{3}[0-9]{3}$` (vd: `221CTT006`)
- **CCCD**: 12 chữ số
- **Xếp loại**: 90+ XS / 80+ Tốt / 65+ Khá / 50+ TB / 35+ Yếu / <35 Kém / SUSPENDED → Không xếp loại
- **Điểm năm** = round((HK1 + HK2) / 2)
- **Điểm khóa** = round(sum / count)
- **File mẫu**: `DC22CTT01-II-25-26.xls` — copy vào `sample/` + `public/sample/`
- **CLI seed**: `npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls`
- **Feature flag**: `IMPORT_EXCEL_ENABLED` trong `.env`

Chúc bạn xây dựng thành công! 🎉
