# PRD — Ứng dụng Quản lý Điểm Rèn luyện Sinh viên

**Phiên bản:** 1.6  
**Ngày:** 02/07/2026  
**Mục tiêu sử dụng:** Tài liệu yêu cầu sản phẩm để xây dựng ứng dụng bằng Claude Code.

> **Lịch sử thay đổi:**
> - v1.0 (ban đầu): có nhập điểm inline + import Excel UI.
> - v1.1: tạm cắt 2 tính năng trên khỏi MVP.
> - v1.2: khôi phục cả 2 tính năng. Import Excel implement đầy đủ nhưng có feature flag `IMPORT_EXCEL_ENABLED` (mặc định OFF) để ẩn UI khi chưa muốn dùng. Thêm CLI seed script.
> - v1.3: làm rõ 3 nhóm tính năng — (1) Import Excel từ *Bảng tổng hợp điểm rèn luyện từng học kỳ theo lớp* (mục 5.5); (2) Nhập điểm thủ công cho từng SV theo Lớp × Học kỳ × Năm học phục vụ cấp chứng nhận Điểm rèn luyện (mục 5.4); (3) Thêm/sửa Năm học và Học kỳ trong Quản lý danh mục (mục 5.3.1).
> - v1.4: thêm tính năng *Nhận diện & chuẩn hoá file Excel import bằng AI (Google Gemini)* — mục 5.5.2. Khi format Excel của trường thay đổi theo từng năm (đổi tên cột/sheet, xê dịch cột, dữ liệu chưa chuẩn), model AI đề xuất ánh xạ cột + gắn cờ dữ liệu nghi ngờ để CVHT duyệt. Đứng sau feature flag `AI_IMPORT_ENABLED` (mặc định OFF), cần `GEMINI_API_KEY`.
> - v1.5: trình bày rõ *Import Excel là phương thức nhập điểm thứ 3* ngay trong chức năng Điểm rèn luyện (mục 5.4) — bên cạnh 2 mode nhập tay; nút "Import Excel" trên `/scores`, ghi vào đúng Lớp × Học kỳ × Năm học đang chọn, có preview ghi-đè có kiểm soát (tham chiếu mục 5.5 / 5.5.2).
> - **v1.6 (hiện tại): bổ sung *combobox lọc theo Năm học trên Dashboard* (mục 5.2.1) — lọc card thống kê + biểu đồ theo năm học được chọn, mặc định năm hiện hành, tính lại server-side, giữ nguyên phạm vi dữ liệu theo vai trò.**

---

## 1. Tổng quan

Ứng dụng web chạy local trên máy Cố vấn học tập (CVHT), dùng để **lưu trữ, tra cứu, nhập, import/export điểm rèn luyện** của sinh viên theo từng học kỳ, năm học và toàn khóa. Ứng dụng thay thế việc quản lý phân tán bằng file Excel rời, vẫn cho phép import/export đúng mẫu Excel hiện hành để tương thích với quy trình hiện tại của trường.

**Đặc điểm chính:**
- Web app, chạy localhost, đa người dùng (nhiều CVHT, Trưởng khoa cùng đăng nhập trong mạng nội bộ).
- Database SQLite (1 file `.db`, không cần cài server).
- Giao diện 100% tiếng Việt.
- **Nhập điểm thủ công**: 2 mode — form Dialog đơn giản + bảng inline editable.
- **Import Excel**: có UI hoàn chỉnh, ẩn/hiện qua feature flag.
- **Export Excel** theo đúng mẫu file `DC22CTT01-II-25-26.xls` (7 sheet).
- **CLI seed**: lệnh `npm run seed:excel` để nhập nhanh dữ liệu cũ lúc cài đặt.

---

## 2. Đối tượng người dùng & Vai trò

| Vai trò | Mô tả | Quyền |
|---|---|---|
| **Admin** | Quản trị hệ thống (1 tài khoản khởi tạo lần đầu) | Toàn quyền: quản lý user, khoa, lớp, danh mục, điểm; xem audit log toàn hệ thống |
| **Cố vấn học tập (CVHT)** | Giảng viên phụ trách 1 hoặc nhiều lớp | Nhập/sửa/xóa điểm SV của lớp mình (cả form và inline); Import Excel cho lớp mình (khi flag bật); Export báo cáo lớp mình; Tra cứu lớp mình |
| **Trưởng khoa** | Quản lý cấp khoa | Xem tất cả lớp trong khoa; Export báo cáo tổng hợp khoa (TONG HOP-HK, NH, TK); Không sửa điểm trực tiếp |

**Quy tắc bắt buộc:**
- 1 lớp có 1 CVHT chính (bắt buộc gán khi tạo lớp).
- CVHT chỉ thấy/sửa được dữ liệu của lớp được gán.
- Trưởng khoa **chỉ đọc**, không sửa điểm; muốn sửa phải nhờ CVHT của lớp đó.

---

## 3. User Stories chính

**Admin**
- Là Admin, tôi muốn tạo tài khoản CVHT và Trưởng khoa để họ đăng nhập sử dụng.
- Là Admin, tôi muốn tạo khoa, lớp, khóa học, năm học, học kỳ để khởi tạo hệ thống.
- Là Admin, tôi muốn seed dữ liệu ban đầu từ file Excel mẫu vào DB qua 1 lệnh CLI.
- Là Admin, tôi muốn bật/tắt tính năng "Import Excel" qua biến môi trường mà không cần sửa code.
- Là Admin, tôi muốn xem toàn bộ audit log để giám sát.

**CVHT**
- Là CVHT, tôi muốn nhập/sửa điểm 1 SV qua form Dialog đơn giản.
- Là CVHT, tôi muốn nhập điểm hàng loạt cho cả lớp theo bảng inline (như Excel) cho nhanh.
- Là CVHT, tôi muốn (khi tính năng được bật) import file Excel điểm rèn luyện học kỳ vào hệ thống để đỡ phải gõ tay.
- Là CVHT, tôi muốn export bảng điểm theo đúng mẫu Excel để nộp phòng CTSV.
- Là CVHT, tôi muốn xem thống kê xếp loại của lớp mình theo từng học kỳ/năm/khóa.
- Là CVHT, tôi muốn tra cứu nhanh điểm 1 SV theo MSSV hoặc CCCD.
- Là CVHT, tôi muốn hệ thống tự tính điểm cả năm và điểm toàn khóa khi đã có đủ điểm các HK.

