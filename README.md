# HeThongQuanLySauDaiHoc
## 📖 Giới thiệu
Dự án xây dựng hệ thống quản lý đào tạo sau đại học.
Repository này lưu trữ toàn bộ source code, tài liệu phân tích nghiệp vụ và quản lý tiến độ của nhóm.

## Cấu trúc hiện tại

```text
UI/                     Next.js: các trang, API phía giao diện, component và kiểm thử
api/                    NestJS: xác thực theo vai trò, phân công, lịch và điểm
shared/                 Logic dùng chung giữa Next.js và NestJS
database/mysql/         Cấu trúc database MySQL
docs/requirements/      Tài liệu phân tích và yêu cầu
archive/                Mã cũ được giữ để đối chiếu, không chạy trong ứng dụng
```

Component trong `UI/components` được nhóm theo chức năng: `auth`, `layout`, `public`, `students`, `teachers`, `schedule`, `training-office`, `grades`, `thesis`, `catalogs`, `upload` và `shared`. CSS module nằm cùng component tương ứng.

Xem [hướng dẫn tổ chức dự án](docs/PROJECT_STRUCTURE.md), [database](database/README.md) và [logic dùng chung](shared/README.md). Các tài liệu trong `docs/requirements` có thể mô tả yêu cầu hoặc thiết kế ban đầu, không đồng nghĩa mọi chức năng đã được triển khai.

## Lệnh từ thư mục gốc

```text
npm run install:apps     Cài thư viện theo lockfile của UI và API
npm run dev:api          Chạy API ở cổng 3001
npm run dev:ui           Chạy giao diện ở cổng 3000, trong terminal khác
npm test                Chạy kiểm thử UI và API
npm run build           Build API và UI
```

`UI` và `api` vẫn quản lý dependency và lockfile riêng; các lệnh ở gốc chỉ điều phối hai ứng dụng.

## Chạy hệ thống trên máy tính

Mở hai cửa sổ terminal tại thư mục dự án và giữ cả hai cùng chạy.

Máy chủ API (cổng 3001), xử lý đăng nhập học viên, giảng viên và Phòng đào tạo:

```powershell
cd api
npm run start:dev
```

Giao diện (cổng 3000):

```powershell
cd UI
npm run dev
```

Truy cập http://localhost:3000. Nếu chỉ chạy giao diện, các tài khoản học viên, giảng viên và Phòng đào tạo sẽ không đăng nhập được. Tài khoản quản trị cần cấu hình `AGU_ADMIN_USERNAME`, `AGU_ADMIN_PASSWORD_HASH` và `AGU_SESSION_SECRET` trong `UI/.env.local`.

## 👥 Danh sách thành viên và Vai trò
| STT | Họ và Tên | MSSV | Vai trò | Trách nhiệm chính trong Tuần 1 |
|:---:|---|---|---|---|
| 1 | Cao Yến Khoa | DPM235434 | **Product Owner / Team Lead** | Điều phối chung, viết README, nộp báo cáo |
| 2 | Nguyễn Thị Hồng Ngọc | DPM235434 | **DevOps / Cloud Engineer** | Khởi tạo Git Repo, phân quyền thành viên |
| 3 | Dư Thị Trúc Hòa | DPM235434 | **QA / Data Specialist** | Tổng hợp User Stories, Mô tả hệ thống |
| 4 | Nguyễn Trần Thùy Lam | DPM235440 | **Backend Developer** | Bóc tách logic, thiết kế API Contract |
| 5 | Lê Thị Kim Liên | DPM235441 | **Backend Developer** | Bóc tách logic, thiết kế API Contract |
| 6 | Dương Tuấn Kiệt | DPM235438 | **Frontend Developer** | Bóc tách luồng UI/UX, hỗ trợ chốt API |
| 7 | Nguyễn Thị Cẩm Tú | DPM235519 | **Frontend Developer** | Bóc tách luồng UI/UX, hỗ trợ chốt API |
