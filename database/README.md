# Cấu trúc và dữ liệu cơ sở dữ liệu

- `mysql/DB_QuanLyDaoTaoSauDaiHoc_v1.sql`: bản SQL MySQL của dự án, bao gồm cấu trúc bảng thông báo.
- Lệnh chuẩn bị bảng thông báo: `node api/scripts/setup-notices-db.cjs`, chạy từ thư mục gốc dự án. Lệnh chỉ tạo đối tượng còn thiếu.

Ứng dụng hiện vẫn dùng hai nguồn: hồ sơ, phân công, lịch và điểm trong `UI/db.json`; thông báo trong MySQL. `shared/system-store.cjs` là nơi đọc/ghi dữ liệu JSON dùng chung. Chưa có bước chuyển đổi sang Supabase/PostgreSQL.

Các tệp tài khoản, khóa phiên và cấu hình kết nối cục bộ không phải tệp SQL và không được đưa vào thư mục này để commit. Mọi thay đổi cấu trúc database sau này cần có script chuyển đổi riêng và kiểm tra liên kết trước khi áp dụng.
