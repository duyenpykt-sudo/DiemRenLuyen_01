# Hướng dẫn dùng Claude Code cho Dự án

> File này hướng dẫn bạn từ A đến Z cách dùng Claude Code (CLI) để xây dựng ứng dụng **Quản lý Điểm Rèn luyện Sinh viên** theo PRD đã có.

---

## 📋 Tóm tắt nhanh

Bạn sẽ thực hiện 6 giai đoạn lớn:

1. **Cài Claude Code lên máy** (~5 phút)
2. **Đăng nhập tài khoản Claude** (~2 phút)
3. **Chuẩn bị thư mục dự án** (~5 phút)
4. **Khởi động Claude Code, nạp ngữ cảnh PRD** (~10 phút)
5. **Chạy lần lượt 6 tuần Roadmap** (~6 tuần thực tế)
6. **Kiểm thử & đóng gói** (~1 tuần)

Tổng thời gian thực tế ~6–8 tuần làm part-time, hoặc 2–3 tuần nếu làm full-time.

---

## 🛠️ PHẦN 1 — Cài đặt Claude Code

### 1.1. Yêu cầu

- Máy tính: Windows 10/11, macOS 12+, hoặc Linux (Ubuntu 22.04+).
- Đã cài Node.js 20+ (cho project Next.js).
- Đã cài Git.
- **Tài khoản trả phí**: Claude Pro / Max / Team / Enterprise, hoặc Claude Console (API có credit).

### 1.2. Cài Claude Code

Chọn 1 trong các cách dưới đây (khuyên dùng **Native Installer**).

#### Cách A — Native Installer (khuyến nghị, không cần Node.js)

**macOS / Linux / WSL**:
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Windows PowerShell** (nhận biết bằng prompt `PS C:\>`):
```powershell
irm https://claude.ai/install.ps1 | iex
```

**Windows CMD** (nhận biết bằng prompt `C:\>`):
```bat
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

#### Cách B — Homebrew (macOS / Linux)
```bash
brew install --cask claude-code
```

#### Cách C — WinGet (Windows)
```powershell
winget install Anthropic.ClaudeCode
```

#### Cách D — npm (cần Node.js)
```bash
npm install -g @anthropic-ai/claude-code
```

### 1.3. Kiểm tra cài đặt

Mở terminal mới, gõ:
```bash
claude --version
```

Nếu hiện số phiên bản → cài thành công. Nếu báo `command not found` → đóng hẳn terminal, mở lại; vẫn lỗi thì kiểm tra biến PATH.

> 💡 **Windows native**: nên cài thêm [Git for Windows](https://git-scm.com/downloads/win) để Claude Code dùng được Bash thay vì PowerShell.

---

## 🔐 PHẦN 2 — Đăng nhập tài khoản

Mở terminal, chạy:
```bash
claude
```

Lần đầu sẽ tự mở trình duyệt yêu cầu đăng nhập. Đăng nhập bằng:
- **Claude Pro/Max/Team/Enterprise** (khuyến nghị nếu bạn dùng nhiều).
- Hoặc **Claude Console** (API trả tiền theo lượng dùng).

Sau khi xác thực, quay lại terminal → đã sẵn sàng.

**Đổi tài khoản sau này**: gõ `/login` trong phiên Claude Code.

---

## 📁 PHẦN 3 — Chuẩn bị thư mục dự án

### 3.1. Tạo cấu trúc thư mục

Mở terminal, chạy:
```bash
mkdir diem-renluyen
cd diem-renluyen
git init
mkdir docs sample
```

### 3.2. Copy các file đã chuẩn bị

Cấu trúc sau khi copy xong (6 file):

```
diem-renluyen/
├── README.md                       ← Đặt ở root
├── CLAUDE.md                       ← Đặt ở root  
├── PRD-DiemRenLuyen.md             ← Đặt ở root
├── .gitignore                      ← Đặt ở root
├── docs/
│   ├── CLAUDE-CODE-PROMPTS.md      ← Đặt trong docs/
│   ├── README-Quick-Start.md       ← Đặt trong docs/
│   └── HUONG-DAN-CLAUDE-CODE.md    ← (file này) đặt trong docs/
└── sample/
    └── DC22CTT01-II-25-26.xls      ← Đặt trong sample/