**Trưởng khoa**
- Là Trưởng khoa, tôi muốn xem tổng hợp xếp loại các lớp trong khoa theo HK/Năm/Khóa.
- Là Trưởng khoa, tôi muốn export báo cáo TONG HOP-HK / TONG HOP-NH / TONG HOP-TK của khoa.
- Là Trưởng khoa, tôi muốn xem biểu đồ phân bố xếp loại theo lớp/khoa.

---

## 4. Mô hình dữ liệu (Database Schema)

Dùng Prisma + SQLite. Tất cả `id` là `String @id @default(cuid())`.

```prisma
// schema.prisma

model User {
  id           String    @id @default(cuid())
  username     String    @unique
  passwordHash String
  fullName     String
  email        String?
  phone        String?
  role         Role
  facultyId    String?
  faculty      Faculty?  @relation(fields: [facultyId], references: [id])
  isActive     Boolean   @default(true)
  advisedClasses Class[] @relation("ClassAdvisor")
  auditLogs    AuditLog[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

enum Role {
  ADMIN
  CVHT
  TRUONG_KHOA
}

model Faculty {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  users     User[]
  classes   Class[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Cohort {
  id        String   @id @default(cuid())
  name      String   @unique
  startYear Int
  endYear   Int
  classes   Class[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Class {
  id         String   @id @default(cuid())
  code       String   @unique
  name       String
  facultyId  String
  faculty    Faculty  @relation(fields: [facultyId], references: [id])
  cohortId   String
  cohort     Cohort   @relation(fields: [cohortId], references: [id])
  advisorId  String
  advisor    User     @relation("ClassAdvisor", fields: [advisorId], references: [id])
  students   Student[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Student {
  id           String   @id @default(cuid())
  studentCode  String   @unique
  citizenId    String   @unique
  fullName     String
  gender       Gender?
  dob          DateTime?
  classId      String
  class        Class    @relation(fields: [classId], references: [id])
  status       StudentStatus @default(ACTIVE)
  note         String?
  conductScores ConductScore[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum Gender { MALE FEMALE OTHER }
enum StudentStatus { ACTIVE SUSPENDED GRADUATED DROPPED }

model AcademicYear {
  id        String   @id @default(cuid())
  name      String   @unique
  startYear Int
  endYear   Int
  semesters Semester[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Semester {
  id             String   @id @default(cuid())
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  number         Int
  name           String
  isLocked       Boolean  @default(false)
  conductScores  ConductScore[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([academicYearId, number])
}

model ConductScore {
  id             String   @id @default(cuid())
  studentId      String
  student        Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  semesterId     String
  semester       Semester @relation(fields: [semesterId], references: [id])
  score          Int
  classification Classification
  note           String?
  createdById    String
  updatedById    String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([studentId, semesterId])
  @@index([semesterId])
  @@index([studentId])
}

enum Classification {
  XUAT_SAC
  TOT
  KHA
  TRUNG_BINH
  YEU
  KEM
  KHONG_XEP_LOAI
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String
  entityType String
  entityId   String?
  oldValue   String?
  newValue   String?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@index([entityType, entityId])
}
```

**Computed (không lưu DB, query khi cần):**
- **Điểm năm học** = round((HKI + HKII) / 2), số nguyên.
- **Điểm toàn khóa** = round(sum / count) các HK có điểm.
- **Xếp loại năm/toàn khóa** = tính lại từ điểm TB theo bảng quy tắc (mục 6).

---

## 5. Chức năng chi tiết

### 5.1. Authentication

- Trang đăng nhập: username + password.
- Mật khẩu hash bằng `bcrypt` (10 rounds).
- Phiên đăng nhập dùng `next-auth` (Credentials provider) trong HttpOnly cookie.
- Sau 30 phút không thao tác → logout tự động.
- Tài khoản Admin mặc định seed lần chạy đầu: `admin / Admin@123` (yêu cầu đổi password lần đầu đăng nhập).

### 5.2. Dashboard

- **Admin**: tổng số khoa/lớp/SV/CVHT; biểu đồ phân bố xếp loại toàn hệ thống HK gần nhất.
- **CVHT**: danh sách lớp phụ trách; số SV đã/chưa có điểm HK hiện tại; nút "Nhập điểm" và (nếu flag bật) "Import Excel".
- **Trưởng khoa**: tổng SV toàn khoa; biểu đồ tổng hợp xếp loại theo lớp; export báo cáo nhanh.

#### 5.2.1. Bộ lọc Năm học trên Dashboard (v1.6)

- Dashboard có **combobox "Năm học"** ở đầu trang để lọc toàn bộ card thống kê + biểu đồ theo năm học được chọn.
- **Nguồn dữ liệu options**: danh mục `AcademicYear` (mục 5.3.1) — nguồn duy nhất; sắp xếp năm mới nhất lên trước.
- **Mặc định**: năm học hiện hành (năm chứa HK gần nhất có dữ liệu điểm; nếu chưa có thì năm học mới nhất trong danh mục).
- Khi đổi năm học, các số liệu tính lại **server-side** cho năm đó (số SV đã/chưa có điểm, phân bố xếp loại, tổng hợp theo lớp). Không tin client.
- **Phạm vi dữ liệu giữ nguyên theo vai trò** (mục 6.4): Admin toàn hệ thống, CVHT chỉ lớp mình phụ trách, Trưởng khoa chỉ khoa mình — combobox chỉ thu hẹp theo năm học, không mở rộng quyền.
- Nếu năm học được chọn chưa có dữ liệu điểm → hiển thị trạng thái rỗng ("Chưa có dữ liệu điểm cho năm học này"), không lỗi.

### 5.3. Quản lý danh mục

CRUD cho: Khoa, Khóa học, Năm học, Học kỳ, Lớp, Sinh viên, Người dùng.

- **Admin**: tất cả entity.
- **CVHT**: chỉ Sinh viên (trong lớp mình phụ trách).
- **Học kỳ**: nút "Khóa học kỳ" (Admin) để ngăn sửa điểm sau khi đã chốt.
- **Sinh viên**: cho phép chuyển lớp, thay đổi trạng thái (active/suspended/graduated/dropped).
- **Lớp**: bắt buộc gán CVHT.

