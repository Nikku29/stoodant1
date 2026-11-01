// Exam days and one-hour slots. Must match SCHOLARSHIP_EXAM in src/config/scholarshipExam.ts.
export const EXAM_DATES = ["2026-11-10", "2026-11-11"] as const;
/** Slot start hours, India time: 9 AM to 8 PM (the last slot runs 8 to 9 PM). */
export const SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
export const DEFAULT_CAPACITY = 600;
export const EXAM_MINUTES = 60;
/** Reading time for the rules before the questions open. Not taken from the 60 minutes. */
export const READING_MINUTES = 2;
/** Log-in opens this long before the slot, so the student reads the rules and format before the hour starts. */
export const EARLY_LOGIN_MINUTES = 5;
/** A student may start up to this late into their slot; the paper still ends with the slot (+ these minutes). */
export const LATE_JOIN_MINUTES = 15;
/** Slot changes close this long before either slot starts. */
export const BOOKING_CLOSES_MINUTES = 30;
const IST_OFFSET_MS = 330 * 60 * 1000;
const MIN = 60 * 1000;

/** "2026-11-10T17" is 10 Nov, 5 to 6 PM India time. */
export const slotId = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}`;
export const ALL_SLOTS: string[] = EXAM_DATES.flatMap((d) => SLOT_HOURS.map((h) => slotId(d, h)));
export const isSlot = (id: unknown): id is string => typeof id === "string" && ALL_SLOTS.includes(id);

/** Start of a slot in milliseconds since 1970 (UTC). */
export function slotStart(id: string): number {
  const [date, hour] = id.split("T");
  const [y, m, d] = date!.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!, Number(hour)) - IST_OFFSET_MS;
}

/** Log-in (and the rules page) opens 5 minutes before the hour. */
export const loginOpens = (id: string) => slotStart(id) - EARLY_LOGIN_MINUTES * MIN;
/**
 * When the questions open for a student who logs in at `startedAt`, by themselves (no tap needed): at the start of the
 * hour for anyone who logged in early, otherwise after 2 minutes' reading.
 */
export const questionsOpen = (id: string, startedAt: number) => Math.max(slotStart(id), startedAt + READING_MINUTES * MIN);
/** When they must finish: 60 minutes after the questions open, but never past the slot's end plus the late-join and reading minutes. */
export const paperEnds = (id: string, startedAt: number) =>
  Math.min(questionsOpen(id, startedAt) + EXAM_MINUTES * MIN, slotStart(id) + (EXAM_MINUTES + LATE_JOIN_MINUTES + READING_MINUTES) * MIN);
export const canStartAt = (id: string, now: number) => now >= loginOpens(id) && now <= slotStart(id) + LATE_JOIN_MINUTES * MIN;
export const bookingOpen = (id: string, now: number) => now < slotStart(id) - BOOKING_CLOSES_MINUTES * MIN;
