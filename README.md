# Quản lý Điểm Rèn luyện Sinh viên

Ứng dụng web quản lý điểm rèn luyện sinh viên dành cho **Cố vấn học tập (CVHT)** và **Trưởng khoa**. Lưu trữ, tra cứu, nhập, xuất báo cáo điểm rèn luyện theo từng học kỳ, năm học và toàn khóa — tương thích với mẫu Excel chuẩn của Trường Đại học Phú Yên (Khoa KHTN và CNTT).

> 📌 Phiên bản hiện tại: **MVP 1.0** — đang phát triển theo PRD v1.2.

---

## ✨ Tính năng

### Đã có trong MVP

- 🔐 **Đăng nhập 3 vai trò**: Admin / Cố vấn học tập / Trưởng khoa, phân quyền chi tiết theo lớp & khoa.
- 👨‍🎓 **Quản lý danh mục**: Khoa, Khóa học, Năm học, Học kỳ, Lớp, Sinh viên, Người dùng.
- 📝 **Nhập điểm thủ công** — 2 chế độ:
  - **Form Dialog**: thêm/sửa từng SV qua hộp thoại.
  - **Bảng inline**: nhập hàng loạt theo bảng, blur lưu auto.
- 📥 **Import Excel** (qua feature flag — mặc định tắt): upload file `.xls`/`.xlsx` theo mẫu, preview trước khi ghi DB.
- 📤 **Export Excel** đúng 4 mẫu chuẩn:
  - Bảng điểm theo Học kỳ.
  - Bảng điểm theo Năm học (HKI + HKII + cả năm).
  - Bảng điểm theo Khóa học (8 HK + điểm toàn khóa).
  - Tổng hợp toàn khoa (3 sheet: HK / Năm học / Toàn khóa).
- 🔍 **Tra cứu nhanh** theo MSSV hoặc CCCD; filter nâng cao theo Lớp / HK / Xếp loại.
- 📊 **Thống kê & biểu đồ**: cột (phân bố xếp loại), đường (xu hướng), tròn (tổng hợp khoa).
- 🗂️ **CLI seed**: lệnh `npm run seed:excel` nhập nhanh dữ liệu cũ từ file Excel lúc cài đặt.
- 📜 **Audit log**: ghi lại mọi thao tác CRUD điểm, login/logout, import/export.
- 💾 **Backup DB**: sao lưu/khôi phục file SQLite trong vài click.

### Quy mô hỗ trợ

- ~200 sinh viên / 5 lớp / 1 khoa / 4 năm dữ liệu (mở rộng được).
- Đa người dùng cùng lúc trong mạng nội bộ (localhost / LAN).

---

## 🛠️ Tech Stack

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript strict |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Form & Validation | react-hook-form + Zod |
| Server state | TanStack Query |
| ORM | Prisma 5 |
| DB | SQLite (file `prisma/dev.db`) |
| Auth | next-auth v5 (Credentials) + bcryptjs |
| Excel I/O | exceljs + xlsx |
| Charts | recharts |
| Notification | sonner |
| Test | vitest + playwright |

---

## 📋 Yêu cầu hệ thống

