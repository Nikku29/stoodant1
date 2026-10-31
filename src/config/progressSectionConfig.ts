// Text for the parent progress section, which is hidden until parent logins and real reports exist
// (StoodantLanding.tsx). Kept out of siteConfig so it doesn't ship with the home page while hidden.
export const PROGRESS_SECTION = {
  kicker: "Parent progress",
  headline: "See the learning, not just the marks.",
  sample: "Sample view",
  rings: [
    { label: "Attendance", value: 92 },
    { label: "Practice", value: 78 },
    { label: "Concepts", value: 84 },
  ],
  week: "This week",
  days: ["M", "T", "W", "T", "F", "S"],
  bars: [52, 76, 64, 88, 72, 94],
  reportTitle: "Weekly report",
  reportCopy: "A simple view of topics covered, practice, and what comes next.",
} as const;
