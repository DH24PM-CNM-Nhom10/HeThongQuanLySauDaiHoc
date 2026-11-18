export function studentCode(record: Record<string, unknown>) {
  const value = [record.maHocVien, record.ma_hoc_vien, record.MA_HOC_VIEN, record.mahv]
    .map((code) => String(code ?? "").trim())
    .find((code) => code !== "" && code !== "-");
  return value?.toUpperCase() ?? "";
}

export function appendNewStudents(
  existing: Record<string, unknown>[],
  incoming: Record<string, unknown>[],
) {
  const codes = new Set(existing.map(studentCode));
  const records = [...existing];
  let added = 0;
  let duplicates = 0;
  let missingCode = 0;

  for (const record of incoming) {
    const code = studentCode(record);
    if (!code) {
      missingCode++;
    } else if (codes.has(code)) {
      duplicates++;
    } else {
      codes.add(code);
      records.push(record);
      added++;
    }
  }

  return { records, added, duplicates, missingCode };
}
