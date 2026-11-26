const { dateISO } = require("./thesis-progress.cjs");
function prepareSchedule(input, assignments, existing = []) {
  const text = (v) => String(v ?? "").trim();
  const norm = (row) => ({
    assignmentId: text(row.assignmentId || row["Mã phân công"]),
    schoolYear: text(row.schoolYear || row["Năm học"]),
    semester: text(row.semester || row["Học kỳ"]),
    classCode: text(row.classCode || row["Lớp"]),
    courseCode: text(row.courseCode || row["Mã học phần"]).toUpperCase(),
    teacherId: text(row.teacherId || row["Mã giảng viên"]),
    date: dateISO(row.date || row["Ngày học"]),
    startPeriod: Number(row.startPeriod || row["Tiết bắt đầu"]),
    endPeriod: Number(row.endPeriod || row["Tiết kết thúc"]),
    room: text(row.room || row["Phòng"]),
  });
  const errors = [],
    additions = [],
    known = existing.map((x) => {
      const a =
        assignments.find((a) => a.id === (x.assignmentId || x.maPhanCong)) ||
        {};
      return {
        ...x,
        classCode: text(x.classCode || x.lop || a.classCode),
        teacherId: text(x.teacherId || x.maGV || a.teacherId),
        room: text(x.room || x.phong),
        date: dateISO(x.date || x.ngayHoc),
        startPeriod: Number(x.startPeriod || x.tietBatDau),
        endPeriod: Number(x.endPeriod || x.tietKetThuc),
      };
    });
  let duplicates = 0;
  if (!Array.isArray(input) || !input.length || input.length > 5000)
    return {
      errors: ["File phải có từ 1 đến 5.000 dòng."],
      additions,
      duplicates,
    };
  input.forEach((raw, i) => {
    const row = norm(raw),
      prefix = `Dòng ${i + 2}: `;
    const matches = assignments.filter((a) =>
      row.assignmentId
        ? a.id === row.assignmentId
        : a.schoolYear === row.schoolYear &&
          String(a.semester) === row.semester &&
          a.classCode === row.classCode &&
          String(a.courseCode).toUpperCase() === row.courseCode &&
          a.teacherId === row.teacherId,
    );
    if (matches.length !== 1) {
      errors.push(
        prefix +
          "Không tìm được một phân công duy nhất. Kiểm tra mã phân công hoặc năm học, học kỳ, lớp, học phần, giảng viên.",
      );
      return;
    }
    const a = matches[0];
    for (const k of [
      "schoolYear",
      "semester",
      "classCode",
      "courseCode",
      "teacherId",
    ])
      if (row[k] && row[k] !== String(a[k])) {
        errors.push(prefix + "Thông tin không khớp phân công.");
        return;
      }
    if (
      !row.date ||
      !Number.isInteger(row.startPeriod) ||
      !Number.isInteger(row.endPeriod) ||
      row.startPeriod < 1 ||
      row.endPeriod > 20 ||
      row.endPeriod < row.startPeriod ||
      !row.room ||
      row.room.length > 150
    ) {
      errors.push(
        prefix + "Ngày học, tiết học (1–20) hoặc phòng không hợp lệ.",
      );
      return;
    }
    const entry = {
      ...row,
      ...Object.fromEntries(
        [
          "schoolYear",
          "semester",
          "classCode",
          "courseCode",
          "teacherId",
          "teacherName",
          "courseName",
        ].map((k) => [k, a[k]]),
      ),
      assignmentId: a.id,
    };
    const same = known.some(
      (x) =>
        x.assignmentId === entry.assignmentId &&
        dateISO(x.date) === entry.date &&
        +x.startPeriod === entry.startPeriod &&
        +x.endPeriod === entry.endPeriod &&
        text(x.room || x.phong) === entry.room,
    );
    if (same) {
      duplicates++;
      return;
    }
    const conflict = known.find(
      (x) =>
        dateISO(x.date || x.ngayHoc) === entry.date &&
        +x.startPeriod <= entry.endPeriod &&
        +x.endPeriod >= entry.startPeriod &&
        (x.classCode === entry.classCode ||
          x.teacherId === entry.teacherId ||
          text(x.room || x.phong).toLowerCase() === entry.room.toLowerCase()),
    );
    if (conflict) {
      errors.push(
        prefix + "Trùng tiết với lịch của lớp, giảng viên hoặc phòng.",
      );
      return;
    }
    additions.push(entry);
    known.push(entry);
  });
  return { errors, additions, duplicates };
}
module.exports = { prepareSchedule };
