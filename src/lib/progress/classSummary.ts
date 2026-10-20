import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { improvement, type Trend } from "./insights";

// The teacher's view of a whole batch: who is coming, how the class is doing in tests, and who might
// need a word. Built from the same class records the teacher saves, so it needs no extra data entry.

export type Mark = "present" | "late" | "absent";
export type ClassDay = {
  date: string;
  status: "held" | "cancelled";
  attendance: Record<string, Mark>;
};
export type TestSheet = {
  id: string;
  title: string;
  date: string;
  max: number;
  scores: Record<string, number | null>;
  /** When it was saved (ms). A teacher can remove a test for two days after saving it. */
  createdAt?: number | undefined;
};
export type BatchHistory = { days: ClassDay[]; tests: TestSheet[] };

export type StudentRow = {
  id: string;
  name: string;
  held: number;
  attended: number;
  attendance: number | null;
  average: number | null;
  latest: number | null;
  trend: Trend;
  flags: string[];
};

const { attendanceWatch } = DASHBOARD_CONFIG.insights;
const WINDOW_DAYS = 30;
const RECENT_TESTS = 5;
const round = (n: number) => Math.round(n);
const pct = (score: number | null | undefined, max: number) =>
  score == null || max <= 0 ? null : (score / max) * 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function daysBefore(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Attendance over the last 30 days and marks over the last five tests, per child and for the class. */
export function classSummary(
  roster: { id: string; name: string }[],
  history: BatchHistory,
  today: string,
) {
  const since = daysBefore(today, WINDOW_DAYS - 1);
  const held = history.days.filter(
    (d) => d.status === "held" && d.date >= since && d.date <= today,
  );
  const tests = [...history.tests].sort((a, b) => a.date.localeCompare(b.date));
  const recent = tests.slice(-RECENT_TESTS);

  const rows: StudentRow[] = roster.map(({ id, name }) => {
    // Only class days on which the child was on the roster count.
    const days = held.filter((d) => id in d.attendance);
    const attended = days.filter((d) => d.attendance[id] !== "absent").length;
    const attendance = days.length ? round((attended / days.length) * 100) : null;
    const mine = recent.filter((t) => id in t.scores);
    const marks = mine.map((t) => pct(t.scores[id], t.max)).filter((p): p is number => p != null);
    const lastTest = tests.filter((t) => id in t.scores).at(-1);
    const { trend } = improvement(
      tests
        .filter((t) => id in t.scores)
        .map((t) => ({
          date: t.date,
          subject: "",
          title: t.title,
          score: t.scores[id] ?? null,
          max: t.max,
        })),
    );
    const flags: string[] = [];
    if (attendance != null && attendance < attendanceWatch) flags.push("Missing classes");
    if (trend === "down") flags.push("Marks dipping");
    if (lastTest && lastTest.scores[id] == null) flags.push("Missed the last test");
    const average = marks.length ? round(mean(marks) as number) : null;
    return {
      id,
      name,
      held: days.length,
      attended,
      attendance,
      average,
      latest: lastTest
        ? pct(lastTest.scores[id], lastTest.max) == null
          ? null
          : round(pct(lastTest.scores[id], lastTest.max) as number)
        : null,
      trend,
      flags,
    };
  });

  const attendances = rows.map((r) => r.attendance).filter((a): a is number => a != null);
  const averages = rows.map((r) => r.average).filter((a): a is number => a != null);
  return {
    rows,
    classesHeld: held.length,
    testsCount: recent.length,
    attendance: attendances.length ? round(mean(attendances) as number) : null,
    average: averages.length ? round(mean(averages) as number) : null,
    needAttention: rows.filter((r) => r.flags.length).length,
  };
}

/** The class average for one test, among the children who sat it. */
export function testAverage(t: TestSheet): number | null {
  const marks = Object.values(t.scores)
    .map((s) => pct(s, t.max))
    .filter((p): p is number => p != null);
  return marks.length ? round(mean(marks) as number) : null;
}
