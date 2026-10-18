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
  students: ["Aarav Mehta", "Diya Nair", "Kabir Singh", "Meera Iyer", "Rohan Das"],
};
