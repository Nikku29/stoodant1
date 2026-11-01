// The scholarship test's days, hours and screen text. Only /scholarship and /exam load this file.
// The days and hours must match functions/src/exam/slots.ts.
export const SCHOLARSHIP_EXAM = {
  dates: ["2026-11-10", "2026-11-11"],
  /** Slot start hours, India time: 9 AM to 8 PM. */
  hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  minutes: 60,
  lateJoinMinutes: 15,
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
    password: "Exam password",
    passwordNote: "Type this on the exam page with the roll number.",
    missed: "This exam hour has passed. Please WhatsApp us if something went wrong.",
  },
  exam: {
    title: "Stoodant Scholarship Test",
    rollLabel: "Roll number",
    passwordLabel: "Password",
    passwordHint: "The student's date of birth as DDMMYYYY. For example, 5 August 2011 is 05082011.",
    paperOnPhone: "Your paper is already on this phone. It opens when you start.",
    instructions: [
      "60 questions in 4 sections: Mathematics, Science, Reasoning and English. 60 minutes in all.",
      "Each correct answer gets 1 mark. No marks are taken off for a wrong answer.",
      "Save & Next saves your answer. Mark for Review lets you come back to a question later. You can move between sections at any time.",
      "Your answers are saved automatically. If the internet or the phone stops, log in again in the same hour and carry on.",
      "Stay on this page. Leaving it (switching apps or tabs) gives a warning. The third time, the test ends and is submitted.",
      "The test ends on its own when the time is up.",
    ],
    agree: "I have read the instructions.",
    start: "Start the test",
    starting: "Starting…",
    errors: {
      login: "The roll number or password is not right. Please check and try again.",
      too_early: "Your exam hour has not started yet. This page will open the test at {time}.",
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
