export type ScheduleRow = {
  id: string; courseCode: string; courseName: string; classCode: string;
  schoolYear: string; semester: string; time: string; room: string; hasSchedule: boolean;
  dayOfWeek?: number | string | null; thu?: number | string | null;
  startPeriod?: number | string | null; endPeriod?: number | string | null;
  periodCount?: number | string | null; date?: string | number; startDate?: string | number; endDate?: string | number;
  teacherName?: string;
};

export function normalizeStudentSchedule(raw: unknown, index: number): ScheduleRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const text = (...keys: string[]) => {
    for (const key of keys) if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return String(row[key]).trim();
    return "";
  };
  return {
    id: `student:${text("id", "assignmentId")}:${index}`,
    courseCode: text("courseCode", "maMon", "ma_mon"),
    courseName: text("courseName", "tenMon", "ten_mon") || "Chưa cập nhật học phần",
    classCode: text("classCode", "lop", "maLop", "LOP"),
    teacherName: text("teacherName", "tenGV", "tenGiangVien"),
    schoolYear: text("schoolYear", "namHoc", "nam_hoc"),
    semester: text("semester", "hocKy", "hoc_ky"),
    time: text("time", "thoiGian", "thoi_gian"), room: text("room", "phong"), hasSchedule: true,
    dayOfWeek: text("dayOfWeek", "weekday"), thu: text("thu"),
    startPeriod: text("startPeriod", "tietBatDau", "tiet_bat_dau"),
    endPeriod: text("endPeriod", "tietKetThuc", "tiet_ket_thuc"),
    periodCount: text("periodCount", "soTiet"),
    date: text("date", "ngayHoc", "ngay_hoc"),
    startDate: text("startDate", "ngayBatDau"), endDate: text("endDate", "ngayKetThuc"),
  };
}
const DAY_MS = 86400000;

export function parseScheduleDate(value: unknown = ""): Date | null {
  const text = String(value ?? "").trim();
  if (/^\d{5}(?:\.\d+)?$/.test(text) && Number(text) < 100000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * DAY_MS);
  }
  const vn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = vn ? `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`
    : /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(text)?.[1];
  if (!iso) return null;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? date : null;
}
export function mondayOf(date: Date) {
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
}
export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}
export function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
export function displayDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
export function todayInVietnam() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00Z`);
}
export function lessonPosition(row: ScheduleRow) {
  const date = parseScheduleDate(row.date);
  if (String(row.date ?? "").trim() && !date) return null;
  const namedDay = /thứ\s*(hai|ba|tư|bốn|năm|sáu|bảy|[2-7])|chủ\s*nhật/i.exec(row.time);
  const dayNames = ["hai", "ba", "tư", "năm", "sáu", "bảy"];
  const named = namedDay?.[1]?.toLowerCase();
  let vietnameseDay = Number(row.thu);
  if (!vietnameseDay && named) {
    vietnameseDay = /^[2-7]$/.test(named) ? Number(named) : dayNames.indexOf(named) + 2;
    if (named === "bốn") vietnameseDay = 4;
  }
  if (!vietnameseDay && namedDay && !named) vietnameseDay = 8;
  const day = date ? (date.getUTCDay() || 7) : Number(row.dayOfWeek) || vietnameseDay - 1;
  const periods = /tiết\s*(\d{1,2})(?:\s*(?:-|–|—|đến)\s*(?:tiết\s*)?(\d{1,2}))?/i.exec(row.time);
  const start = Number(row.startPeriod) || Number(periods?.[1]);
  const end = Number(row.endPeriod) || Number(periods?.[2]) ||
    (Number(row.periodCount) ? start + Number(row.periodCount) - 1 : start);
  if (!Number.isInteger(day) || day < 1 || day > 7 || !Number.isInteger(start) ||
      !Number.isInteger(end) || start < 1 || end < start || end > 20) return null;
  return { day, start, end, date };
}
export function lessonInWeek(row: ScheduleRow, week: Date) {
  const position = lessonPosition(row);
  if (!position) return null;
  const dayDate = addDays(week, position.day - 1);
  if (position.date && dateKey(position.date) !== dateKey(dayDate)) return null;
  const start = parseScheduleDate(row.startDate);
  const end = parseScheduleDate(row.endDate);
  if ((start && dayDate < start) || (end && dayDate > end)) return null;
  return position;
}

export function arrangeLessons(rows: ScheduleRow[], week: Date, day: number) {
  const lessons = rows.flatMap(row => {
    const position = lessonInWeek(row, week);
    return position?.day === day ? [{ row, ...position, lane: 0 }] : [];
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.row.id.localeCompare(b.row.id));
  const laneEnds: number[] = [];
  for (const lesson of lessons) {
    let lane = laneEnds.findIndex(end => end < lesson.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = lesson.end;
    lesson.lane = lane;
  }
  return { lessons, laneCount: Math.max(1, laneEnds.length) };
}
