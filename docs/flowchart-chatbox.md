# Flowchart chức năng Chatbox

Tài liệu này mô tả luồng chức năng Chatbox trợ lý trong hệ thống Điểm rèn luyện, dựa trên đặc tả PRD mục 5.11 và 6.6. Chatbox chỉ hỗ trợ hỏi đáp, tra cứu dữ liệu read-only trong phạm vi quyền, và không thực hiện thao tác tạo/sửa/xóa dữ liệu.

## 1. Luồng tổng quan trên giao diện

```mermaid
flowchart TD
    A([Người dùng truy cập dashboard]) --> B{Đã đăng nhập?}
    B -- Không --> B1[Không hiển thị chatbox ở màn login]
    B -- Có --> C[Client gọi GET /api/config/features]
    C --> D{chatboxEnabled = true?}
    D -- Không --> D1[Ẩn floating button chatbox]
    D -- Có --> E[Hiển thị floating button ở góc phải dưới]
    E --> F[Người dùng click nút chat]
    F --> G[Mở sheet/drawer chat]
    G --> H[GET /api/chat/messages lấy tối đa 30 tin gần nhất]
    H --> I[Hiển thị lịch sử, ô nhập, nút gửi, nút xóa]
    I --> J{Người dùng chọn thao tác}
    J -- Gửi câu hỏi --> K[POST /api/chat]
    J -- Xóa hội thoại --> L[DELETE /api/chat/messages]
    K --> M[Hiển thị câu trả lời và link nội bộ nếu có]
    L --> N[Xóa lịch sử khỏi panel]
```

## 2. Luồng gửi câu hỏi `POST /api/chat`

```mermaid
flowchart TD
    A([Client gửi message]) --> B{Message hợp lệ?}
    B -- Không: rỗng hoặc > 1000 ký tự --> B1[Trả 400: nội dung không hợp lệ]
    B -- Có --> C{CHATBOX_ENABLED bật và có GEMINI_API_KEY?}
    C -- Không --> C1[Trả 403: Chatbox đang tắt]
    C -- Có --> D{Session hợp lệ?}
    D -- Không --> D1[Trả 401: yêu cầu đăng nhập]
    D -- Có --> E[Nhận diện intent câu hỏi]
    E --> F{Intent yêu cầu mutation?}
    F -- Có: tạo/sửa/xóa dữ liệu --> F1[Từ chối lịch sự, trả hướng dẫn thao tác và link màn hình phù hợp]
    F -- Không --> G{Cần dữ liệu hệ thống?}
    G -- Không: hỏi cách dùng/quy tắc --> H[Dựng context hướng dẫn từ PRD/README/UI]
    G -- Có --> I[Gọi helper read-only đã áp dụng quyền theo vai trò]
    I --> J{Có quyền xem dữ liệu?}
    J -- Không --> J1[Từ chối trả dữ liệu ngoài phạm vi quyền]
    J -- Có --> K[Chuẩn hóa dữ liệu tối thiểu cần đưa vào prompt]
    H --> L[Dựng system prompt an toàn]
    K --> L
    L --> M[Đính kèm lịch sử chat ngắn hạn tối đa 30 tin/user]
    M --> N[Gọi Gemini qua lib/chat-assistant.ts]
    N --> O{Gemini trả lời thành công?}
    O -- Không --> O1[Trả 502: Không thể kết nối AI]
    O -- Có --> P[Lưu ChatMessage của user hiện tại]
    P --> Q[Ghi audit log CHATBOX_ASK chỉ gồm metadata]
    Q --> R[Trả answer và links cho client]
```

## 3. Luồng lấy lịch sử `GET /api/chat/messages`

```mermaid
flowchart TD
    A([Client mở panel chat]) --> B{CHATBOX_ENABLED bật?}
    B -- Không --> B1[Trả 403]
    B -- Có --> C{Session hợp lệ?}
    C -- Không --> C1[Trả 401]
    C -- Có --> D[Query ChatMessage theo userId hiện tại]
    D --> E[Sắp xếp mới nhất, giới hạn 30 tin]
    E --> F[Trả danh sách message cho client]
```

## 4. Luồng xóa lịch sử `DELETE /api/chat/messages`

```mermaid
flowchart TD
    A([Người dùng bấm xóa cuộc trò chuyện]) --> B{Xác nhận xóa?}
    B -- Không --> B1[Giữ nguyên lịch sử]
    B -- Có --> C{CHATBOX_ENABLED bật?}
    C -- Không --> C1[Trả 403]
    C -- Có --> D{Session hợp lệ?}
    D -- Không --> D1[Trả 401]
    D -- Có --> E[Xóa ChatMessage theo userId hiện tại]
    E --> F[Trả kết quả thành công]
    F --> G[Client làm trống panel chat]
```

## 5. Quy tắc phân quyền dữ liệu

```mermaid
flowchart TD
    A([Câu hỏi cần tra cứu dữ liệu]) --> B{Vai trò người dùng}
    B -- Admin --> C[Xem toàn hệ thống]
    B -- CVHT --> D[Chỉ xem lớp có advisorId = currentUser.id]
    B -- Trưởng khoa --> E[Chỉ xem lớp thuộc facultyId = currentUser.facultyId]
    C --> F[Helper read-only trả dữ liệu đã lọc]
    D --> F
    E --> F
    F --> G{Dữ liệu có đủ để trả lời?}
    G -- Không --> G1[Hỏi lại bộ lọc: lớp, học kỳ, năm học]
    G -- Có --> G2[Đưa dữ liệu tối thiểu vào prompt]
```

## 6. Các nhánh lỗi chính

| Tình huống | Kết quả mong muốn |
| --- | --- |
| `CHATBOX_ENABLED=false` hoặc thiếu `GEMINI_API_KEY` | Ẩn UI, API trả 403 với thông báo "Chatbox đang tắt" |
| Chưa đăng nhập | Không hiển thị ở login, API trả 401 |
| Tin nhắn rỗng hoặc vượt 1.000 ký tự | API trả 400 |
| Hỏi dữ liệu ngoài quyền | Từ chối lịch sự, không đưa dữ liệu ngoài quyền vào prompt |
| Yêu cầu tạo/sửa/xóa dữ liệu | Không thực hiện mutation, chỉ hướng dẫn thao tác thủ công |
| Gemini lỗi quota/timeout/key sai | API trả 502 và thông báo tiếng Việt |
| Câu hỏi mơ hồ về lớp/học kỳ/năm học | Chatbox hỏi lại ngắn gọn hoặc gợi ý chọn bộ lọc |

## 7. Ghi chú triển khai

- `GET /api/config/features` cần bổ sung trường `chatboxEnabled`.
- `lib/features.ts` cần thêm flag `chatbox`.
- `prisma/schema.prisma` cần có model `ChatMessage` nếu triển khai lưu lịch sử.
- `lib/chat-assistant.ts` là nơi dựng system prompt, phân loại intent, gọi helper dữ liệu và gọi Gemini.
- Không log nguyên văn câu hỏi/câu trả lời vào `AuditLog`; chỉ log metadata như `messageLength`, `usedDataScope`, `model`.