#### 5.3.1. Quản lý Năm học & Học kỳ (chi tiết)

Tab **"Năm học & Học kỳ"** trong Quản lý danh mục (chỉ **Admin**). Năm học là cha, Học kỳ là con (`Semester.academicYearId → AcademicYear`).

**Thêm/sửa Năm học** (`AcademicYear`):
- Form Dialog với các field:
  - `name` — tên hiển thị, vd `2025-2026` (bắt buộc, **UNIQUE**).
  - `startYear` — số nguyên 4 chữ số, vd `2025` (bắt buộc).
  - `endYear` — số nguyên 4 chữ số, vd `2026` (bắt buộc, phải `= startYear + 1`).
- Validation Zod: `startYear` trong khoảng 2000–2100; `endYear === startYear + 1`; `name` không trùng.
- **Gợi ý tự động**: khi nhập `startYear`, auto điền `endYear = startYear + 1` và `name = "${startYear}-${endYear}"` (vẫn cho sửa tay).
- Khi tạo Năm học mới, cho phép (tùy chọn) **tạo nhanh 2 học kỳ** HK1/HK2 kèm theo (checkbox "Tạo sẵn HK1 & HK2").

**Thêm/sửa Học kỳ** (`Semester`):
- Form Dialog với các field:
  - `academicYearId` — combobox chọn Năm học (bắt buộc).
  - `number` — số học kỳ trong năm: `1` hoặc `2` (bắt buộc). Ràng buộc **UNIQUE(academicYearId, number)** — không tạo trùng HK trong cùng năm.
  - `name` — tên hiển thị, vd `Học kỳ 1`, `Học kỳ 2` (bắt buộc). Gợi ý auto theo `number`.
  - `isLocked` — mặc định `false`; bật = khóa, mọi API sửa điểm cho HK này trả **403** và UI readonly.
- Validation Zod: `number ∈ {1, 2}`; cặp `(academicYearId, number)` chưa tồn tại.

**Hành vi & ràng buộc:**
- Bảng liệt kê Năm học (nhóm) → xổ danh sách Học kỳ con, hiển thị badge trạng thái Khóa/Mở và số bản ghi điểm đang gắn.
- **Không cho xóa** Năm học/Học kỳ nếu đang có `ConductScore` tham chiếu → hiện cảnh báo, đề xuất khóa thay vì xóa.
- Mọi thao tác thêm/sửa/xóa/khóa đều ghi **audit log** (`entityType = 'AcademicYear' | 'Semester'`).
- Các combobox chọn Học kỳ ở trang Nhập điểm, Import, Export đều lấy dữ liệu từ danh mục này (nguồn duy nhất).

### 5.4. Nhập điểm thủ công

> **Mục tiêu:** cho phép nhập/sửa điểm rèn luyện của **từng sinh viên** theo chiều **Lớp × Học kỳ × Năm học**, làm dữ liệu gốc để cấp **Giấy chứng nhận / Bảng điểm rèn luyện** của sinh viên.

**Bộ lọc bắt buộc trước khi nhập** (áp dụng cho cả 2 mode):
1. Chọn **Năm học** (từ danh mục mục 5.3.1).
2. Chọn **Học kỳ** (chỉ hiện các HK thuộc năm học đã chọn).
3. Chọn **Lớp** (CVHT chỉ thấy lớp mình phụ trách; Admin thấy tất cả).

Sau khi chọn đủ 3 chiều → bảng SV của lớp đó hiện ra để nhập điểm cho đúng học kỳ/năm học. Mỗi ô điểm ứng với đúng 1 `ConductScore` theo ràng buộc **UNIQUE(studentId, semesterId)**.

Trang `/scores` (CVHT + Admin) có **2 mode chuyển đổi qua tab**:

#### Mode A — Form Dialog đơn giản (mặc định, dùng được ngay sau khi xong CRUD)

- Filter: chọn Lớp + chọn Học kỳ.
- Bảng hiển thị: STT | CCCD | MSSV | Họ tên | Điểm | Xếp loại | Ghi chú | **Hành động** (Sửa / Xóa).
- Nút "**+ Thêm điểm**" mở Dialog:
  - Combobox chọn SV (tìm kiếm theo MSSV/Họ tên trong lớp, ẩn SV đã có điểm).
  - HK hiển thị readonly từ filter.
  - Input điểm 0-100; xếp loại auto hiện bên cạnh.
  - Input ghi chú.
  - Nút Lưu → POST `/api/scores`.
- Nút "Sửa" → Dialog tương tự (prefill).
- Nút "Xóa" → AlertDialog confirm.

#### Mode B — Bảng inline editable (nhập hàng loạt)

- Cùng filter chọn Lớp + HK.
- Bảng có cột Điểm và Ghi chú trở thành **editable cell**: click vào cell để sửa, blur lưu auto.
- Khi điểm thay đổi → cập nhật xếp loại auto bên cạnh (client-side `classifyScore`, server recompute lúc lưu).
- Nút "Lưu tất cả" footer (batch save với optimistic update).
- Có thanh tiến trình hiện số dòng đã lưu.

#### Quy tắc chung cho cả 2 mode

- Nếu Semester `isLocked=true` → toàn bảng readonly, ẩn các nút Thêm/Sửa/Xóa, hiện banner "Học kỳ đã chốt".
- Mỗi mutation ghi audit log với `oldValue`/`newValue` (JSON).
- Validation: điểm là integer 0-100; mỗi SV chỉ có 1 record cho 1 HK.
- Server-side recompute xếp loại trước khi lưu (không tin client).

#### Nhập điểm bằng Import Excel (phương thức thứ 3, ngoài 2 mode thủ công)

Ngoài nhập tay (Mode A/B), chức năng **Điểm rèn luyện** còn cho phép **nhập hàng loạt bằng Import Excel** từ *Bảng tổng hợp điểm rèn luyện học kỳ theo lớp*:

- Nút **"Import Excel"** hiển thị ngay trên trang `/scores`, chỉ khi:
  - `IMPORT_EXCEL_ENABLED=true` (feature flag), **và**
  - CVHT có quyền sửa lớp đang chọn, **và** Học kỳ chưa chốt (`isLocked=false`).