```

### 3.3. Commit ban đầu

```bash
git add .
git commit -m "chore: initial PRD and documentation"
```

> ⚠️ **Quan trọng**: commit ngay bây giờ. Nếu sau này Claude Code làm sai, bạn có thể rollback về điểm này.

---

## 🚀 PHẦN 4 — Khởi động Claude Code & nạp PRD

### 4.1. Mở Claude Code trong thư mục dự án

```bash
cd diem-renluyen
claude
```

Bạn sẽ thấy màn hình chào với phiên bản, model, và thư mục hiện tại.

### 4.2. Kiểm tra Claude Code đã đọc CLAUDE.md

Trước tiên, gõ:
```
what does this project do?
```

Claude Code sẽ tự đọc `CLAUDE.md` và `README.md` để trả lời. Nếu Claude trả lời đúng (về ứng dụng quản lý điểm rèn luyện, tech stack Next.js, 6 tuần roadmap…) → ngữ cảnh OK.

### 4.3. Dán Prompt khởi đầu (kiểm tra hiểu PRD)

Mở file `docs/CLAUDE-CODE-PROMPTS.md`, copy đoạn **"Prompt khởi đầu"**:

```
Đọc file PRD-DiemRenLuyen.md trong thư mục hiện tại. Tóm tắt cho tôi:
1. Mục tiêu chính của app
2. Tech stack đã chốt
3. Mô hình dữ liệu (số bảng, các quan hệ chính)
4. Các milestone tuần
5. Feature flag IMPORT_EXCEL_ENABLED dùng làm gì
Sau khi tóm tắt, đợi tôi xác nhận trước khi bắt đầu code.
```

Dán vào Claude Code, nhấn Enter. Đọc kỹ phần tóm tắt. Nếu:
- ✅ Tóm tắt đúng → trả lời `Tôi xác nhận. Bắt đầu Tuần 1.`
- ❌ Tóm tắt sai/thiếu → chỉnh lại: `Mục X bạn hiểu sai. Đọc lại mục Y của PRD và sửa.`

---

## 🗓️ PHẦN 5 — Chạy 6 tuần Roadmap

### 5.1. Quy trình chuẩn cho mỗi tuần

1. **Đọc lại mục Roadmap tuần đó trong PRD** (mục 13).
2. **Copy prompt tuần đó** từ `docs/CLAUDE-CODE-PROMPTS.md`.
3. **Dán vào Claude Code**, Enter.
4. **Phê duyệt từng thay đổi** (xem mục 5.2 bên dưới).
5. **Test thủ công** theo Acceptance Criteria (mục 12 PRD).
6. **Commit** code:
   ```bash
   git add .
   git commit -m "feat: Tuần N — <tóm tắt>"
   ```
7. **Clear context** trước khi sang tuần mới:
   ```
   /clear
   ```
   Sau đó dán prompt tuần kế tiếp.

### 5.2. Cách phê duyệt thay đổi

Khi Claude đề xuất sửa/tạo file, bạn sẽ thấy:
```
Claude wants to edit src/app/page.tsx
[1] Approve once
[2] Approve and don't ask again for this file
[3] Approve all (auto-accept mode for this session)
[4] Reject
```

**Khuyến nghị**:
- **Tuần 1–2**: chọn `[1]` từng file để hiểu Claude đang làm gì.
- **Tuần 3 trở đi**: chọn `[3]` (Accept all) cho các file `.tsx`, `.ts` để chạy nhanh hơn — nhưng vẫn review qua sau khi xong.
- **Tuyệt đối review** khi Claude sửa: `prisma/schema.prisma`, `.env`, `package.json`, file template Excel.

### 5.3. Các slash command thường dùng

Gõ trong phiên Claude Code:

| Command | Tác dụng |
|---|---|
| `/help` | Xem tất cả lệnh |
| `/clear` | Xóa lịch sử hội thoại, giảm context (làm trước mỗi tuần mới) |
| `/resume` | Tiếp tục phiên trước (nếu lỡ thoát) |
| `/login` | Đổi tài khoản / xác thực lại |
| `/exit` | Thoát Claude Code (hoặc Ctrl+D) |
| `/` | Xem danh sách lệnh + skill |

### 5.4. Phím tắt hữu ích

| Phím | Tác dụng |
|---|---|
| `Tab` | Hoàn thành lệnh |
| `↑` | Lịch sử lệnh đã gõ |
| `Shift+Tab` | Chuyển chế độ permission (ask/accept/plan) |
| `?` | Xem hết phím tắt |
| `Ctrl+C` | Dừng phản hồi đang chạy |

### 5.5. Plan Mode — khi nào dùng?

**Plan Mode** = chế độ Claude vạch kế hoạch trước, không sửa file. Nhấn `Shift+Tab` 2 lần để vào.

Dùng Plan Mode khi:
- Bắt đầu mỗi tuần mới → để Claude vạch kế hoạch trước khi code.
- Yêu cầu refactor lớn.
- Khi specs phức tạp (vd Tuần 4 — Export Excel).

Sau khi xem plan ưng ý → trả lời `Bắt đầu thực hiện kế hoạch` để Claude chuyển sang chế độ code thực sự.

---

## 🧪 PHẦN 6 — Workflow cụ thể từng tuần

### Tuần 1 — Init project

```bash
# Bạn đang trong terminal, ở folder diem-renluyen
claude
```

Sau khi đăng nhập, dán **Prompt Tuần 1** từ `docs/CLAUDE-CODE-PROMPTS.md`.

Trong quá trình chạy, Claude Code sẽ:
- Chạy `npx create-next-app@latest .` → tạo project Next.js (xác nhận khi hỏi).
- Cài các package (Tailwind, shadcn/ui, Prisma…) → có thể mất 3–5 phút.
- Tạo `schema.prisma`, `seed.ts`, layout, login page, dashboard.

**Sau khi Claude báo xong**, mở terminal mới (giữ phiên Claude Code), chạy:
```bash
npm run dev
```

Mở `http://localhost:3000/login`, đăng nhập `admin / Admin@123` → vào được dashboard là OK.

