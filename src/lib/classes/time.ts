// India-time helpers for live classes. Every class is stored as an instant; teachers and parents always
// see and type India time (IST, UTC+5:30, no daylight saving), whatever their phone's own zone says.
const IST_MS = 5.5 * 3_600_000;
/** How early the Join button turns on. */
export const JOIN_EARLY_MIN = 10;

const pad = (n: number) => String(n).padStart(2, "0");

/** The India date and time of an instant, as the date and time inputs want them. */
export function istParts(ms: number): { date: string; time: string; weekday: number } {
  const d = new Date(ms + IST_MS);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    weekday: d.getUTCDay(),
  };
}

/** "2026-10-28" + "17:00" in India → an ISO string the server reads unambiguously. */
export const istIso = (date: string, time: string) => `${date}T${time}:00+05:30`;

/**
 * The same class every week on the chosen weekdays (0 = Sunday), for `weeks` weeks starting on `date`,
 * at most `max` classes. With no days chosen, just the one class on `date`.
 */
export function weeklyStarts(date: string, time: string, days: number[], weeks: number, max = 26): string[] {
  if (!days.length) return [istIso(date, time)];
  const first = Date.parse(`${date}T00:00:00Z`);
  const out: string[] = [];
  for (let i = 0; i < weeks * 7 && out.length < max; i++) {
    const day = new Date(first + i * 86_400_000);
    if (days.includes(day.getUTCDay())) out.push(istIso(day.toISOString().slice(0, 10), time));
  }
  return out;
}

export type JoinState = "cancelled" | "ended" | "open" | "upcoming";

export function joinState(c: { startAt: number; endAt: number; status: string }, now: number): JoinState {
  if (c.status === "cancelled") return "cancelled";
  if (now > c.endAt) return "ended";
  if (now >= c.startAt - JOIN_EARLY_MIN * 60_000) return "open";
  return "upcoming";
}

export const time12 = (ms: number) => {
  const { time } = istParts(ms);
  const [h, m] = time.split(":").map(Number) as [number, number];
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
};

/** "Today, 5:00 pm", "Tomorrow, 5:00 pm" or "Wed 29 Oct, 5:00 pm" (India time). */
export function whenLabel(ms: number, now: number): string {
  const day = istParts(ms).date;
  if (day === istParts(now).date) return `Today, ${time12(ms)}`;
  if (day === istParts(now + 86_400_000).date) return `Tomorrow, ${time12(ms)}`;
  const d = new Date(`${day}T12:00:00Z`);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${wd} ${d.getUTCDate()} ${mon}, ${time12(ms)}`;
}

/** A short status line under a class: "Starts in 25 min", "On now, ends 6:00 pm", … */
export function statusLine(c: { startAt: number; endAt: number; status: string }, now: number): string {
  const state = joinState(c, now);
  if (state === "cancelled") return "Cancelled";
  if (state === "ended") return "Ended";
  if (now >= c.startAt) return `On now, ends ${time12(c.endAt)}`;
  const mins = Math.ceil((c.startAt - now) / 60_000);
  if (mins <= 60) return `Starts in ${mins} min`;
  return whenLabel(c.startAt, now);
}