- Import ghi vào đúng **Lớp × Học kỳ × Năm học** đang chọn ở bộ lọc 3 chiều (mục 5.4) — không cần chọn lại đích.
- Preview đối chiếu từng dòng với `matchStatus` (matched / not_in_target_class / not_in_db) và `action` (create / overwrite / skip); dòng **"ghi đè"** mặc định **KHÔNG** chọn, CVHT tick mới cập nhật điểm đã có.
- (Tùy chọn) **Phân tích bằng AI (Google Gemini)** để nhận diện cột & chuẩn hoá dữ liệu khi file đổi định dạng theo năm — mục 5.5.2.
- **Xếp loại luôn recompute server-side** khi ghi; audit log `IMPORT_EXCEL` kèm số dòng tạo mới/ghi đè/lỗi.

> Chi tiết luồng upload → preview → commit, quy tắc parse (header dòng 7, dừng ở "THỐNG KÊ"…), ghi đè có kiểm soát và feature flag: **xem mục 5.5** (và 5.5.2 cho phần AI).

### 5.5. Import Excel (có feature flag)

> ⚠️ **Feature flag**: biến môi trường `IMPORT_EXCEL_ENABLED` trong `.env`.  
> - `IMPORT_EXCEL_ENABLED=false` (mặc định) → nút "Import Excel" ẩn trên UI; API `/api/import/excel` return 403.  
> - `IMPORT_EXCEL_ENABLED=true` → nút hiện, API hoạt động.  
>
> Mục đích: code đầy đủ, ready dùng, nhưng admin có thể tắt trong giai đoạn chưa muốn cho phép import (tránh nhập nhầm/dữ liệu sai).

> **Nguồn dữ liệu:** *Bảng tổng hợp điểm rèn luyện từng học kỳ theo lớp* — chính là sheet `HỌC KỲ` / `HỌC KỲ 2` trong file mẫu của trường. Mỗi lần import ứng với **1 lớp × 1 học kỳ × 1 năm học**.

**Flow khi flag bật:**
1. CVHT chọn loại import: **Theo học kỳ** (sheet `HỌC KỲ` / `HỌC KỲ 2`).
2. Chọn **Năm học → Học kỳ → Lớp** đích (đúng 3 chiều như mục 5.4; đây là nơi dữ liệu import sẽ ghi vào).
3. Upload file `.xls` / `.xlsx` (< 5MB).
4. Hệ thống parse bảng và hiển thị **preview** dạng bảng: STT | CCCD | Mã SV | Họ tên | Điểm | Xếp loại (recompute server-side) | Trạng thái đối chiếu.
5. CVHT xem preview, xử lý dòng cảnh báo (SV chưa có trong DB / điểm sai / trùng), rồi **xác nhận** → ghi vào DB.

**Quy tắc parse:**
- Sheet `HỌC KỲ`: header dòng 7 (`TT | CCCD | Mã SV | Họ tên | Điểm | Xếp loại | Ghi chú`), dữ liệu từ dòng 8.
- Sheet `HỌC KỲ 2`: tương tự.
- Đối chiếu SV qua **Mã SV** trước, fallback **CCCD**. Nếu chưa có SV trong DB → cảnh báo + cho phép tạo mới hoặc bỏ qua.
- **Xếp loại luôn recompute server-side** từ điểm (mục 6.1), **không tin cột "Xếp loại"** trong file Excel.
- **Ghi đè có kiểm soát**: nếu SV đã có điểm ở HK đích (trùng `UNIQUE(studentId, semesterId)`) → đánh dấu "sẽ ghi đè" trong preview, để CVHT quyết định (mặc định giữ nguyên, tick chọn để cập nhật).
- Chỉ ghi vào lớp/HK/năm học đã chọn ở bước 2; bỏ qua các dòng có Mã SV không thuộc lớp đích (cảnh báo trong preview).
- Tự ngắt khi gặp dòng "THỐNG KÊ:" hoặc dòng trống liên tiếp.
- Validate điểm integer 0–100; dòng sai → đánh dấu lỗi, không cho commit tới khi sửa/bỏ qua.
- Lưu audit log: `action = IMPORT_EXCEL`, kèm `filename` + Lớp/HK/Năm học đích + số dòng thành công/ghi đè/bỏ qua/lỗi.

**API:**
- `GET /api/config/features` → trả `{ importExcelEnabled: boolean }` cho client check.
- `POST /api/import/excel/preview` (multipart) → trả preview JSON.
- `POST /api/import/excel/commit` → ghi DB.
- Cả 2 API trên trả 403 nếu flag tắt.

### 5.5.2. Nhận diện & chuẩn hoá file Excel import bằng AI (Google Gemini)

> ⚠️ **Feature flag riêng**: `AI_IMPORT_ENABLED` trong `.env` (mặc định `false`) + biến `GEMINI_API_KEY`.
> - `AI_IMPORT_ENABLED=false` → toàn bộ chức năng AI ẩn; API `/api/import/excel/ai-analyze` trả **403**; luồng import chạy 100% bằng parser tất định (mục 5.5).
> - `AI_IMPORT_ENABLED=true` **và** có `GEMINI_API_KEY` hợp lệ → nút "Phân tích bằng AI" xuất hiện ở bước preview.
> - Cả 2 flag `IMPORT_EXCEL_ENABLED` và `AI_IMPORT_ENABLED` đều phải bật thì AI mới hoạt động (AI là phần mở rộng của Import Excel, không phải luồng độc lập).

**Vấn đề giải quyết:** File Excel bảng tổng hợp điểm rèn luyện của trường **thay đổi theo từng năm học** — đổi tên cột (`Mã SV` ↔ `MSSV` ↔ `Mã sinh viên`), đổi tên sheet (`HỌC KỲ` ↔ `HK1` ↔ `Học kỳ I`), thêm/xoá/xê dịch cột, gộp ô tiêu đề khác vị trí, và **một số ô dữ liệu chưa chuẩn** (điểm ghi kèm chữ "đ", MSSV thiếu số 0 đầu, CCCD 11 số, họ tên và mã bị đảo cột…). Parser tất định (mục 5.5) bám header cố định dòng 7 nên dễ gãy khi format lệch.

