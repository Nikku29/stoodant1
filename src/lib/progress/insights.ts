import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";

// Everything a teacher enters comes down to three kinds of record. Dates are "YYYY-MM-DD".
export type AttendanceStatus = "present" | "late" | "absent" | "cancelled";
export type AttendanceRecord = { date: string; subject: string; status: AttendanceStatus };
/** score is null when the child missed the test; that test is left out of averages. */
export type TestRecord = {
  date: string;
  subject: string;
  title: string;
  score: number | null;
  max: number;
};
export type TeacherNote = { date: string; subject: string; teacher: string; lines: string[] };

export type Student = {
  id: string;
  name: string;
  classLevel: string;
  board: "CBSE" | "ICSE";
  batch: string;
  parentName: string;
  subjects: string[];
};

export type StudentRecords = {
  student: Student;
  attendance: AttendanceRecord[];
  tests: TestRecord[];
  notes: TeacherNote[];
};

export type Trend = "up" | "steady" | "down" | "unknown";
export type Period = { from: string; to: string };

const { trendThreshold, trendWindow } = DASHBOARD_CONFIG.insights;

const inPeriod = (date: string, p: Period) => date >= p.from && date <= p.to;
const round = (n: number) => Math.round(n);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Marks as a percentage, so a test out of 20 and one out of 50 can be compared. */
export const testPercent = (t: TestRecord) =>
  t.score == null || t.max <= 0 ? null : (t.score / t.max) * 100;

/**
 * Attendance = classes attended / classes held. Late counts as attended. Classes Stoodant cancelled
 * are not counted at all, so a cancelled class never lowers a child's attendance.
 */
export function attendanceSummary(records: AttendanceRecord[], period: Period) {
  const held = records.filter((r) => inPeriod(r.date, period) && r.status !== "cancelled");
  const attended = held.filter((r) => r.status !== "absent").length;
  return {
    held: held.length,
    attended,
    percent: held.length ? round((attended / held.length) * 100) : null,
  };
}

/**
 * Improvement compares the child with their own earlier tests, never with classmates.
 * Take the latest tests in a subject (up to trendWindow) and the same number just before them;
 * the difference between the two averages, in percentage points, is the improvement.
 * Missed tests are skipped. With fewer than two marked tests there is nothing to compare yet.
 */
export function improvement(tests: TestRecord[]): { delta: number | null; trend: Trend } {
  const scores = tests
    .filter((t) => testPercent(t) != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => testPercent(t) as number);
  const size = Math.min(trendWindow, Math.floor(scores.length / 2));
  if (size < 1) return { delta: null, trend: "unknown" };
  const recent = mean(scores.slice(-size)) as number;
  const earlier = mean(scores.slice(-2 * size, -size)) as number;
  const delta = round(recent - earlier);
  return {
    delta,
    trend: delta >= trendThreshold ? "up" : delta <= -trendThreshold ? "down" : "steady",
  };
}

export type SubjectSummary = {
  subject: string;
  average: number | null;
  latest: { title: string; percent: number | null; date: string } | null;
  delta: number | null;
  trend: Trend;
  /** Every marked test so far, oldest first, for the small trend line. */
  history: number[];
  attendance: ReturnType<typeof attendanceSummary>;
};

/**
 * One subject over a period. The average uses only tests inside the period; the trend looks at
 * all tests up to the end of the period, so a quiet week still shows where the child is heading.
 */
export function subjectSummary(
  records: StudentRecords,
  subject: string,
  period: Period,
): SubjectSummary {
  const all = records.tests
    .filter((t) => t.subject === subject && t.date <= period.to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const inside = all.filter((t) => inPeriod(t.date, period));
  const percents = inside.map(testPercent).filter((p): p is number => p != null);
  const avg = mean(percents);
  const last = all.at(-1);
  return {
    subject,
    average: avg == null ? null : round(avg),
    latest: last
      ? {
          title: last.title,
          percent: testPercent(last) == null ? null : round(testPercent(last) as number),
          date: last.date,
        }
      : null,
    ...improvement(all),
    history: all
      .map(testPercent)
      .filter((p): p is number => p != null)
      .map(round),
    attendance: attendanceSummary(
      records.attendance.filter((r) => r.subject === subject),
      period,
    ),
  };
}

export type Overview = {
  attendance: ReturnType<typeof attendanceSummary>;
  /** Average of the subject averages, so a subject with many small tests doesn't outweigh the rest. */
  average: number | null;
  /** Average of the subject improvements that could be measured. */
  delta: number | null;
  trend: Trend;
  subjects: SubjectSummary[];
  strongest: SubjectSummary | null;
  focus: SubjectSummary | null;
  tests: (TestRecord & { percent: number | null })[];
  notes: TeacherNote[];
};

export function overview(records: StudentRecords, period: Period): Overview {
  const subjects = records.student.subjects.map((s) => subjectSummary(records, s, period));
  const averages = subjects.map((s) => s.average).filter((a): a is number => a != null);
  const deltas = subjects.map((s) => s.delta).filter((d): d is number => d != null);
  const avgDelta = mean(deltas);
  const delta = avgDelta == null ? null : round(avgDelta);
  const ranked = subjects
    .filter((s) => s.average != null)
    .sort((a, b) => (b.average as number) - (a.average as number));
  // "Focus" is the subject that dipped most; if nothing dipped, the lowest average, but only when it trails clearly.
  const dipped = subjects
    .filter((s) => s.trend === "down")
    .sort((a, b) => (a.delta as number) - (b.delta as number))[0];
  const best = ranked[0];
  const worst = ranked.at(-1);
  const lowest =
    best &&
    worst &&
    best !== worst &&
    (best.average as number) - (worst.average as number) >= trendThreshold
      ? worst
      : null;
  const focus = dipped ?? lowest;
  return {
    attendance: attendanceSummary(records.attendance, period),
    average: averages.length ? round(mean(averages) as number) : null,
    delta,
    trend:
      delta == null
        ? "unknown"
        : delta >= trendThreshold
          ? "up"
          : delta <= -trendThreshold
            ? "down"
            : "steady",
    subjects,
    strongest: best && ranked.length > 1 && best !== focus ? best : null,
    focus,
    tests: records.tests
      .filter((t) => inPeriod(t.date, period))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => ({
        ...t,
        percent: testPercent(t) == null ? null : round(testPercent(t) as number),
      })),
    notes: records.notes
      .filter((n) => inPeriod(n.date, period))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

// ---- Periods ----
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Monday to Sunday of the week that contains `date`. */
export function weekOf(date: string): Period {
  const d = toDate(date);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: toIso(monday), to: toIso(sunday) };
}

/** First to last day of the month that contains `date`. */
export function monthOf(date: string): Period {
  const d = toDate(date);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { from: toIso(first), to: toIso(last) };
}

export const formatDay = (iso: string) =>
  toDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export const formatMonth = (iso: string) =>
  toDate(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
