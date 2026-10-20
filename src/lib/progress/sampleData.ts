import type { BatchHistory, ClassDay, TestSheet } from "./classSummary";
import type { AttendanceRecord, StudentRecords, TeacherNote, TestRecord } from "./insights";

// Made-up records for the preview pages. Nothing here is a real student.
// "Today" in the preview is always the same Sunday, so the numbers never shift between visits.
export const SAMPLE_TODAY = "2026-10-18";

// Weekday (0 = Sunday) each subject's class falls on.
const timetable: Record<string, number[]> = { Maths: [1, 3, 5], Science: [2, 4], English: [6] };
// Days the child missed, and days Stoodant cancelled the class.
const missed = new Set(["2026-09-17", "2026-10-07", "2026-10-15"]);
const cancelled = new Set(["2026-10-02"]);

function attendance(from: string, to: string): AttendanceRecord[] {
  const out: AttendanceRecord[] = [];
  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const date = d.toISOString().slice(0, 10);
    for (const [subject, days] of Object.entries(timetable)) {
      if (!days.includes(d.getUTCDay())) continue;
      out.push({
        date,
        subject,
        status: cancelled.has(date)
          ? "cancelled"
          : missed.has(date)
            ? "absent"
            : date === "2026-09-24"
              ? "late"
              : "present",
      });
    }
  }
  return out;
}

const t = (
  date: string,
  subject: string,
  title: string,
  score: number | null,
  max: number,
): TestRecord => ({ date, subject, title, score, max });

const tests: TestRecord[] = [
  t("2026-09-05", "Maths", "Integers quiz", 11, 20),
  t("2026-09-12", "Maths", "Integers test", 26, 50),
  t("2026-09-19", "Maths", "Fractions quiz", 13, 20),
  t("2026-09-26", "Maths", "Fractions test", 33, 50),
  t("2026-10-03", "Maths", "Decimals quiz", 15, 20),
  t("2026-10-10", "Maths", "Data handling quiz", 16, 20),
  t("2026-10-16", "Maths", "Simple equations test", 41, 50),
  t("2026-09-08", "Science", "Nutrition in plants", 15, 20),
  t("2026-09-22", "Science", "Heat quiz", 16, 20),
  t("2026-10-06", "Science", "Acids and bases", 15, 20),
  t("2026-10-13", "Science", "Weather and climate", null, 20),
  t("2026-10-15", "Science", "Weather and climate (retest)", 16, 20),
  t("2026-09-12", "English", "Grammar: tenses", 17, 25),
  t("2026-09-26", "English", "Comprehension", 15, 25),
  t("2026-10-10", "English", "Letter writing", 14, 25),
  t("2026-10-17", "English", "Grammar: voice", 13, 25),
];

const notes: TeacherNote[] = [
  {
    date: "2026-09-27",
    subject: "Maths",
    teacher: "Ms Priya",
    lines: ["Homework done well", "Needs more practice with fractions"],
  },
  {
    date: "2026-10-11",
    subject: "Maths",
    teacher: "Ms Priya",
    lines: ["Big improvement this week"],
  },
  {
    date: "2026-10-17",
    subject: "Maths",
    teacher: "Ms Priya",
    lines: ["Asks good questions", "Solved every equation in the test on his own"],
  },
  {
    date: "2026-10-17",
    subject: "English",
    teacher: "Mr Joseph",
    lines: ["Needs more practice", "We'll read one short story together each week"],
  },
];

export const SAMPLE_RECORDS: StudentRecords = {
  student: {
    id: "sample-aarav",
    name: "Aarav Mehta",
    classLevel: "7",
    board: "CBSE",
    batch: "Small Group (1:5)",
    parentName: "Mrs Mehta",
    subjects: ["Maths", "Science", "English"],
  },
  attendance: attendance("2026-09-01", SAMPLE_TODAY),
  tests,
  notes,
};

/** A sample batch for the teacher page. */
export const SAMPLE_BATCH = {
  name: "Class 7 CBSE · Maths",
  schedule: "Mon, Wed, Fri · 5:00 pm",
  students: ["Aarav Mehta", "Diya Nair", "Kabir Singh", "Meera Iyer", "Rohan Das"].map(
    (name, i) => ({ id: `sample-${i + 1}`, name }),
  ),
};

// Four weeks of Mon/Wed/Fri classes and weekly tests for the sample batch, so the teacher's class
// overview and recent entries have something to show in practice mode.
const absences: Record<string, string[]> = {
  "2026-09-23": ["sample-3"],
  "2026-09-30": ["sample-3", "sample-5"],
  "2026-10-07": ["sample-3"],
  "2026-10-12": ["sample-2"],
  "2026-10-14": ["sample-3"],
};
function sampleDays(): ClassDay[] {
  const out: ClassDay[] = [];
  for (
    let d = new Date("2026-09-21T00:00:00Z");
    d <= new Date(`${SAMPLE_TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if (![1, 3, 5].includes(d.getUTCDay())) continue;
    const date = d.toISOString().slice(0, 10);
    if (date === "2026-10-02") {
      out.push({ date, status: "cancelled", attendance: {} });
      continue;
    }
    out.push({
      date,
      status: "held",
      attendance: Object.fromEntries(
        SAMPLE_BATCH.students.map((s) => [
          s.id,
          absences[date]?.includes(s.id) ? "absent" : "present",
        ]),
      ),
    });
  }
  return out;
}
const sheet = (
  id: string,
  date: string,
  title: string,
  max: number,
  marks: (number | null)[],
): TestSheet => ({
  id,
  date,
  title,
  max,
  scores: Object.fromEntries(SAMPLE_BATCH.students.map((s, i) => [s.id, marks[i] ?? null])),
  // Saved the evening after the test.
  createdAt: Date.parse(`${date}T18:00:00+05:30`) + 86_400_000,
});
export const SAMPLE_HISTORY: BatchHistory = {
  days: sampleDays(),
  tests: [
    sheet("sample-t1", "2026-09-26", "Fractions test", 50, [33, 41, 30, 45, 28]),
    sheet("sample-t2", "2026-10-03", "Decimals quiz", 20, [15, 17, 12, 18, 11]),
    sheet("sample-t3", "2026-10-10", "Data handling quiz", 20, [16, 18, 10, 19, null]),
    sheet("sample-t4", "2026-10-16", "Simple equations test", 50, [41, 44, 26, 47, 30]),
  ],
};
