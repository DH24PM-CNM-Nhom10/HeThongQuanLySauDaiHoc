import { redirect } from "next/navigation";

// Route cũ được giữ để đường dẫn đã lưu không bị lỗi.
// Trang quản trị Phòng đào tạo hiện chỉ có mục Phân công giảng dạy.
export default function TrainingOfficeDashboard() {
  redirect("/assignment");
}
