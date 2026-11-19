export type Marks = { process: string; exam: string };
export type ImportedGrade = { code: string; process?: string; exam?: string };

export function validMark(value: string) {
  const raw = value.trim().replace(",", ".");
  return raw === "" || /^(?:10(?:\.0{1,2})?|[0-9](?:\.[0-9]{1,2})?)$/.test(raw);
}
export function numericMark(value: string) {
  const raw = value.trim().replace(",", ".");
  return raw === "" || !validMark(raw) ? null : Number(raw);
}
function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
}
const aliases = {
  code: ["mahocvien", "mahv", "mssv", "masinhvien"],
  process: ["diemquatrinh", "diemqt", "diemthanhphan", "processscore"],
  exam: ["diemthiketthuc", "diemthi", "thiketthuc", "diemck", "examscore"],
};

export function parseGradeImport(
  rows: unknown[][],
  context: { codes: string[]; assignmentId: string; courseCode: string; classCode: string },
) {
  let headerIndex = -1;
  let columns = { code: -1, process: -1, exam: -1 };
  for (let index = 0; index < rows.length; index++) {
    const headers = rows[index].map(normalizeHeader);
    const candidate = {
      code: headers.findIndex(value => aliases.code.includes(value)),
      process: headers.findIndex(value => aliases.process.includes(value)),
      exam: headers.findIndex(value => aliases.exam.includes(value)),
    };
    if (candidate.code >= 0 && (candidate.process >= 0 || candidate.exam >= 0)) {
      headerIndex = index;
      columns = candidate;
      break;
    }
  }
  if (headerIndex < 0) throw new Error("Cần cột Mã học viên và cột Điểm quá trình hoặc Điểm thi kết thúc.");
  const metadata: Record<string, string> = {
    maphancong: context.assignmentId, mahocphan: context.courseCode, lop: context.classCode,
  };
  for (const row of rows) {
    if (row.slice(2).some(value => String(value ?? "").trim() !== "")) continue;
    const key = normalizeHeader(row[0]);
    const value = String(row[1] ?? "").trim().replace(/^'(?=[=+@-])/, "").toUpperCase();
    if (Object.hasOwn(metadata, key) && value !== metadata[key].toUpperCase()) {
      throw new Error("File thuộc học phần hoặc lớp khác. Hãy kiểm tra lại file và lớp đang chọn.");
    }
  }
  const known = new Map(context.codes.map(code => [code.trim().toUpperCase(), code]));
  const seen = new Set<string>();
  const changes: ImportedGrade[] = [];
  let skipped = 0;
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    const process = columns.process < 0 ? "" : String(row[columns.process] ?? "").trim();
    const exam = columns.exam < 0 ? "" : String(row[columns.exam] ?? "").trim();
    if (!process && !exam) continue;
    const rawCode = String(row[columns.code] ?? "").trim().toUpperCase();
    const code = known.get(rawCode) ?? known.get(rawCode.replace(/^'/, ""));
    if (!code) { skipped++; continue; }
    if (seen.has(code)) throw new Error(`Mã học viên ${code} xuất hiện nhiều lần trong file.`);
    if ((process && !validMark(process)) || (exam && !validMark(exam))) {
      throw new Error(`Dòng ${index + 1}: điểm của ${code} phải từ 0–10, tối đa hai chữ số thập phân.`);
    }
    seen.add(code);
    changes.push({
      code,
      ...(process ? { process: String(numericMark(process)) } : {}),
      ...(exam ? { exam: String(numericMark(exam)) } : {}),
    });
  }
  if (!changes.length) throw new Error("Không có điểm hợp lệ của học viên trong lớp đang chọn.");
  return { changes, skipped };
}
