# Logic dùng chung

Các mô-đun CommonJS ở đây được cả Next.js và NestJS sử dụng. Mỗi mô-đun có tệp khai báo `.d.cts` tương ứng.

- `system-store.cjs`: xác định thư mục dự án, đọc/ghi kho JSON, danh mục và kiểm tra phiên bản khi lưu.
- `student-status.cjs`: chuẩn hóa trạng thái học viên.
- `teacher-account-username.cjs`: tạo tên đăng nhập giảng viên.
- `teacher-links.cjs`: kiểm tra hồ sơ liên kết trước khi xóa giảng viên.

Giữ mô-đun dùng chung độc lập với React và NestJS. Không đặt khóa phiên, thông tin kết nối hay dữ liệu tài khoản trong thư mục này.