Test:
```bash
curl http://localhost:3000/api/config/features
# Phải trả về: {"importExcelEnabled": false}
```

Commit:
```bash
git add .
git commit -m "feat: Tuần 1 — init project + auth + feature flag"
```

Trong Claude Code: `/clear` → sẵn sàng cho Tuần 2.

---

### Tuần 2 — CRUD danh mục

Dán **Prompt Tuần 2**. Claude sẽ tạo các trang `/admin/*`. 

Test thủ công:
- Đăng nhập admin → tạo 1 Khoa, 1 Lớp, 1 SV.
- Xóa rồi tạo lại → kiểm tra audit log.

Commit + `/clear`.

---

### Tuần 3 — Nhập điểm + CLI seed

Đây là tuần phức tạp. Dán **Prompt Tuần 3**.

**Bước kiểm thử CLI seed:**
```bash
npm run seed:excel -- --file=./sample/DC22CTT01-II-25-26.xls
```
→ Phải thấy 14 SV + điểm 8 HK trong DB. Kiểm tra qua Prisma Studio:
```bash
npx prisma studio
```

**Test nhập điểm**:
- Đăng nhập `hothiduyen / Cvht@123`.
- Vào `/scores` → chọn lớp DC22CTT01 + HK1.
- Tab "Form Dialog" → thêm 1 điểm → xếp loại auto đúng.
- Tab "Bảng inline" → click cell, sửa, blur lưu auto.

**Test biên xếp loại**:
- Nhập điểm 89 → "Khá".
- Nhập 90 → "Tốt".

Commit + `/clear`.

---

### Tuần 4 — Excel I/O (TUẦN KHÓ NHẤT)

Khuyên dùng **Plan Mode** (Shift+Tab 2 lần) trước khi dán prompt. Để Claude vạch kế hoạch chi tiết.

Dán **Prompt Tuần 4**. Theo dõi sát từng bước. 

**Bước test cực kỳ quan trọng:**

1. Export file Excel mẫu cho lớp DC22CTT01, HK1 → file `xuat-HK1-DC22CTT01.xlsx`.
2. Mở **CẢ HAI** file trong Excel/LibreOffice cạnh nhau:
   - File mẫu gốc `sample/DC22CTT01-II-25-26.xls` (sheet HỌC KỲ).
   - File Claude xuất ra.
3. So sánh cell-by-cell:
   - Vị trí "KHOA KHTN và CNTT" ở A1?
   - "CỘNG HOÀ XÃ HỘI…" có merge cell đúng cột D-F không?
   - Header row dòng 7 có đủ 7 cột không?
   - Block THỐNG KÊ ở vị trí nào?
   - Có 3 cột chữ ký không?

Nếu lệch → vào Claude Code:
```
Export Excel lệch với file mẫu ở chỗ [mô tả cụ thể]. Đọc lại mục 7 PRD.
Mở 2 file bằng exceljs, log cell address của chỗ lệch, fix code rồi xuất lại.
```

