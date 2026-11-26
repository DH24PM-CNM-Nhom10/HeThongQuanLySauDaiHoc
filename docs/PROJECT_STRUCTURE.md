# Tổ chức mã nguồn dự án

Ứng dụng có hai tiến trình: Next.js trong `UI` và NestJS trong `api`. Tên và vị trí hai thư mục này được giữ ổn định vì kho dữ liệu dùng chung và các script cục bộ đang dựa vào chúng.

## Giao diện Next.js

- `UI/app`: route, layout và route handler đang hoạt động. Giữ tên route để không đổi URL người dùng.
- `UI/components/auth`: kiểm tra phiên và form đổi mật khẩu.
- `UI/components/layout`: header, navbar, sidebar và footer.
- `UI/components/public`: cổng thông tin và menu tài khoản.
- `UI/components/students`: quản lý học viên, hồ sơ, bảng điểm cá nhân và `certificates`.
- `UI/components/teachers`: hồ sơ và bảng điểm giảng viên.
- `UI/components/schedule`: lưới thời khóa biểu dùng cho học viên và giảng viên.
- `UI/components/training-office`: phân công và thông báo Phòng đào tạo.
- `UI/components/grades`: duyệt, công bố và cập nhật danh sách học viên của bảng điểm.
- `UI/components/thesis`: theo dõi đề tài và cảnh báo tiến độ.
- `UI/components/catalogs`: danh mục tham chiếu đào tạo.
- `UI/components/upload`: nhập Excel và ánh xạ cột.
- `UI/components/shared`: bảng dữ liệu và bộ xem bảng tính dùng chung.
- `UI/lib`: hàm truy cập dữ liệu, xác thực, chuẩn hóa và kiểm tra dữ liệu; không đặt component React tại đây.
- `UI/data`: dữ liệu tham chiếu chương trình đào tạo.
- `UI/public`: chỉ tài nguyên được phép truy cập công khai, không chứa cấu hình hay dữ liệu tài khoản.
- `UI/tests`: kiểm thử hành vi giao diện và API bằng dữ liệu giả lập.

## Máy chủ NestJS

`api/src` đã được chia theo nghiệp vụ nên tiếp tục giữ các module `student-records`, `teacher-auth`, `training-office`, `office-notices`, `announcements`, `entities`, `store` và `common`. Các kiểm thử đơn vị nằm cạnh mã nghiệp vụ; `api/test` dành cho kiểm thử đầu cuối.

`api/scripts` chứa công cụ chuẩn bị database và tài khoản. Ví dụ `node api/scripts/setup-notices-db.cjs` đọc SQL từ `database/mysql`, không còn đọc tệp SQL ở gốc dự án.

## Dữ liệu và cấu hình cục bộ

| Vị trí | Vai trò |
| --- | --- |
| `UI/db.json` | Kho JSON chính đang được ứng dụng sử dụng |
| `api/db.json` | Nguồn dữ liệu cũ phục vụ đọc tương thích khi nhóm dữ liệu chưa có ở kho chính |
| `UI/data` | Dữ liệu tham chiếu, không phải kho nhập học viên |
| `database/mysql` | Cấu trúc SQL, không thay thế dữ liệu JSON hiện tại |
| `.env`, `.env.local`, các tệp tài khoản/khóa phiên cục bộ | Cấu hình riêng, giữ ở vị trí đang dùng và không commit |
| `.next`, `dist`, `node_modules`, `*.tsbuildinfo` | Kết quả build, dependency hoặc cache được tạo tự động |

Việc tổ chức lại thư mục không chuyển dữ liệu sang PostgreSQL/Supabase. Khi thay hệ quản trị, cần thiết kế và chạy bước chuyển đổi dữ liệu riêng.

## Quy tắc thêm mã mới

Đặt component và CSS module cùng nhóm chức năng. Route chỉ kết nối trang với component nghiệp vụ. Đặt quy tắc dùng bởi cả hai ứng dụng trong `shared`, kèm khai báo kiểu `.d.cts`. Đặt SQL và script thay đổi cấu trúc trong khu vực database phù hợp.

Mã sao lưu phải nằm trong `archive`, không đặt trong `UI/app`, `UI/public` hoặc `api/src`. Các bản cũ trong archive giữ nguyên ngữ cảnh đường dẫn ban đầu và không phải API có thể sử dụng lại trực tiếp.
