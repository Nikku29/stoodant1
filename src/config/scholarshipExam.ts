// The scholarship test's days, hours and screen text. Only /scholarship and /exam load this file.
// The days and hours must match functions/src/exam/slots.ts.
export const SCHOLARSHIP_EXAM = {
  dates: ["2026-11-10", "2026-11-11"],
  /** Slot start hours, India time: 9 AM to 8 PM. */
  hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  minutes: 60,
  /** Questions in each of the 4 sections (and marks: +1 each). Must match the blueprint in functions/src/scholarship/exam/paper.ts. */
  perSection: 15,
  lateJoinMinutes: 15,
  /** Rules on screen before the questions open; not taken from the 60 minutes. Must match READING_MINUTES in slots.ts. */
  readingMinutes: 2,
  /** Log-in on the exam page opens this long before the hour, to read the rules. Must match EARLY_LOGIN_MINUTES in slots.ts. */
  earlyLoginMinutes: 5,
  /** The login page opens this long before the slot, so the student can be ready. */
  earlyMinutes: 10,
  bookingClosesMinutes: 30,
  slots: {
    heading: "Pick the exam hour",
    lead: "Choose any one hour on 10 or 11 November that suits your child (school days, Diwali plans). You can change it until 30 minutes before.",
    yours: "Exam hour",
    change: "Change hour",
    full: "Full",
    closed: "Closed",
    saving: "Saving…",
    errors: {
      full: "That hour just filled up. Please pick another one.",
      closed: "Changes are closed for this hour.",
      network: "Couldn't save. Please check your internet connection and try again.",
    },
    notPaidYet: "You can pick the exam hour once the test fee is confirmed.",
  },
  join: {
    button: "Join the exam",
    opensAt: "The Join button and the exam password appear here at {time} on {date}, 10 minutes before your hour.",
    open: "The exam is open now. Join within the first 15 minutes of your hour.",
    password: "Exam password (date of birth)",
    passwordNote: "It is the student's date of birth: day, month, year ({date}). Type it on the exam page with the roll number.",
    missed: "This exam hour has passed. Please WhatsApp us if something went wrong.",
  },
  exam: {
    title: "Stoodant Scholarship Test",
    rollLabel: "Roll number",
    passwordLabel: "Password",
    passwordHint: "The password is the student's date of birth: day, month, year, 8 digits. For example, 29 April 2003 is 29042003.",
    paperOnPhone: "Your paper is already on this phone. It opens when you start.",
    start: "Log in",
    starting: "Logging in…",
    rules: {
      heading: "Read the rules",
      lead: "Read this carefully. The questions open by themselves when the countdown below ends, and your 60 minutes start only then.",
      startsIn: "The test begins in {time}",
      tabHeading: "Do not leave this page",
      tab: [
        "Do not switch to another app or tab, and do not lock the phone or take calls.",
        "Each time you leave, you get a warning. The third time, the test ends at once and your answers are submitted.",
      ],
      cameraHeading: "The camera takes photos",
      camera: [
        "The front camera takes photos of you at random moments during the test.",
        "Sit alone, in good light, with your face clearly visible. No books, notes or other people.",
        "The photos are checked before any scholarship is given, and deleted after the results.",
      ],
      cameraAllow: "Allow camera",
      cameraOn: "Camera is on",
      cameraOffNote: "The camera is off or not allowed. Your paper is marked for a closer check. Tap to try again.",
      marksHeading: "Marks distribution",
      marksColumns: { section: "Section", questions: "Questions", marks: "Marks" },
      marksTotal: "Total",
      formatHeading: "Format and marking",
      format: [
        "60 questions in 4 sections: Mathematics, Science, Reasoning and English (15 each). 60 minutes in all.",
        "Every question has 4 options and one right answer. Correct answer: 1 mark. Wrong or no answer: 0 marks.",
        "If two students have the same marks, the one who took less time ranks higher.",
      ],
      howHeading: "How to answer",
      how: [
        "Tap an option, then Save & Next. Mark for Review lets you come back to a question later.",
        "Use the section tabs or the Questions list to move around at any time.",
        "Answers save automatically. If the internet or phone stops, log in again within your hour and carry on.",
        "The test submits itself when the time is up.",
      ],
    },
    errors: {
      login: "The roll number or password is not right. Please check and try again.",
      too_early: "Log-in opens at {time}, 5 minutes before your exam hour. Keep this page open: it logs you in by itself then.",
      missed: "The time to start this exam hour has passed (you can join up to 15 minutes late).",
      no_slot: "No exam hour is booked for this roll number. Please pick one on the scholarship page.",
      finished: "This test has already been submitted.",
      rate_limited: "Too many tries. Please wait a few minutes and try again.",
      network: "Couldn't connect. Please check the internet and try again.",
    },
    sections: { maths: "Mathematics", science: "Science", reasoning: "Reasoning", english: "English" },
    timeLeft: "Time left",
    question: "Question {n}",
    saveNext: "Save & Next",
    markNext: "Mark for Review & Next",
    clear: "Clear Response",
    back: "Back",
    submit: "Submit",
    palette: "Questions",
    legend: { notVisited: "Not visited", notAnswered: "Not answered", answered: "Answered", marked: "Marked for review", answeredMarked: "Answered & marked" },
    confirmHeading: "Submit the test?",
    confirmLead: "You can't change answers after submitting.",
    confirmYes: "Yes, submit",
    confirmNo: "Go back",
    saving: "Saving…",
    savedAt: "Saved",
    offline: "No internet: answers are kept on this phone and sent when it's back.",
    strike: [
      "Warning 1 of 3: please stay on the test page.",
      "Warning 2 of 3: leaving the page once more will end the test.",
      "Third time away from the page: the test has been submitted.",
    ],
    strikeOk: "I understand",
    doneHeading: "Test submitted",
    doneLead: "Thank you! Results and scholarships are announced on the scholarship page and on WhatsApp.",
    doneTimeout: "Time is up: your saved answers have been submitted.",
    doneStruck: "The test ended after 3 warnings for leaving the page. Your saved answers have been submitted.",
    back_home: "Back to the scholarship page",
    leave: "Leave the test? Your answers so far are saved, but the timer keeps running and leaving the page counts as a warning. You can log in again within your hour.",
  },
  /** The mock test (/exam?practice=9 or 10): the real test's format, screens and rules with practice-only questions. */
  practice: {
    title: "Mock test",
    lead: "Read the format and the rules, then tap Next. Your 60 minutes start only when the questions open.",
    badge: "Not counted for the scholarship",
    note: "This is a mock test in exactly the real test's format: 60 questions in 4 sections, 60 minutes, the same screens and rules. These questions are only for practice and do not come in the exam.",
    cameraNote: "In the real test the front camera takes photos. The mock test does not use the camera.",
    startNow: "Next: begin the mock test",
    resultHeading: "Mock test result",
    score: "You scored {marks} out of {total}.",
    bySection: "{section}: {marks} / {total}",
    yours: "Your answer",
    correct: "Correct answer",
    none: "Not answered",
    again: "Take the mock test again",
    link: "Take a free mock test",
    linkNote: "The real test's format: 60 questions, 60 minutes, the same screens and rules. The questions don't come in the exam.",
    leave: "Leave the mock test? Your answers will be lost.",
    savedNote: "Your score is saved with your registration.",
  },
} as const;

const IST_MS = 330 * 60 * 1000;
export const slotId = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}`;
export function slotStart(id: string): number {
  const [date, hour] = id.split("T");
  const [y, m, d] = date!.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!, Number(hour)) - IST_MS;
}
const hourText = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
/** "5 PM to 6 PM" */
export const slotHours = (id: string) => { const h = Number(id.split("T")[1]); return `${hourText(h)} to ${hourText(h + 1)}`; };
/** "Tue, 10 Nov" */
export const slotDay = (id: string) =>
  new Date(`${id.split("T")[0]}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const slotLabel = (id: string) => `${slotDay(id)}, ${slotHours(id)}`;
