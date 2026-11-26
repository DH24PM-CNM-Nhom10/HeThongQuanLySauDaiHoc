type Store = Record<string, unknown[]>;

const dependencies: Record<string, string[]> = {
  students: ["thesis", "schedule", "grades", "assignments", "teachingAssignments", "teacherGrades", "gradebooks"],
  teachers: ["thesis", "schedule", "assignments", "teachingAssignments", "teacherGrades", "gradebooks"],
  assignments: ["teachingAssignments", "teacherGrades", "gradebooks"],
  grades: ["teacherGrades", "gradebooks"],
};

// Bulk operations cannot determine which individual records are safe to remove.
// Keep linked records until the corresponding business workflow handles them.
export function bulkDeleteConflict(store: Store, targets: string[] | null): string | null {
  const linked = targets === null
    ? ["thesis", "schedule", "grades", "assignments", "teachingAssignments", "teacherGrades", "gradebooks", "gradeHistory", "studentHistory"]
    : [...new Set(targets.flatMap(key => dependencies[key] || []))];
  const occupied = linked.filter(key => (store[key]?.length ?? 0) > 0);
  return occupied.length
    ? "Không thể xóa hàng loạt khi còn hồ sơ liên kết (" + occupied.join(", ") + "). Hãy xử lý liên kết và lưu trữ hồ sơ trước khi xóa."
    : null;
}
