const { dateISO } = require("./thesis-progress.cjs");
function validateTerm(term) {
  const years = /^(20\d{2})-(20\d{2})$/.exec(String(term?.schoolYear || ""));
  if (
    !years ||
    +years[2] !== +years[1] + 1 ||
    !["1", "2"].includes(String(term?.semester))
  )
    return "Chọn năm học liên tiếp và học kỳ 1 hoặc 2.";
  if (
    !dateISO(term.startDate) ||
    dateISO(term.startDate) !== term.startDate ||
    !dateISO(term.endDate) ||
    dateISO(term.endDate) !== term.endDate ||
    term.startDate > term.endDate
  )
    return "Ngày bắt đầu/kết thúc học kỳ không hợp lệ.";
  if (
    +term.startDate.slice(0, 4) < +years[1] ||
    +term.endDate.slice(0, 4) > +years[2]
  )
    return "Ngày học kỳ phải thuộc hai năm của năm học đã chọn.";
  return null;
}
module.exports = { validateTerm };
