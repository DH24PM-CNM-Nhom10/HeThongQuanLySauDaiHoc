"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ScheduleRow, addDays, arrangeLessons, dateKey, displayDate,
  lessonPosition, mondayOf, parseScheduleDate, todayInVietnam, normalizeStudentSchedule,
} from "../../lib/teacher-schedule";
import styles from "./TeacherSchedule.module.css";

const DAYS = ["Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];
const termKey = (row: ScheduleRow) => row.schoolYear + "|" + row.semester;

export default function TeacherSchedule({ audience = "teacher" }: { audience?: "teacher" | "student" }) {
  const isStudent = audience === "student";
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [weekKey, setWeekKey] = useState(() => dateKey(mondayOf(todayInVietnam())));

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(isStudent ? "/api/student-records/schedule" : "/api/teacher-auth/schedule", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(response.status === 401
          ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : "Không tải được thời khóa biểu.");
        if (!Array.isArray(result.data)) throw new Error("Dữ liệu thời khóa biểu không hợp lệ.");
        if (!controller.signal.aborted) {
          const data: ScheduleRow[] = isStudent
            ? result.data.map(normalizeStudentSchedule).filter((row: ScheduleRow | null): row is ScheduleRow => row !== null)
            : result.data;
          setRows(data);
          if (data.length) setTerm(termKey(data[0]));
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được thời khóa biểu.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isStudent]);

  const terms = useMemo(() => [...new Map(rows.map(row => [termKey(row), row])).values()]
    .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) || a.semester.localeCompare(b.semester)), [rows]);
  const filtered = useMemo(() => rows.filter(row => termKey(row) === term), [rows, term]);
  const week = parseScheduleDate(weekKey)!;
  const weekOptions = Array.from({ length: 53 }, (_, index) => addDays(week, (index - 26) * 7));
  const dayColumns = DAYS.map((_, index) => arrangeLessons(filtered, week, index + 1));
  const periodCount = Math.max(12, ...dayColumns.flatMap(column => column.lessons.map(lesson => lesson.end)));
  const unplaced = filtered.filter(row => !lessonPosition(row));
  const visibleLessons = dayColumns.reduce((count, column) => count + column.lessons.length, 0);
  const shiftWeek = (days: number) => setWeekKey(dateKey(addDays(week, days)));

  return <section className={styles.page} aria-labelledby={`${audience}-schedule-title`}>
    <header className={styles.heading}><h1 id={`${audience}-schedule-title`}>Thông tin thời khóa biểu</h1></header>
    <div className={styles.toolbar}>
      <label>Chọn học kỳ xem TKB
        <select value={term} onChange={event => setTerm(event.target.value)} disabled={!terms.length}>
          {!terms.length && <option value="">Chưa có dữ liệu học kỳ</option>}
          {terms.map(row => <option key={termKey(row)} value={termKey(row)}>{row.semester || row.schoolYear
            ? `Học kỳ ${row.semester || "chưa cập nhật"} · Năm học ${row.schoolYear || "chưa cập nhật"}`
            : "Chưa cập nhật học kỳ / năm học"}</option>)}
        </select>
      </label>
      <label>TKB theo tuần
        <select value={weekKey} onChange={event => setWeekKey(event.target.value)}>
          {weekOptions.map(start => <option key={dateKey(start)} value={dateKey(start)}>
            {displayDate(start)} – {displayDate(addDays(start, 6))}
          </option>)}
        </select>
      </label>
    </div>

    <p className={styles.weekTitle}>Tuần từ {displayDate(week)} đến {displayDate(addDays(week, 6))}</p>
    {loading && <p className={styles.notice} role="status">Đang tải thời khóa biểu…</p>}
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {!loading && !error && <>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label={isStudent ? "Lịch học theo thứ và tiết" : "Lịch giảng dạy theo thứ và tiết"}>
        <div className={styles.grid}>
          <div className={styles.corner}>Tiết</div>
          {DAYS.map((day, index) => <div key={day} className={styles.dayHeading}>
            <strong>{day}</strong><span>{displayDate(addDays(week, index))}</span>
          </div>)}
          <div className={styles.corner}>Tiết</div>
          <div className={styles.periods}>{Array.from({ length: periodCount }, (_, index) => <div key={index}>Tiết {index + 1}</div>)}</div>
          {dayColumns.map(({ lessons, laneCount }, index) => <div key={DAYS[index]}
            className={styles.dayColumn}
            style={{ gridTemplateRows: `repeat(${periodCount}, var(--period-height))`, gridTemplateColumns: `repeat(${laneCount}, minmax(0, 1fr))` }}
          >
            {lessons.map(lesson => <article key={lesson.row.id} className={styles.lesson}
              style={{ gridRow: `${lesson.start} / span ${lesson.end - lesson.start + 1}`, gridColumn: lesson.lane + 1 }}
              title={`${lesson.row.courseName} · ${lesson.row.classCode} · Tiết ${lesson.start}–${lesson.end} · ${lesson.row.room || "Chưa cập nhật phòng"}`}
            >
              <strong>{lesson.row.courseName}</strong>
              <span>{lesson.row.classCode}</span>
              {isStudent && lesson.row.teacherName && <span>GV: {lesson.row.teacherName}</span>}
              <span>Phòng {lesson.row.room || "chưa cập nhật"}</span>
              <small>Tiết {lesson.start}{lesson.end !== lesson.start ? "–" + lesson.end : ""}</small>
            </article>)}
          </div>)}
          <div className={styles.periods}>{Array.from({ length: periodCount }, (_, index) => <div key={index}>Tiết {index + 1}</div>)}</div>
          <div className={styles.corner}>Tiết</div>
          {DAYS.map(day => <div key={day} className={styles.dayHeading}><strong>{day}</strong></div>)}
          <div className={styles.corner}>Tiết</div>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => shiftWeek(-7)}>Tuần trước</button>
        <button type="button" onClick={() => setWeekKey(dateKey(mondayOf(todayInVietnam())))}>Tuần hiện tại</button>
        <button type="button" onClick={() => shiftWeek(7)}>Tuần sau</button>
      </div>
      {visibleLessons === 0 && <p className={styles.notice} role="status">{isStudent ? "Chưa có lịch học theo tiết trong tuần này." : "Chưa có lịch giảng dạy theo tiết trong tuần này."}</p>}
      {unplaced.length > 0 && <details className={styles.pending}>
        <summary>Học phần đang chờ cập nhật thứ / tiết ({unplaced.length})</summary>
        <ul>{unplaced.map(row => <li key={row.id}><strong>{row.courseName}</strong> · {row.classCode}
          {row.time ? " · " + row.time : " · Chưa xếp lịch"}
          {row.room ? " · Phòng " + row.room : ""}</li>)}</ul>
      </details>}
    </>}
  </section>;
}
