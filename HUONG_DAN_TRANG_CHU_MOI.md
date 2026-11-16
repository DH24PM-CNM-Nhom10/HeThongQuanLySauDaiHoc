# Hướng dẫn tích hợp giao diện trang chủ mới

## Mục tiêu

Trang chủ theo phong cách cổng thông tin đại học: logo biểu trưng, menu ngang, banner, thông báo nổi bật, danh sách thông báo có tìm kiếm và tải tệp, tiện ích học viên. Không dùng Sidebar/Header của trang Admin.

Trang mới được tạo trên nền source gốc `HeThongQuanLySauDaiHoc(1).zip`, không phụ thuộc bộ code trang chủ Sidebar được tạo trước đó.

## Những thay đổi

| Tệp | Thay đổi |
|---|---|
| `UI/app/page.tsx` | Trang chủ công khai `/` |
| `UI/components/PublicHome.tsx` | Toàn bộ bố cục trang chủ, tương tác tìm kiếm/phân trang |
| `UI/components/PublicHome.module.css` | Style riêng, responsive |
| `UI/app/home/page.tsx` | Đường dẫn phụ `/home` cùng giao diện trang chủ |
| `UI/app/admin/page.tsx` | Dashboard Admin cũ, trước đó ở `app/page.tsx` |
| `UI/components/AuthGuard.tsx` | Không bọc Sidebar/Header tại `/`, `/home`; các trang nghiệp vụ vẫn dùng layout cũ |
| `UI/components/Sidebar.tsx` | Đổi link Dashboard sang `/admin`, thêm link Cổng thông tin |
| `UI/app/login/page.tsx` | Sau đăng nhập Admin → `/admin`, Học viên → `/home` |
| `UI/public/demo-documents/` | 6 tệp TXT minh họa chức năng tải, không phải tài liệu thực tế |

## Cách sử dụng

1. Sao lưu repository trước khi chép file.
2. Nếu dùng ZIP bản vá, chép thư mục `UI/` vào `UI/` của dự án và cho phép ghi đè đúng các tệp trong gói.
3. Mở terminal tại `UI/` và chạy `npm install`, `npm run dev`.
4. Mở `http://localhost:3000/` để xem trang chủ công khai mà không đăng nhập.
5. Đăng nhập Admin sẽ chuyển đến `http://localhost:3000/admin` (Dashboard cũ). Học viên sẽ đến `/home`.

## Dữ liệu và database

- Các thông báo trong `PublicHome.tsx` **là dữ liệu minh họa** (`DEMO_NOTICES`).
- Tìm kiếm, phân trang, xem/tải tệp mẫu `.txt` hoạt động trên dữ liệu mẫu.
- **Chưa có API upload thông báo hoặc kết nối bảng MariaDB `thong_bao`.** Khi hoàn thiện backend, lấy danh sách `GET /api/thong-bao` từ các trường `ma_thong_bao`, `tieu_de`, `ten_file`, `duong_dan_file`, `ngay_dang`, thay thế `DEMO_NOTICES` và hiển thị thông báo thật.
- Nếu cần cung cấp quyền đăng thông báo, phải kiểm tra quyền trên máy chủ (không sử dụng `localStorage` như xác thực bảo mật).
- Biểu tượng tốt nghiệp trong header là biểu tượng UI, không phải logo chính thức của trường. Thay bằng logo được cấp phép nếu có.

## Nguồn tham khảo giao diện

- https://gs.ctu.edu.vn/ (thông tin nổi bật, danh sách thông báo)
- https://vnuhcm.edu.vn/dao-tao-tuyen-sinh?t=sau-dai-hoc-tuyen-sinh (phong cách cổng thông tin và bố cục theo danh mục)

## Lưu ý bảo mật hiện trạng

Luồng đăng nhập hiện có trong source gốc dùng `localStorage` và chỉ kiểm tra thông tin người dùng phía trình duyệt. Gói này chỉ điều chỉnh giao diện/điều hướng, không khẳng định đã có phân quyền API an toàn để triển khai production.
