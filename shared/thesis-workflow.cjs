const { studentStatus } = require("./student-status.cjs");
const { dateISO, thesisValues } = require("./thesis-progress.cjs");
function workflowView(store, code) {
  const workflow = (store.thesisWorkflows || []).find(
    (w) => w.maHocVien === code,
  ) || { maHocVien: code, revision: 0, requests: [], council: null };
  return workflow;
}
function applyWorkflow(store, code, actor, input) {
  const student = store.students.find(
    (s) => String(s.maHocVien || s.ma_hoc_vien || "").toUpperCase() === code,
  );
  if (!student) throw new Error("Không tìm thấy học viên.");
  const beforeStudent = JSON.parse(JSON.stringify(student));
  const old = workflowView(store, code);
  if (input.revision !== old.revision)
    throw new Error("Quy trình đã thay đổi. Hãy tải lại.");
  const w = JSON.parse(JSON.stringify(old)),
    action = input.action,
    text = (v) => String(v ?? "").trim(),
    now = new Date().toISOString();
  if (
    ["topic_request", "extension_request", "defense_request"].includes(action)
  ) {
    const kind = action.split("_")[0];
    if (w.requests.some((r) => r.kind === kind && r.status === "pending"))
      throw new Error("Đang có yêu cầu cùng loại chờ xử lý.");
    const reason = text(input.reason);
    if (!reason || reason.length > 2000)
      throw new Error("Nhập nội dung đề nghị (tối đa 2.000 ký tự).");
    if (
      kind === "topic" &&
      (!text(input.title) || text(input.title).length > 2000)
    )
      throw new Error("Nhập tên đề tài.");
    if (
      kind === "extension" &&
      (!dateISO(input.deadline) ||
        dateISO(input.deadline) !== input.deadline ||
        input.deadline <= now.slice(0, 10) ||
        (dateISO(student.ngayHetHan) &&
          input.deadline <= dateISO(student.ngayHetHan)))
    )
      throw new Error(
        "Ngày gia hạn phải sau thời hạn hiện tại và ngày hôm nay.",
      );
    if (kind === "defense" && !text(student.tenLuanVan))
      throw new Error("Chưa có đề tài được ghi nhận.");
    w.requests.push({
      id: globalThis.crypto.randomUUID(),
      kind,
      status: "pending",
      title: kind === "topic" ? text(input.title) : "",
      deadline: kind === "extension" ? input.deadline : "",
      reason,
      createdAt: now,
      createdBy: actor.name,
    });
  } else {
    if (!actor.manager) throw new Error("Chỉ cán bộ quản lý được xét duyệt.");
    if (action === "council") {
      const ids = store.teachers.map((t) => ({
        id: String(t.shcc || t.id),
        name: String(t.hoten || t.hoTen || ""),
      }));
      const chair = ids.find((t) => t.id === input.chair),
        reviewer = ids.find((t) => t.id === input.reviewer);
      if (!chair || !reviewer || chair.id === reviewer.id)
        throw new Error(
          "Chọn chủ tịch và phản biện là hai giảng viên khác nhau.",
        );
      if (
        [chair.name, reviewer.name].some((name) =>
          [thesisValues(student).gvHuongDan1, thesisValues(student).gvHuongDan2].includes(name),
        )
      )
        throw new Error(
          "Giảng viên hướng dẫn không được làm chủ tịch hoặc phản biện của học viên.",
        );
      w.council = {
        chair: chair.id,
        reviewer: reviewer.id,
        chairName: chair.name,
        reviewerName: reviewer.name,
        decision: text(input.decision),
        createdAt: now,
      };
      if (!w.council.decision)
        throw new Error("Nhập số quyết định thành lập hội đồng.");
    } else if (["approve", "reject"].includes(action)) {
      const r = w.requests.find((r) => r.id === input.requestId);
      if (!r || r.status !== "pending")
        throw new Error("Yêu cầu không còn chờ duyệt.");
      const reason = text(input.reason);
      if (!reason || reason.length > 2000)
        throw new Error("Nhập ý kiến xét duyệt.");
      if (action === "approve") {
        if (r.kind === "topic") {
          if (
            !dateISO(input.decisionDate) ||
            dateISO(input.decisionDate) !== input.decisionDate
          )
            throw new Error("Chọn ngày quyết định giao đề tài.");
          student.tenLuanVan = r.title;
          student.ngayQD = input.decisionDate;
          student.trangThaiLv = "Đang thực hiện";
        }
        if (r.kind === "extension") {
          if (
            dateISO(student.ngayHetHan) &&
            r.deadline <= dateISO(student.ngayHetHan)
          )
            throw new Error("Thời hạn đã thay đổi. Cần nộp lại yêu cầu.");
          student.ngayHetHan = r.deadline;
          if (studentStatus(student) === "overdue") student.trangThai = "Đang học";
        }
        if (r.kind === "defense") {
          if (!w.council || input.eligibilityConfirmed !== true)
            throw new Error(
              "Lập hội đồng và xác nhận đã đối chiếu điều kiện bảo vệ.",
            );
          student.trangThaiLv = "Chờ bảo vệ";
        }
      }
      r.status = action === "approve" ? "approved" : "rejected";
      r.reviewReason = reason;
      r.reviewedAt = now;
      r.reviewedBy = actor.name;
    } else throw new Error("Thao tác không hợp lệ.");
  }
  if (JSON.stringify(student) !== JSON.stringify(beforeStudent)) {
    store.studentHistory ??= [];
    store.studentHistory.push({action:'thesis-decision',code,actor:actor.name,at:now,before:beforeStudent,after:{...student}});
  }
  w.revision++;
  store.thesisWorkflows = (store.thesisWorkflows || []).filter(
    (x) => x.maHocVien !== code,
  );
  store.thesisWorkflows.push(w);
  store.thesisHistory ??= [];
  store.thesisHistory.push({
    code,
    action,
    actor: actor.name,
    at: now,
    before: old,
    after: w,
  });
  return w;
}
function councilConflict(store,code,names) {
  const council=(store.thesisWorkflows||[]).find(w=>w.maHocVien===code)?.council;
  if(!council)return false;
  const roleNames=(store.teachers||[]).filter(t=>[council.chair,council.reviewer].includes(String(t.shcc||t.id))).map(t=>String(t.hoten||t.hoTen||t.ho_ten||'').trim());
  return names.filter(Boolean).some(name=>roleNames.includes(String(name).trim()));
}
module.exports = { workflowView, applyWorkflow, councilConflict };
