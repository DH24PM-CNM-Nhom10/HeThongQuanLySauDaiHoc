const { savedScores } = require("./course-grading.cjs");
function validatePolicy(p) {
  if (!p || typeof p.name !== "string" || !p.name.trim() || p.name.length > 200)
    return "Nhập tên quy chế.";
  if (!Number.isFinite(p.passScore) || p.passScore <= 0 || p.passScore > 10)
    return "Điểm đạt phải lớn hơn 0 và không quá 10.";
  if (
    p.processWeight !== undefined &&
    (![p.processWeight, p.examWeight].every(Number.isFinite) ||
      p.processWeight < 0 ||
      p.examWeight < 0 ||
      Math.abs(p.processWeight + p.examWeight - 1) > 1e-8)
  )
    return "Trọng số cũ không hợp lệ.";
  if (
    !Array.isArray(p.thresholds) ||
    !p.thresholds.length ||
    p.thresholds.length > 20
  )
    return "Nhập thang quy đổi điểm.";
  const seen = new Set();
  let last = 11,
    lastGpa = 5;
  for (const t of p.thresholds) {
    if (
      !Number.isFinite(t.min) ||
      t.min < 0 ||
      t.min >= last ||
      !Number.isFinite(t.gpa) ||
      t.gpa < 0 ||
      t.gpa > 4 ||
      typeof t.letter !== "string" ||
      !t.letter.trim() ||
      t.letter.length > 12 ||
      t.gpa > lastGpa ||
      seen.has(t.letter)
    )
      return "Thang điểm phải giảm dần, không trùng mức/điểm chữ; GPA từ 0–4.";
    last = t.min;
    lastGpa = t.gpa;
    seen.add(t.letter);
  }
  if (last !== 0) return "Thang quy đổi phải có mức cuối từ 0 điểm.";
  return null;
}
function validatePlan(p, store) {
  if (
    !p ||
    !store.students.some((s) => s.lop === p.classCode) ||
    !store.academicPolicies.some((x) => x.id === p.policyId)
  )
    return "Chọn lớp và quy chế hợp lệ.";
  if (
    !Number.isFinite(p.requiredCredits) ||
    p.requiredCredits <= 0 ||
    !Array.isArray(p.courses) ||
    !p.courses.length ||
    p.courses.length > 300
  )
    return "Nhập số tín chỉ yêu cầu và danh sách học phần.";
  const seen = new Set();
  let total = 0;
  for (const c of p.courses) {
    if (
      typeof c.code !== "string" ||
      !c.code.trim() ||
      c.code.length > 80 ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      !Number.isFinite(c.credits) ||
      c.credits <= 0 ||
      c.credits > 100 ||
      typeof c.required !== "boolean" ||
      seen.has(c.code.trim().toUpperCase())
    )
      return "Kiểm tra mã học phần, tên, tín chỉ và học phần trùng.";
    seen.add(c.code.trim().toUpperCase());
    total += c.credits;
  }
  if (p.requiredCredits > total)
    return "Tín chỉ yêu cầu không được vượt tổng tín chỉ trong kế hoạch.";
  return null;
}
function calculateProgress(store, code) {
  const student = store.students.find(
    (s) =>
      String(s.maHocVien || s.ma_hoc_vien || "").toUpperCase() ===
      String(code).toUpperCase(),
  );
  const plan =
      student &&
      (store.academicPlans || []).find((p) => p.classCode === student.lop),
    policy =
      plan &&
      (store.academicPolicies || []).find((p) => p.id === plan.policyId);
  if (!plan || !policy)
    return {
      configured: false,
      message: "Chưa cấu hình kế hoạch tín chỉ và quy chế điểm cho lớp.",
    };
  let earnedCredits = 0,
    gradedCredits = 0,
    weighted = 0;
  const courses = plan.courses.map((c) => {
    const configured = (store.courses || []).find(
      (row) => row.code === c.code.toUpperCase(),
    );
    const scale = configured
      ? (store.academicPolicies || []).find((p) => p.id === configured.policyId)
      : policy;
    const weight = configured?.gpaWeight ?? c.credits;
    const missingConfiguration = Array.isArray(store.courses) && !configured;
    const scores = [];
    for (const a of store.teachingAssignments || []) {
      if (String(a.courseCode).toUpperCase() !== c.code.toUpperCase()) continue;
      const b = (store.gradebooks || []).find((b) => b.assignmentId === a.id);
      if (
        !b?.roster?.some(
          (s) =>
            String(s.maHocVien).toUpperCase() === String(code).toUpperCase(),
        )
      )
        continue;
      if (
        missingConfiguration ||
        !scale ||
        ((b.gradingPolicy || b.publishedPolicy)?.scaleId ||
          (b.gradingPolicy || b.publishedPolicy)?.id) !== scale.id
      )
        continue;
      const score = savedScores(b).find(
        (s) => String(s.maHocVien).toUpperCase() === String(code).toUpperCase(),
      );
      if (Number.isFinite(score?.totalScore)) scores.push(score.totalScore);
    }
    const score = scores.length ? Math.max(...scores) : null,
      passed = score !== null && score >= scale.passScore,
      gpa =
        score === null
          ? null
          : (scale.thresholds.find((t) => score >= t.min)?.gpa ?? 0);
    if (passed) earnedCredits += c.credits;
    if (gpa !== null) {
      gradedCredits += weight;
      weighted += weight * gpa;
    }
    return {
      ...c,
      gpaWeight: weight,
      missingConfiguration,
      score,
      gpa,
      passed,
    };
  });
  return {
    configured: true,
    classCode: plan.classCode,
    policyName: policy.name,
    policyId: policy.id,
    requiredCredits: plan.requiredCredits,
    earnedCredits,
    remainingCredits: Math.max(0, plan.requiredCredits - earnedCredits),
    percent: Math.min(
      100,
      Math.round((earnedCredits / plan.requiredCredits) * 100),
    ),
    gpa: gradedCredits
      ? Math.round((weighted / gradedCredits) * 100) / 100
      : null,
    courses,
    academicEligible:
      earnedCredits >= plan.requiredCredits &&
      courses.filter((c) => c.required).every((c) => c.passed),
    note: "GPA tính theo trọng số từng môn, từ điểm giảng viên đã lưu; học lại lấy điểm cao nhất. Đủ điều kiện học thuật không đồng nghĩa được công nhận tốt nghiệp.",
  };
}
module.exports = { validatePolicy, validatePlan, calculateProgress };
