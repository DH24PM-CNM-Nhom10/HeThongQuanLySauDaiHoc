function programSemester(
  schoolYear,
  semester,
  admissionYear,
  startSemester = 1,
  durationSemesters,
) {
  const year = /^(20\d{2})-(20\d{2})$/.exec(String(schoolYear));
  if (
    !year ||
    +year[2] !== +year[1] + 1 ||
    !["1", "2"].includes(String(semester)) ||
    !Number.isInteger(Number(admissionYear))
  )
    return null;
  const n =
    (+year[1] - Number(admissionYear)) * 2 +
    Number(semester) -
    Number(startSemester) +
    1;
  return Number.isInteger(n) &&
    n >= 1 &&
    (!durationSemesters || n <= durationSemesters)
    ? n
    : null;
}
module.exports = { programSemester };
