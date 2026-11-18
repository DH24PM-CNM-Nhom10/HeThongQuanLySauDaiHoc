import { redirect } from "next/navigation";

// Trang /giang-vien cũ không còn là màn quản trị Hồ sơ giảng viên.
// Đưa về trang hồ sơ thuộc Cổng thông tin công khai (giữ xác thực tài khoản giảng viên).
export default function TeacherProfileRedirect() {
  redirect("/giang-vien/thong-tin");
}