**Test feature flag**:
- Mặc định `.env` có `IMPORT_EXCEL_ENABLED=false` → vào `/scores` không thấy nút Import.
- Đổi `=true`, restart `npm run dev` → nút hiện → thử import file mẫu thành công.

Commit + `/clear`.

---

### Tuần 5 — Tra cứu + Thống kê

Dán **Prompt Tuần 5**. Claude xây trang `/search`, `/stats`, nâng cấp `/dashboard`.

Test:
- Tìm `221CTT006` ở thanh search → trang SV với biểu đồ điểm 8 HK.
- `/stats` → biểu đồ cột/đường/tròn render đúng.

Commit + `/clear`.

---

### Tuần 6 — Polish, Backup, Test E2E, README

Dán **Prompt Tuần 6**. Claude làm:
- Backup/Restore DB qua UI.
- Đổi mật khẩu.
- Phím tắt Ctrl+K, Ctrl+S.
- Skeleton loading, empty state.
- Playwright E2E test.
- Update README cuối cùng.

> ⚠️ **Lưu ý**: nếu bạn muốn giữ README.md tôi đã viết, thêm vào prompt: *"Không ghi đè README.md hiện tại. Nếu cần bổ sung, thêm vào cuối file."*

Test cuối:
```bash
npm run test          # vitest pass
npm run test:e2e      # playwright pass
npm run build         # build production thành công
npm run start         # chạy production
```

Tag git:
```bash
git tag v1.0.0
git log --oneline     # xem lịch sử commit
```

🎉 **Dự án hoàn thành MVP!**

---

## 🆘 PHẦN 7 — Xử lý sự cố thường gặp

### Sự cố 1: Claude code đi sai hướng, lệch PRD

**Triệu chứng**: Claude tự thêm tính năng không có trong PRD, hoặc đổi schema khác mục 4.

**Xử lý**:
```
Dừng lại. Đọc lại mục [X] của PRD-DiemRenLuyen.md. Liệt kê các điểm hiện tại
không khớp PRD rồi sửa. Đừng tự sáng tạo ngoài specs.
```

### Sự cố 2: Context quá đầy, Claude phản hồi chậm/sai

**Triệu chứng**: Tới Tuần 3–4, Claude bắt đầu quên những gì đã làm.

**Xử lý**:
1. `/clear`
2. Nạp lại ngữ cảnh ngắn gọn:
   ```
   Tiếp tục dự án Quản lý Điểm Rèn luyện. Đọc CLAUDE.md và mục Roadmap tuần [N]
   của PRD. Hiện tại đã xong Tuần [N-1]. Tóm tắt trạng thái hiện tại rồi bắt đầu.
   ```

### Sự cố 3: npm install lỗi quyền (Linux/Mac)

**Triệu chứng**: `EACCES permission denied` khi cài package.

