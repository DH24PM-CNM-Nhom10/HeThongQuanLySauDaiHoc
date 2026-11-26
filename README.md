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

## Hồ sơ học viên và thống kê điểm

- Quản trị và Phòng đào tạo quản lý thông tin cá nhân, học tập tại `/students`, lọc theo ngành, khóa, lớp, trạng thái và xuất Excel theo bộ lọc hiện tại.
- Trong chi tiết học viên có hồ sơ nhập học, văn bằng, chứng chỉ và minh chứng. Trang `/kiem-tra-van-bang` dùng để tra cứu, duyệt hoặc từ chối hồ sơ. Học viên tự nộp và xem hồ sơ của mình trong trang cá nhân.
- Học viên được cập nhật thông tin liên hệ; thông tin ngành, lớp và trạng thái học do cán bộ quản lý.
- Thống kê điểm tại `/admin/thong-ke-diem` và `/phong-dao-tao/thong-ke-diem`: lọc theo năm học, học kỳ, ngành, khóa, lớp; xem phân bố điểm, tỷ lệ đạt và xuất Excel. Chỉ tính điểm đã công bố; điểm trung bình thống kê không phải GPA theo tín chỉ.

Hồ sơ chấp nhận PDF, JPEG, PNG tối đa 10 MB mỗi file, lưu riêng tại `api/storage/student-documents` hoặc `QLDT_UPLOAD_DIR`. Tải file yêu cầu xác thực đúng quyền. Khi triển khai host cần ổ đĩa bền vững cho file và dữ liệu JSON; lưu trữ Supabase chưa được tích hợp. Không đưa thư mục hồ sơ vào `public` hoặc Git.

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

## Nghiệp vụ quản lý đã bổ sung

- `/teachers`: thêm, sửa, xóa có kiểm tra liên kết, xem chi tiết, lọc và xuất Excel. Mã giảng viên không đổi khi sửa; không đổi tên khi còn hồ sơ liên kết.
- `/assignment`: Admin và Phòng đào tạo dùng chung phân công `teachingAssignments`; cho đổi giảng viên khi chưa có điểm và không trùng lịch, hoặc hủy phân công chưa phát sinh điểm.
- `/schedule`: chỉ nhập Excel, không xếp lịch trực tiếp. Tải mẫu, mỗi dòng là một ngày học; nhập mã phân công hoặc đầy đủ năm học/học kỳ/lớp/học phần/giảng viên, ngày học, tiết bắt đầu/kết thúc, phòng. Kiểm tra và xem trước rồi xác nhận; giữ lịch cũ, bỏ trùng, không lưu nếu có lỗi.
- `/academic`: tạo phiên bản quy chế (trọng số, điểm đạt, thang GPA), cấu hình kế hoạch tín chỉ theo lớp và tra cứu tiến độ. Cần nhập quy chế chính thức trước khi sử dụng; bảng điểm đã lưu giữ phiên bản quy chế. GPA/tín chỉ chỉ tính điểm công bố đúng quy chế của kế hoạch, học lại lấy điểm cao nhất. Điều kiện học thuật không tự công nhận tốt nghiệp.
- `/thesis`: nút Xét duyệt mở đăng ký đề tài, gia hạn, đề nghị bảo vệ và hội đồng (chủ tịch, phản biện). Chặn giảng viên hướng dẫn làm chủ tịch/phản biện. Duyệt bảo vệ cần cán bộ đối chiếu điều kiện và ghi ý kiến xác nhận; chưa phải bộ máy tự xét đầy đủ mọi điều kiện tốt nghiệp.
- Học viên gửi và theo dõi yêu cầu luận văn, xem tiến độ tín chỉ tại Tiến độ học tập trên trang chủ.
- `/admin/thong-bao` và `/phong-dao-tao/thong-bao`: tải PDF/DOCX/XLSX/JPG/PNG tối đa 10 MB. File lưu tại `api/storage/notice-attachments`; khách chỉ tải được file gắn với thông báo đã công bố. Thông báo vẫn cần database MySQL hiện có.

Phòng đào tạo có quyền với các nghiệp vụ trên qua menu riêng. Dữ liệu và tệp hồ sơ cần ổ đĩa bền vững trên host; các thay đổi này chưa chuyển dữ liệu sang Supabase.

Kiểm thử HTTP nghiệp vụ trên dữ liệu giả riêng: `npm run build:api` rồi `node api/test/management.http.cjs`. Bộ kiểm thử tự mở cổng localhost ngẫu nhiên và dọn dữ liệu tạm.

## Thay đổi quy trình điểm và môn học

- Thêm môn tại `/courses`: cấu hình tỷ trọng quá trình/thi có tổng 100%, số tín chỉ, trọng số GPA của môn và thang điểm chữ/GPA ngay trong biểu mẫu. Môn mới được đưa vào danh mục phân công theo ngành/định hướng/học kỳ đã chọn.
- `/academic` chỉ quản lý thang quy đổi điểm/GPA và kế hoạch tín chỉ theo lớp; kế hoạch chọn các môn đã cấu hình thay vì nhập lại trọng số chung cho lớp.
- Điểm lưu trực tiếp bởi giảng viên được học viên và thống kê sử dụng ngay, không gửi duyệt, công bố hoặc mở khóa. Giữ kiểm tra quyền lớp được phân công, phiên bản chống ghi đè và lịch sử sửa điểm. Các ảnh chụp điểm công bố cũ chỉ giữ để đối chiếu lịch sử.
- GPA dùng tổng (GPA môn × trọng số GPA môn) chia tổng trọng số các môn có điểm; học lại lấy điểm cao nhất. Điểm cũ không tự bị tính lại khi thêm cấu hình môn; giảng viên xem lại và lưu để áp dụng trọng số mới.
- Chức năng nhập và ánh xạ dữ liệu chung đã bị bỏ; `/api/upload` trả HTTP 410. Nhập Excel thời khóa biểu tại `/schedule` và nhập Excel điểm trong Bảng điểm giảng viên vẫn được giữ riêng.

Các hướng dẫn cũ về gửi duyệt/công bố điểm hoặc nhập dữ liệu bằng ánh xạ không còn áp dụng.