**Vai trò của AI (chỉ hỗ trợ, không quyết định):**
1. **Ánh xạ cột (column mapping)**: đọc vài dòng đầu của sheet (header + 3–5 dòng mẫu), đề xuất cột nào ứng với `stt | cccd | maSV | hoTen | diem | ghiChu`, kèm độ tin cậy (0–1) mỗi ánh xạ.
2. **Nhận diện sheet**: đoán sheet nào là "bảng điểm học kỳ" khi tên sheet khác mẫu.
3. **Gắn cờ dữ liệu nghi ngờ (anomaly flags)** theo dòng: điểm ngoài 0–100 hoặc có ký tự lạ, MSSV sai regex `^[0-9]{3}[A-Z]{3}[0-9]{3}$`, CCCD ≠ 12 số, nghi đảo cột Họ tên/Mã, dòng có vẻ là tiêu đề/thống kê lẫn vào — mỗi cờ kèm `reason` (tiếng Việt) + `suggestedValue` (giá trị chuẩn hoá đề xuất, nếu có).

**Ranh giới bắt buộc (an toàn dữ liệu):**
- AI **chỉ đề xuất**; mọi thay đổi phải được CVHT **duyệt thủ công** trên bảng preview trước khi commit. Không có đường ghi thẳng từ AI vào DB.
- **Xếp loại luôn recompute server-side** từ điểm (mục 6.1) — tuyệt đối không lấy xếp loại do AI/Excel cung cấp.
- **Ưu tiên parser tất định**: nếu parser tất định đã map đủ cột và không có dòng lỗi → **không gọi AI** (tiết kiệm chi phí + không gửi dữ liệu ra ngoài). AI chỉ kích hoạt khi: parser không tìm thấy header chuẩn, thiếu cột bắt buộc, hoặc CVHT bấm nút "Phân tích bằng AI".
- **Giá trị chuẩn hoá do AI đề xuất** (vd điểm `"85đ"` → `85`) phải qua lại validation Zod (integer 0–100…) ở server trước khi được chấp nhận.

**Quyền riêng tư (BẮT BUỘC nêu rõ cho người dùng):**
- Bật AI = **gửi dữ liệu file (header + các dòng SV: CCCD, MSSV, họ tên, điểm) tới Google Gemini API** để phân tích. Đây là dịch vụ ngoài, chạy trên internet — khác với phần còn lại của app (offline/localhost).
- Vì vậy flag mặc định **OFF**. UI phải hiện cảnh báo "Dữ liệu sẽ được gửi tới dịch vụ AI (Google Gemini) để phân tích" và yêu cầu CVHT xác nhận (checkbox) trước lần chạy đầu.
- Ghi audit log `action = AI_ANALYZE_IMPORT` kèm `{ filename, sheet, rowsAnalyzed }` (không log nội dung điểm chi tiết vào oldValue/newValue).

**Kỹ thuật (chốt theo Tech Stack):**
- SDK: `@google/genai` (Google GenAI SDK chính thức). Model mặc định `gemini-3.5-flash` (rẻ, nhanh, đủ cho tác vụ nhận diện cấu trúc); cho phép cấu hình `GEMINI_MODEL` để đổi sang model mạnh hơn tuỳ nhu cầu.
- Dùng **Structured Output** của Gemini để ép JSON đúng schema: cấu hình `responseMimeType: "application/json"` + `responseSchema` (JSON schema tương ứng `AiImportAnalysisSchema`). **KHÔNG** parse thủ công text tự do.
- Prompt đưa vào: tên các sheet, header dòng 1–7 và tối đa ~15 dòng dữ liệu mẫu (đủ để AI nhận diện, không gửi toàn bộ file nếu không cần). Với file > 200 dòng, chỉ gửi mẫu để lấy ánh xạ cột rồi áp ánh xạ đó cho toàn file bằng code tất định.
- Server-side validate lại toàn bộ output AI bằng Zod (schema `AiImportAnalysisSchema`) trước khi trả về client — không tin cấu trúc trả về từ model dù đã khai báo `responseSchema`.
- Xử lý lỗi: hết quota/`GEMINI_API_KEY` sai/timeout → trả thông báo tiếng Việt, tự động fallback về parser tất định (không chặn CVHT nhập tay).

**Schema kết quả AI (server trả cho client, dạng preview):**
```jsonc
{
  "sheetGuess": "HỌC KỲ",                 // sheet AI cho là bảng điểm HK
  "columnMapping": {                       // index cột (0-based) + độ tin cậy
    "stt":    { "col": 0, "confidence": 0.98 },
    "cccd":   { "col": 1, "confidence": 0.95 },
    "maSV":   { "col": 2, "confidence": 0.99 },
    "hoTen":  { "col": 3, "confidence": 0.97 },
    "diem":   { "col": 4, "confidence": 0.90 },
    "ghiChu": { "col": 6, "confidence": 0.60 }
  },
  "rowAnomalies": [
    { "row": 12, "field": "diem",  "value": "85đ",       "suggestedValue": "85",       "reason": "Điểm có ký tự thừa 'đ'" },
    { "row": 15, "field": "maSV",  "value": "21CTT006",  "suggestedValue": "221CTT006","reason": "MSSV thiếu 1 số đầu so với regex" },
    { "row": 20, "field": "cccd",  "value": "0123456789","suggestedValue": null,       "reason": "CCCD chỉ có 10 số, cần kiểm tra tay" }
  ]
}
```

**Flow người dùng (khi 2 flag bật):**
1. CVHT chọn Năm học → Học kỳ → Lớp và upload file như mục 5.5.
2. Parser tất định thử map trước. Nếu OK và không lỗi → preview bình thường (không gọi AI).
3. Nếu map lỗi/thiếu cột, hoặc CVHT bấm "Phân tích bằng AI" → hiện cảnh báo quyền riêng tư → gọi `POST /api/import/excel/ai-analyze`.
4. Client hiển thị: ánh xạ cột AI đề xuất (cho CVHT sửa lại combobox cột) + danh sách dòng nghi ngờ (mỗi dòng có nút "Áp giá trị đề xuất" / "Bỏ qua").
5. CVHT duyệt → hệ thống dựng lại bảng theo ánh xạ đã chốt → **preview chuẩn của 5.5** (recompute xếp loại server-side) → commit.