**Xử lý**:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc   # hoặc ~/.zshrc
source ~/.bashrc
```

### Sự cố 4: Export Excel sai format dù sửa nhiều lần

**Xử lý**: 
1. Chụp screenshot 2 file cạnh nhau, đánh dấu vùng lệch.
2. Mô tả cụ thể: "Cell A1 file mẫu là 'KHOA KHTN và CNTT' nhưng file xuất là 'Khoa KHTN và CNTT' (sai chữ hoa)."
3. Ép Claude:
   ```
   Mở templates/mau-rl-hocky.xlsx và sample/DC22CTT01-II-25-26.xls bằng exceljs.
   Log toàn bộ cell A1-G10 với value + style của cả 2 file. So sánh từng cell.
   Báo cáo các điểm khác biệt rồi fix.
   ```

### Sự cố 5: Lỡ thoát Claude Code giữa chừng

**Xử lý**: chạy `claude --resume` hoặc `claude -c` để tiếp tục phiên gần nhất.

### Sự cố 6: Quên password Admin

**Xử lý**:
```bash
rm prisma/dev.db
npm run db:migrate
npm run db:seed
```
Password về mặc định `Admin@123` nhưng **mất hết dữ liệu** — chỉ làm khi đã backup.

---

## 💡 PHẦN 8 — Mẹo dùng Claude Code hiệu quả

### Mẹo 1: Cụ thể & ngắn gọn khi yêu cầu

❌ Tệ: "fix the bug"  
✅ Tốt: "fix bug ở trang /scores: khi click Lưu, điểm không cập nhật vào DB nhưng UI vẫn hiện thành công"

### Mẹo 2: Cho Claude đọc trước rồi mới sửa

❌ Tệ: "sửa lib/excel-export.ts cho khớp file mẫu"  
✅ Tốt: "đọc kỹ lib/excel-export.ts và sample/DC22CTT01-II-25-26.xls. Liệt kê những điểm lib hiện tại chưa match mẫu. Đợi tôi duyệt rồi sửa."

### Mẹo 3: Chia nhỏ task lớn

Thay vì: "làm hết Tuần 4"  
Hãy: "làm Phần A (Export) của Tuần 4. Khi xong báo tôi rồi mới làm Phần B."

### Mẹo 4: Commit thường xuyên

Sau mỗi tính năng nhỏ chạy được → commit. Đừng đợi xong cả tuần mới commit.

```bash
git commit -m "feat: thêm Mode A nhập điểm qua Dialog"
# tiếp tục làm Mode B...
git commit -m "feat: thêm Mode B nhập điểm inline"
```

### Mẹo 5: Dùng `claude -p` cho lệnh nhanh

Khi cần hỏi nhanh ngoài phiên chính:
```bash
claude -p "Giải thích function classifyScore trong lib/classification.ts"
```

Chạy 1 lần, trả kết quả, thoát. Không tốn context phiên chính.

### Mẹo 6: Cuối tuần — review tổng

Cuối mỗi tuần, trước khi `/clear`:
```
Review toàn bộ code Tuần [N]. Liệt kê:
1. Các function dài > 80 dòng cần refactor
2. Code lặp lại có thể tách thành utility
3. Magic string nên thay bằng constant
4. Phần chưa có test
Đề xuất 3 cải tiến quan trọng nhất, không code ngay.
```

### Mẹo 7: Đừng cãi nhau với Claude

Nếu Claude khăng khăng làm sai, không cố tranh luận. Thay vào đó:
- `/clear`
- Nạp lại ngữ cảnh từ PRD
- Yêu cầu lại với phrasing khác

---

## ⏱️ PHẦN 9 — Ước lượng thời gian

| Hoạt động | Thời gian Claude xử lý | Bạn cần làm gì |
|---|---|---|
| Tuần 1 (Init project) | 15-30 phút | Phê duyệt từng file, test login |
| Tuần 2 (CRUD danh mục) | 30-45 phút | Test tạo/sửa/xóa qua UI |
| Tuần 3 (Nhập điểm + CLI) | 45-60 phút | Test cả 2 mode + CLI seed |
| Tuần 4 (Excel I/O) | 60-90 phút | **So sánh file Excel cẩn thận** |
| Tuần 5 (Tra cứu + thống kê) | 30-45 phút | Test biểu đồ render |
| Tuần 6 (Polish + Test) | 45-60 phút | Chạy test E2E + đóng gói |

**Tổng**: ~4-6 giờ Claude xử lý + ~10-15 giờ bạn test/review/sửa. Trải đều ra 2-6 tuần tùy thời gian rảnh.

---

## 📚 PHẦN 10 — Tài liệu tham khảo

- **Claude Code Docs**: https://docs.claude.com/en/docs/claude-code/overview
- **Quickstart chính thức**: https://code.claude.com/docs/en/quickstart
- **Best practices**: https://docs.claude.com/en/docs/claude-code/best-practices
- **Slash commands**: https://docs.claude.com/en/docs/claude-code/commands
- **Troubleshoot install**: https://docs.claude.com/en/docs/claude-code/troubleshoot-install

---

## 🎯 Checklist hoàn thành dự án

- [ ] Cài Claude Code, đăng nhập thành công.
- [ ] Tạo folder dự án, copy 6 file tài liệu, commit ban đầu.
- [ ] Khởi động Claude Code, kiểm tra Claude đọc đúng CLAUDE.md.
- [ ] Dán Prompt khởi đầu, Claude tóm tắt PRD đúng.
- [ ] Hoàn thành Tuần 1: login + dashboard hoạt động.
- [ ] Hoàn thành Tuần 2: CRUD danh mục đầy đủ.
- [ ] Hoàn thành Tuần 3: nhập điểm 2 mode + CLI seed thành công.
- [ ] Hoàn thành Tuần 4: Export Excel khớp 1:1 với mẫu + Import sau feature flag.
- [ ] Hoàn thành Tuần 5: Tra cứu + thống kê + biểu đồ.
- [ ] Hoàn thành Tuần 6: Polish + Backup + Test E2E pass.
- [ ] Commit tag `v1.0.0`, sẵn sàng triển khai.

Chúc bạn build thành công! 🚀
