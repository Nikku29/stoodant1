// Editable labels and insight rules for the parent dashboard (/parent) and the teacher page (/teacher).
// Kept apart from siteConfig.ts on purpose: siteConfig ships with the landing page, and nothing here
// should add weight to it. How these numbers are used is explained in PROGRESS_PLAN.md.
export const DASHBOARD_CONFIG = {
  insights: {
    // A change in marks of at least this many percentage points counts as a real move, up or down.
    trendThreshold: 5,
    // Improvement compares the average of the latest tests with the tests just before them.
    // This is how many tests sit in each of those two groups (fewer are used when there aren't enough).
    trendWindow: 3,
    // Attendance at or above "good" reads well; below "watch" gets a gentle note in the report.
    attendanceGood: 90,
    attendanceWatch: 75,
  },
  trendLabels: {
    up: "Improving",
    steady: "Steady",
    down: "Needs a little focus",
    unknown: "Too early to tell",
  },
  parent: {
    sampleBanner:
      "Preview with sample data. Real progress appears here once your child's classes begin.",
    periodWeek: "This week",
    periodMonth: "This month",
    attendance: "Attendance",
    average: "Average marks",
    improvement: "Improvement",
    subjects: "Subjects",
    tests: "Recent tests",
    teacherNote: "From the teacher",
    classes: "Classes",
    reportTitle: "Report sent on WhatsApp",
    reportWeekNote: "Sent every Sunday evening to the parent's WhatsApp number.",
    reportMonthNote: "Sent on the 1st of every month, with a link to this page.",
    askTeacher: "Ask the teacher on WhatsApp",
    noTests: "No tests in this period.",
    absent: "Absent",
  },
  teacher: {
    sampleBanner: "Practice mode. Nothing is saved yet, so feel free to try it.",
    tabs: { attendance: "Attendance", marks: "Test marks", notes: "Notes" },
    attendanceHint: "Everyone is marked present. Tap a name only if that child missed the class.",
    marksHint: "Type each child's marks. Leave a box empty if the child missed the test.",
    notesHint: "Pick a line or two for each child. These go into the weekly report to parents.",
    noteChips: [
      "Very attentive in class",
      "Asks good questions",
      "Homework done well",
      "Homework pending",
      "Needs more practice",
      "Big improvement this week",
      "Was quiet today, please check in",
    ],
    save: "Save",
    saved: "Saved",
  },
} as const;