**API:**
- `POST /api/import/excel/ai-analyze` (multipart hoặc JSON các dòng đã đọc) → trả `AiImportAnalysisSchema`. Trả **403** nếu `AI_IMPORT_ENABLED=false` hoặc thiếu `GEMINI_API_KEY`. Trả 502 + thông báo tiếng Việt nếu gọi Gemini thất bại.
- `GET /api/config/features` bổ sung trường `{ aiImportEnabled: boolean }` để client ẩn/hiện nút.

### 5.6. Seed dữ liệu CLI (chạy 1 lần lúc cài đặt)

**Mục đích:** đưa nhanh dữ liệu cũ từ file Excel có sẵn vào hệ thống. Đây là tool cho admin/dev, không có UI.

**Lệnh:**
```
npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls
```

**Hành vi:**
- Đọc 4 sheet: `HỌC KỲ`, `HỌC KỲ 2`, `NĂM HỌC`, `KHÓA HỌC`.
- Tạo Khoa / Lớp / Khóa / Năm học / HK / SV / Điểm tương ứng.
- Idempotent: chạy lại không tạo trùng, chỉ update nếu khác.
- In log: số bản ghi đã tạo / cập nhật / bỏ qua.
- Ghi audit log với `user = 'SYSTEM_SEED'`.

### 5.7. Export Excel

**Phải xuất ra đúng mẫu file đính kèm**, gồm 4 loại:

1. **Export theo Học kỳ** (CVHT, theo lớp): sheet `HỌC KỲ` hoặc `HỌC KỲ 2`. Đầy đủ:
   - Tiêu đề: KHOA, LỚP, "BẢNG KẾT QUẢ RÈN LUYỆN…", Học kỳ, Năm học.
   - Bảng SV.
   - Block "THỐNG KÊ" với 7 xếp loại + tỉ lệ %.
   - Dòng "Đắk Lắk, ngày … tháng … năm …".
   - 3 cột chữ ký: Trưởng khoa, Cố vấn học tập, Lớp trưởng.

2. **Export theo Năm học** (CVHT, theo lớp): sheet `NĂM HỌC`, cột HKI + XL + HKII + XL + Cả năm + XL.

3. **Export theo Khóa học** (CVHT, theo lớp): sheet `KHÓA HỌC`, 8 cột HK I–VIII + Điểm TOÀN KHÓA + Xếp loại.

4. **Export Tổng hợp Khoa** (Trưởng khoa): 1 file 3 sheet `TONG HOP-HK`, `TONG HOP-NH`, `TONG HOP-TK`, mỗi dòng là 1 lớp với số lượng SV theo từng xếp loại + tỉ lệ %.

**Yêu cầu format:** dùng `exceljs`. Font Times New Roman 11, header in đậm, border đầy đủ, merge các cell tiêu đề đúng như file mẫu. **Trước khi code, đọc file mẫu bằng `exceljs` để học từng cell formatting** rồi clone format ra file mới (dùng template file).

### 5.8. Tra cứu

Thanh tìm kiếm global trên header:
- Nhập MSSV (vd `221CTT006`) hoặc CCCD → trang chi tiết SV với tất cả điểm các HK + biểu đồ điểm theo thời gian.
- Filter nâng cao: Khoa / Lớp / Năm học / Học kỳ / Xếp loại.

### 5.9. Thống kê & Biểu đồ

Dùng `recharts`:
- **Biểu đồ cột**: phân bố xếp loại theo HK của 1 lớp.
- **Biểu đồ đường**: xu hướng điểm trung bình lớp qua các HK.
- **Biểu đồ tròn (pie)**: tỉ lệ xếp loại của khoa trong 1 năm học.
- **Bảng so sánh**: các lớp trong khoa cạnh nhau.

### 5.10. Audit Log

- Mỗi thao tác CRUD lên `ConductScore`, `Student`, `User`, `Class` → ghi 1 record.
- Mọi lần import/export → ghi log.
- Mọi lần seed CLI → ghi log (user system).
- Login/logout → ghi log.
- Admin xem toàn bộ; CVHT xem log của mình.
- Filter theo: user, action, entityType, khoảng ngày.

---

## 6. Quy tắc nghiệp vụ

### 6.1. Tính xếp loại tự động

```typescript
function classifyScore(score: number, studentStatus: StudentStatus): Classification {
  if (studentStatus === 'SUSPENDED') return 'KHONG_XEP_LOAI';
  if (score >= 90) return 'XUAT_SAC';
  if (score >= 80) return 'TOT';
  if (score >= 65) return 'KHA';
  if (score >= 50) return 'TRUNG_BINH';
  if (score >= 35) return 'YEU';
  return 'KEM';
}
```

### 6.2. Tính điểm năm học

`điểm năm = round((điểm HKI + điểm HKII) / 2)`. Thiếu 1 HK → hiện "—".

### 6.3. Tính điểm toàn khóa

`điểm toàn khóa = round(sum / count)` các HK có điểm. < 8 HK → đánh dấu "chưa đủ" trong báo cáo.

### 6.4. Quyền truy cập dữ liệu (Row-level)

- CVHT: `WHERE classes.advisorId = currentUser.id`.
- Trưởng khoa: `WHERE classes.facultyId = currentUser.facultyId` (chỉ đọc).
- Admin: không filter.

### 6.5. Validation

- MSSV: regex `^[0-9]{3}[A-Z]{3}[0-9]{3}$`.
- CCCD: đúng 12 chữ số.
- Điểm: integer 0-100.
- Mỗi SV chỉ có 1 record điểm cho 1 HK.

---

## 7. Đặc tả Import/Export Excel chi tiết

### 7.1. Cấu trúc file mẫu (tham chiếu)

File `DC22CTT01-II-25-26.xls`, gồm 7 sheet:

| Sheet | Mục đích | Dòng header | Cột dữ liệu chính |
|---|---|---|---|
| `HỌC KỲ` | Điểm HK1 | 7 | TT, CCCD, MaSV, HoTen, Diem, XepLoai, GhiChu |
| `HỌC KỲ 2` | Điểm HK2 | 7 | (như trên) |
| `NĂM HỌC` | Tổng hợp 1 năm | 7 | TT, CCCD, MaSV, HoTen, HKI, XL, HKII, XL, CaNam, XL, GhiChu |
| `KHÓA HỌC` | Tổng hợp 4 năm | 7 | TT, CCCD, MaSV, HoTen, HKI..HKVIII (8 cột), ToanKhoa, XepLoai, GhiChu |
| `TONG HOP-HK` | Khoa, theo HK | 7-8 (2 dòng) | STT, Lop, SL, XS, %, Tot, %, Kha, %, TB, %, Yeu, %, Kem, %, GhiChu |
| `TONG HOP-NH` | Khoa, theo Năm | (như trên) | (như trên) |
| `TONG HOP-TK` | Khoa, toàn khóa | (như trên) | (như trên) |

