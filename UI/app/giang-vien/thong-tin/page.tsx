import PublicHome from "../../../components/PublicHome";

// Trang hồ sơ nằm trong Cổng thông tin: Header AGU + menu ngang + Footer,
// không sử dụng Dashboard/Sidebar quản trị.
export default function TeacherPublicProfilePage() {
  return <PublicHome page="teacher-profile" />;
}
