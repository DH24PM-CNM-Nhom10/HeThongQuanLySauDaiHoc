function savedScores(book) {
  return Array.isArray(book?.scores)
    ? book.scores
    : Array.isArray(book?.publishedScores)
      ? book.publishedScores
      : [];
}
function coursePolicy(store, code) {
  const course = (store.courses || []).find(
    (c) => c.code === String(code).toUpperCase(),
  );
  const scale =
    course &&
    (store.academicPolicies || []).find((p) => p.id === course.policyId);
  return course && scale
    ? {
        ...scale,
        id: course.code + ":" + course.revision,
        scaleId: scale.id,
        courseCode: course.code,
        processWeight: course.processWeight,
        examWeight: course.examWeight,
        description:
          course.name +
          " — quá trình " +
          course.processWeight * 100 +
          "%, thi " +
          course.examWeight * 100 +
          "%",
      }
    : null;
}
function validateCourse(c, store) {
  if (
    !c ||
    !/^[-\w.]{1,80}$/.test(c.code) ||
    !String(c.name || "").trim() ||
    String(c.name).length > 255
  )
    return "Nhập mã môn và tên môn hợp lệ.";
  if (
    !Number.isFinite(c.credits) ||
    c.credits <= 0 ||
    c.credits > 100 ||
    !Number.isFinite(c.gpaWeight) ||
    c.gpaWeight <= 0 ||
    c.gpaWeight > 100
  )
    return "Tín chỉ và trọng số GPA phải lớn hơn 0, không quá 100.";
  if (
    ![c.processWeight, c.examWeight].every(Number.isFinite) ||
    c.processWeight < 0 ||
    c.examWeight < 0 ||
    Math.abs(c.processWeight + c.examWeight - 1) > 1e-8
  )
    return "Tổng tỷ trọng điểm quá trình và thi phải bằng 100%.";
  if (!(store.academicPolicies || []).some((p) => p.id === c.policyId))
    return "Chọn thang điểm/GPA đã cấu hình.";
  if (
    !(store.catalogs || []).some(
      (p) => p.kind === "major" && p.code === c.majorCode,
    )
  )
    return "Chọn ngành có trong danh mục.";
  if (
    !["nghien_cuu", "ung_dung"].includes(c.track) ||
    !Array.isArray(c.semesters) ||
    !c.semesters.length ||
    c.semesters.some((n) => ![1, 2, 3, 4].includes(n))
  )
    return "Chọn định hướng và học kỳ trong chương trình.";
  return null;
}
module.exports = { savedScores, coursePolicy, validateCourse };