### 7.2. Yêu cầu khi export

- **Không tự "đẹp hóa"** — phải khớp 1:1 với file mẫu: merge cell, border, font, alignment, row height.
- Tiêu đề cố định: `CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM` / `Độc lập - Tự do - Hạnh phúc` ở góc phải trên.
- Cuối bảng: dòng "Đắk Lắk, ngày … tháng … năm …" (lấy ngày export); 3 cột chữ ký.
- Block "THỐNG KÊ" cuối sheet với 7 dòng xếp loại + Tổng cộng, có cột Số lượng + Tỉ lệ %.

### 7.3. Approach kỹ thuật

**Đề xuất**: tạo file template `templates/mau-rl-hocky.xlsx`, `mau-rl-namhoc.xlsx`, `mau-rl-khoahoc.xlsx`, `mau-tonghop-khoa.xlsx`. Khi export, dùng `exceljs` load template, ghi đè dữ liệu vào các cell xác định trước → giữ nguyên 100% format.

---

## 8. Giao diện & UX

### 8.1. Layout chung

- **Sidebar trái** (thu gọn được): Dashboard, Sinh viên, Điểm rèn luyện, Tra cứu, Thống kê, Quản lý danh mục (chỉ Admin), Audit log, Tài khoản.
- **Topbar**: tên app, thanh tìm kiếm global, badge tên người dùng + dropdown logout.
- Theme sáng/tối (light/dark toggle).
- Font: `Inter` cho UI, `Times New Roman` chỉ dùng trong file Excel export.

### 8.2. Màn hình chính

1. **Login** — form đơn giản.
2. **Dashboard** — card thống kê + biểu đồ.
3. **Danh sách lớp** — table có search + filter khoa, khóa.
4. **Chi tiết lớp** — info lớp + tabs `Sinh viên` / `Điểm các HK` / `Tổng hợp năm` / `Tổng hợp khóa`.
5. **Điểm rèn luyện** (`/scores`) — tab chuyển giữa "Form Dialog" và "Bảng inline"; nút "+ Thêm điểm", "Export Excel", và "Import Excel" (chỉ hiện khi flag bật).
6. **Chi tiết sinh viên** — info SV + bảng điểm theo HK + biểu đồ tiến triển.
7. **Tra cứu** — search nâng cao.
8. **Thống kê** — chọn phạm vi (lớp/khoa) + loại biểu đồ.
9. **Audit log** — table có filter ngày, user, action.
10. **Quản lý danh mục** — tabs cho từng entity.

### 8.3. Yêu cầu UX

- Loading skeleton cho mọi data fetch.
- Toast notification (sonner / shadcn toast) cho mọi action.
- Confirm dialog cho mọi action xóa.
- Phím tắt: `Ctrl+S` lưu (bảng inline), `Ctrl+K` mở search.
- Responsive desktop-first.

---

## 9. Yêu cầu phi chức năng

- **Hiệu năng**: load danh sách 200 SV < 500ms. Import file 200 dòng < 3s.
- **Bảo mật**: hash password, CSRF protection (Next.js mặc định), validate input ở cả client + server (Zod).
- **Backup**: nút "Sao lưu DB" trong Admin → tạo file `backup-YYYYMMDD-HHmm.db` ở thư mục `./backups`.
- **Khởi chạy**: `npm install && npm run db:migrate && npm run db:seed && npm run dev` chạy được trên Windows/macOS/Linux.

---

## 10. Tech Stack & Kiến trúc

| Lớp | Công nghệ |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Form & Validation | react-hook-form + Zod |
| State (client) | React state + TanStack Query |
| ORM | Prisma 5 |
| DB | SQLite (file `prisma/dev.db`) |
| Auth | next-auth v5 (Credentials) |
| Excel I/O | exceljs (đọc/ghi `.xlsx`), `xlsx` (fallback cho `.xls` cũ) |
| AI nhận diện import | `@google/genai` (Google Gemini) — model mặc định `gemini-3.5-flash`, cấu hình qua `GEMINI_MODEL`; dùng Structured Output (`responseMimeType: application/json` + `responseSchema`) |
| Charts | recharts |
| Bcrypt | bcryptjs |
| Notification | sonner |
| Testing | vitest + playwright (smoke test) |
| Feature flag | biến môi trường `.env` (`IMPORT_EXCEL_ENABLED`, `AI_IMPORT_ENABLED`) |

---

## 11. Cấu trúc thư mục đề xuất

```
diem-renluyen/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                  # tạo admin mặc định
│   └── migrations/
├── scripts/
│   └── seed-excel.ts            # CLI: npm run seed:excel
├── sample/
│   └── DC22CTT01-II-25-26.xls
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── classes/[id]/
│   │   │   ├── students/[id]/
│   │   │   ├── scores/          # Tab Form + Tab Inline
│   │   │   ├── search/
│   │   │   ├── stats/
│   │   │   ├── admin/
│   │   │   └── audit-logs/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── classes/
│   │   │   ├── students/
│   │   │   ├── scores/
│   │   │   ├── import/excel/    # đứng sau feature flag
│   │   │   ├── export/excel/
│   │   │   ├── config/features/
│   │   │   └── stats/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/
│   │   ├── tables/
│   │   ├── charts/
│   │   └── forms/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── classification.ts
│   │   ├── excel-import.ts
│   │   ├── excel-export.ts
│   │   ├── excel-seed-parser.ts
│   │   ├── features.ts          # đọc flag từ env
│   │   └── audit.ts
│   └── types/
├── templates/
│   ├── mau-rl-hocky.xlsx
│   ├── mau-rl-namhoc.xlsx
│   ├── mau-rl-khoahoc.xlsx
│   └── mau-tonghop-khoa.xlsx
├── backups/
├── public/
├── .env                         # IMPORT_EXCEL_ENABLED=false
├── .env.example
├── package.json
└── README.md
```

### File `.env.example` mẫu