- **Node.js**: ≥ 20.0.0 ([tải tại nodejs.org](https://nodejs.org))
- **npm**: ≥ 10 (đi kèm Node.js) hoặc pnpm/yarn
- **Git**: bất kỳ phiên bản nào ≥ 2.30 ([tải tại git-scm.com](https://git-scm.com))
- **Hệ điều hành**: Windows 10/11, macOS 12+, Ubuntu 22.04+ đều chạy được.
- **RAM**: tối thiểu 4 GB.
- **Ổ cứng**: 500 MB trống cho `node_modules` + DB.

---

## 🚀 Cài đặt nhanh

```bash
# 1. Clone hoặc copy source về máy
git clone <repo-url> diem-renluyen
cd diem-renluyen

# 2. Cài dependencies
npm install

# 3. Tạo file cấu hình môi trường
cp .env.example .env
# Mở .env, sửa AUTH_SECRET thành chuỗi bí mật (≥ 32 ký tự).
# Sinh nhanh: openssl rand -base64 32

# 4. Khởi tạo database
npm run db:migrate

# 5. Seed dữ liệu mặc định (Admin + Khoa + Khóa + 1 Lớp)
npm run db:seed

# 6. (TUỲ CHỌN) Nhập dữ liệu cũ từ file Excel mẫu
npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls

# 7. Chạy ứng dụng
npm run dev
```

Mở trình duyệt vào **http://localhost:3000** → đăng nhập bằng tài khoản mặc định bên dưới.

---

## 👤 Tài khoản mặc định

Sau khi chạy `npm run db:seed`, hệ thống có sẵn:

| Vai trò | Username | Password | Ghi chú |
|---|---|---|---|
| **Admin** | `admin` | `Admin@123` | Đổi password ngay lần đầu đăng nhập |
| **Cố vấn học tập** | `hothiduyen` | `Cvht@123` | Lớp DC22CTT01 |
| **Trưởng khoa** | `truongkhoa` | `Tk@123` | Khoa KHTN và CNTT |

⚠️ **Bắt buộc đổi password trước khi triển khai thực tế.**

---

## 🚩 Bật/tắt tính năng Import Excel

Tính năng Import Excel được bảo vệ bằng feature flag để tránh nhập nhầm dữ liệu trong giai đoạn chưa cần thiết.

**Tắt (mặc định):**
```env
# Trong file .env
IMPORT_EXCEL_ENABLED=false
```
→ Nút "Import Excel" sẽ **ẩn** trên UI; API trả 403 nếu gọi trực tiếp.

**Bật:**
```env
IMPORT_EXCEL_ENABLED=true
```
→ Restart server (`Ctrl+C` → `npm run dev`) → nút hiện trên trang **Điểm rèn luyện**.

---

## 📁 Cấu trúc thư mục

```
diem-renluyen/
├── CLAUDE.md                       Hướng dẫn cho Claude Code
├── PRD-DiemRenLuyen.md             Tài liệu yêu cầu sản phẩm
├── README.md                       File này
├── .env.example                    Template biến môi trường
├── docs/
│   ├── CLAUDE-CODE-PROMPTS.md      Prompt theo từng tuần
│   └── README-Quick-Start.md       Checklist khởi động
├── sample/
│   └── DC22CTT01-II-25-26.xls      File Excel mẫu
├── templates/                      Template Excel cho Export
│   ├── mau-rl-hocky.xlsx
│   ├── mau-rl-namhoc.xlsx
│   ├── mau-rl-khoahoc.xlsx
│   └── mau-tonghop-khoa.xlsx
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── scripts/
│   └── seed-excel.ts               CLI seed Excel
├── src/
│   ├── app/                        Next.js App Router
│   ├── components/                 React components
│   └── lib/                        Helpers, business logic
├── backups/                        DB backups (tự tạo khi backup)
└── public/
```

---

## 💼 Các lệnh thường dùng

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Chạy dev server ở `http://localhost:3000` |
| `npm run build` | Build production |
| `npm run start` | Chạy server production |
| `npm run db:migrate` | Áp dụng Prisma migration |
| `npm run db:seed` | Seed dữ liệu mặc định |
| `npm run db:studio` | Mở Prisma Studio (GUI xem DB) |
| `npm run seed:excel -- --file=<path>` | Import 1 file Excel mẫu vào DB |
| `npm run test` | Chạy unit test (vitest) |
| `npm run test:e2e` | Chạy E2E test (playwright) |
| `npm run lint` | Lint code |

---

## 📖 Hướng dẫn sử dụng

### Cho Cố vấn học tập

1. **Đăng nhập** với tài khoản CVHT.
2. Vào menu **Điểm rèn luyện** → chọn lớp phụ trách + học kỳ.
3. Chọn 1 trong 2 chế độ:
   - **Form Dialog** (thêm từng SV): nhấn `+ Thêm điểm`, chọn SV, nhập điểm, lưu.
   - **Bảng inline** (nhập cả lớp): click vào ô Điểm, sửa, blur tự lưu. Hết cả bảng nhấn `Lưu tất cả`.
4. Xếp loại hiển thị tự động theo điểm.
5. Khi nộp báo cáo: nhấn **Xuất Excel** → tải file `.xlsx` theo đúng mẫu chuẩn → gửi phòng CTSV.

### Cho Trưởng khoa

1. Vào **Thống kê** xem biểu đồ phân bố xếp loại toàn khoa.
2. Vào **Báo cáo tổng hợp khoa** → chọn phạm vi (Học kỳ / Năm học / Toàn khóa) → **Xuất Excel** ra file 3 sheet `TONG HOP-*`.
3. Có thể tra cứu từng SV hoặc từng lớp qua thanh tìm kiếm.

### Cho Admin

1. Vào **Quản lý danh mục** để khởi tạo Khoa / Khóa / Năm học / Học kỳ / Lớp / SV / Người dùng.
2. Vào **Audit log** để theo dõi mọi thay đổi trong hệ thống.
3. Vào **Backup** để sao lưu/khôi phục database.

---

## 💾 Backup & Khôi phục

### Cách 1 — Qua giao diện (khuyến nghị)
- Đăng nhập Admin → menu **Quản trị > Backup** → nhấn **Sao lưu ngay**.
- File backup lưu tại `backups/backup-YYYYMMDD-HHmm.db`.
- Nhấn **Khôi phục** kế tên file để rollback (cảnh báo trước khi ghi đè).

### Cách 2 — Thủ công
```bash
# Backup
cp prisma/dev.db backups/backup-$(date +%Y%m%d-%H%M).db

# Restore
cp backups/backup-20260629-1530.db prisma/dev.db
```

---

## 🔒 Bảo mật

- Mật khẩu hash bằng **bcrypt** (10 rounds).
- Phiên đăng nhập dùng **HttpOnly cookie**.
- Mọi API validate input bằng **Zod**.
- CSRF protection mặc định của Next.js.
- **Row-level access**: CVHT chỉ thấy lớp được gán; Trưởng khoa chỉ đọc trong khoa mình.
- Mọi thao tác sửa điểm đều được ghi vào **audit log**.

⚠️ **Khi triển khai cho nhiều người dùng trong LAN**, đặt sau reverse proxy (nginx/caddy) có HTTPS để bảo vệ cookie phiên.

---

## 📚 Tài liệu

| Tài liệu | Mô tả |
|---|---|
| [`PRD-DiemRenLuyen.md`](./PRD-DiemRenLuyen.md) | Yêu cầu sản phẩm chi tiết (v1.2) — nguồn sự thật |
| [`CLAUDE.md`](./CLAUDE.md) | Hướng dẫn cho Claude Code khi phát triển |
| [`docs/CLAUDE-CODE-PROMPTS.md`](./docs/CLAUDE-CODE-PROMPTS.md) | Bộ prompt phát triển theo từng tuần Roadmap |
| [`docs/README-Quick-Start.md`](./docs/README-Quick-Start.md) | Checklist khởi động & tham chiếu nhanh |

---

## 🗓️ Roadmap

| Tuần | Nội dung | Trạng thái |
|---|---|---|
| 1 | Init project + Auth + Feature flag | 🟡 Đang làm |
| 2 | CRUD danh mục | ⚪ Chưa bắt đầu |
| 3 | Nhập điểm (2 mode) + CLI seed + Audit log | ⚪ Chưa bắt đầu |
| 4 | Export Excel + Import Excel | ⚪ Chưa bắt đầu |
| 5 | Tra cứu + Thống kê + Biểu đồ | ⚪ Chưa bắt đầu |
| 6 | Polish + Backup + Test E2E | ⚪ Chưa bắt đầu |

Sau MVP có thể bổ sung: đóng gói `.exe` Windows, đa ngôn ngữ Anh-Việt, export PDF, gửi email báo cáo tự động, trang công khai cho SV tra cứu.

---

## 🤝 Đóng góp & Phát triển

Dự án này được xây dựng bằng [Claude Code](https://docs.claude.com/claude-code) theo phương pháp **vibe coding** với PRD chi tiết.

**Quy trình phát triển:**
1. Đọc kỹ `PRD-DiemRenLuyen.md`.
2. Mở `docs/CLAUDE-CODE-PROMPTS.md`, dán prompt theo tuần.
3. Sau mỗi tuần: chạy test thủ công theo Acceptance Criteria (mục 12 PRD), commit code.
4. Bug/gợi ý: tạo issue trong repo.

**Quy ước commit (gợi ý):**
- `feat: Tuần N — <mô tả>` — tính năng mới theo Roadmap.
- `fix: <mô tả>` — sửa lỗi.
- `refactor: <mô tả>` — tái cấu trúc.
- `docs: <mô tả>` — cập nhật tài liệu.

---

## ❓ Hỏi đáp nhanh (FAQ)

**Hỏi: Tôi vừa thêm SV mới mà không thấy ở danh sách nhập điểm?**  
Đáp: Kiểm tra trạng thái SV (status = ACTIVE) và lớp được gán đúng chưa.

**Hỏi: Import Excel báo "không có quyền"?**  
Đáp: Mở `.env`, đổi `IMPORT_EXCEL_ENABLED=true`, restart server.

**Hỏi: Export Excel mở ra bị lỗi font?**  
Đáp: File dùng Times New Roman. Cài font Times New Roman trên máy mở file (Windows/Mac thường có sẵn; Linux: `sudo apt install ttf-mscorefonts-installer`).

**Hỏi: Quên password Admin thì sao?**  
Đáp: Xóa file `prisma/dev.db`, chạy lại `npm run db:migrate && npm run db:seed` — password sẽ về mặc định `Admin@123` (sẽ **mất hết dữ liệu**, nhớ backup trước).

**Hỏi: Có chạy đa người dùng được không?**  
Đáp: Có. Đặt máy đang chạy `npm run dev` (hoặc `npm run start` sau build) trong mạng LAN, các CVHT khác truy cập qua IP nội bộ (vd `http://192.168.1.10:3000`).

**Hỏi: Dữ liệu lưu ở đâu?**  
Đáp: 1 file SQLite duy nhất: `prisma/dev.db`. Copy file này là copy được toàn bộ DB.

---

## 📞 Liên hệ

- **Đơn vị**: Khoa KHTN và CNTT — Trường Đại học Phú Yên
- **Issue/Feedback**: tạo issue trong repo hoặc liên hệ admin hệ thống.

---

## 📄 License

Nội bộ — Trường Đại học Phú Yên. Không phân phối lại khi chưa được phép.