```
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="thay-bang-chuoi-bi-mat-32-ky-tu"
NEXTAUTH_URL="http://localhost:3000"

# Feature flags
IMPORT_EXCEL_ENABLED=false

# AI nhận diện file Excel import (mục 5.5.2) — mặc định OFF
# Bật = gửi dữ liệu file tới Google Gemini API để phân tích (dịch vụ ngoài)
AI_IMPORT_ENABLED=false
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-3.5-flash"   # có thể đổi sang model mạnh hơn
```

---

## 12. Acceptance Criteria (MVP)

PRD được coi là hoàn thành khi:

- [ ] Admin đăng nhập, tạo được 1 khoa, 1 khóa, 2 lớp, 2 CVHT, 1 Trưởng khoa.
- [ ] Admin thêm được 1 Năm học mới (vd `2026-2027`) và 2 Học kỳ (HK1, HK2) trong Quản lý danh mục; không tạo được HK trùng `number` trong cùng năm học (báo lỗi).
- [ ] Sau khi chọn Năm học → Học kỳ → Lớp, CVHT nhập được điểm cho từng SV; combobox HK chỉ hiện HK thuộc năm học đã chọn.
- [ ] Khi flag bật: import *Bảng tổng hợp điểm HK theo lớp* vào đúng Lớp/HK/Năm học đã chọn; preview hiển thị dòng "sẽ ghi đè" khi SV đã có điểm; xếp loại được recompute server-side, không lấy từ cột Excel.
- [ ] Khi `AI_IMPORT_ENABLED=false` (hoặc thiếu `GEMINI_API_KEY`): nút "Phân tích bằng AI" ẨN; gọi trực tiếp `/api/import/excel/ai-analyze` trả **403**; import vẫn chạy được bằng parser tất định.
- [ ] Khi `AI_IMPORT_ENABLED=true`: với file đổi tên cột/sheet, AI đề xuất ánh xạ cột + gắn cờ dòng nghi ngờ (điểm có ký tự lạ, MSSV sai regex); CVHT duyệt trước khi commit; xếp loại vẫn recompute server-side (không lấy từ AI); có cảnh báo quyền riêng tư trước lần chạy đầu và audit log `AI_ANALYZE_IMPORT`.
- [ ] CVHT đăng nhập, thấy đúng lớp được gán, không thấy lớp khác.
- [ ] Chạy `npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls` thành công → 14 SV + điểm các HK đã trong DB.
- [ ] CVHT thêm 1 điểm mới qua Mode A (Dialog) → xếp loại auto đúng.
- [ ] CVHT nhập điểm qua Mode B (bảng inline) → blur lưu auto, xếp loại update real-time.
- [ ] Khi `IMPORT_EXCEL_ENABLED=false`: nút "Import Excel" ẨN trên UI; gọi trực tiếp API trả 403.
- [ ] Khi `IMPORT_EXCEL_ENABLED=true`: nút hiện; import được file `DC22CTT01-II-25-26.xls` (sheet HỌC KỲ) → 14 SV vào DB chính xác.
- [ ] Export file Excel theo mẫu HỌC KỲ → mở file đối chiếu, **không lệch cell nào** so với file mẫu.
- [ ] Tra cứu MSSV `221CTT006` → trang SV với điểm đầy đủ các HK.
- [ ] Trưởng khoa xem được biểu đồ tổng hợp khoa.
- [ ] Trưởng khoa export `TONG HOP-HK` với 3 lớp test.
- [ ] Trưởng khoa **không thể** gọi API POST/PATCH/DELETE `/api/scores` (return 403).
- [ ] Mọi thao tác sửa điểm đều xuất hiện trong audit log.
- [ ] `npm run dev` khởi chạy thành công trên máy Windows lần đầu.

---

## 13. Roadmap MVP (6 tuần)

| Tuần | Nội dung |
|---|---|
| 1 | Init project, Prisma schema, migration, seed admin, layout cơ bản, auth, **feature flag system** |
| 2 | CRUD danh mục (Khoa/Khóa/Lớp/SV/HK/Năm học/User) |
| 3 | Logic xếp loại + Nhập điểm Mode A (Dialog) + Mode B (inline) + CLI seed Excel + Audit log |
| 4 | Export Excel theo mẫu (4 loại) + Import Excel (sau feature flag) + AI nhận diện file import (mục 5.5.2, sau flag `AI_IMPORT_ENABLED`) |
| 5 | Tra cứu + Thống kê + Biểu đồ |
| 6 | Polish UX, Backup, Test E2E, viết README |

---

## 14. Prompt mẫu để bắt đầu với Claude Code

> Dán prompt sau vào Claude Code (kèm PRD này ở cùng folder):

```
Tôi muốn xây dựng ứng dụng "Quản lý Điểm Rèn luyện Sinh viên" theo PRD trong
file PRD-DiemRenLuyen.md (v1.2).

Lưu ý đặc biệt v1.2:
- Tính năng "Nhập điểm thủ công" có 2 mode (Dialog + Inline editable) - làm cả 2.
- Tính năng "Import Excel" implement đầy đủ NHƯNG đứng sau feature flag
  IMPORT_EXCEL_ENABLED (mặc định = false → ẩn nút UI + API trả 403).

Bắt đầu giúp tôi từ Tuần 1 trong Roadmap (mục 13). Confirm hiểu yêu cầu rồi bắt đầu.
```

Sau khi xong Tuần 1, tiếp tục từng tuần với prompt trong file `CLAUDE-CODE-PROMPTS.md`.

---

## Phụ lục: Dữ liệu mẫu sẵn có từ file `DC22CTT01-II-25-26.xls`

- Khoa: **KHOA KHTN và CNTT**
- Lớp: **DC22CTT01** (14 SV, khóa 2022-2026)
- CVHT: **Hồ Thị Duyên**
- Lớp trưởng: **Nguyễn Trùng Khánh** (MSSV 221CTT016)
- Năm học hiện tại: **2025-2026** (HK1 và HK2 đã có điểm)
- Toàn bộ 8 HK (khóa học 2022-2026) đã có điểm trong sheet `KHÓA HỌC`.
- Các lớp khác (xuất hiện trong TONG HOP-HK): **DC22STI01** (3 SV), **DHC23CTT01** (23 SV).

— Hết PRD —
