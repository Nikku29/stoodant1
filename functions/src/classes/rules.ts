// Plain checks for live classes, kept free of Firebase so they can be unit-tested.

/** Zoom and Google Meet links only: a typo or a random site never reaches a child. */
export function meetingLink(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 500) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const zoom = host === "zoom.us" || host.endsWith(".zoom.us") || host === "zoom.com" || host.endsWith(".zoom.com");
  const meet = host === "meet.google.com";
  if (!zoom && !meet) return null;
  if (meet && !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname) && !url.pathname.startsWith("/lookup/")) return null;
  if (zoom && !/^\/(j|my|w|s|wc)\//.test(url.pathname)) return null;
  return url.toString();
}

export const MIN_MINUTES = 15;
export const MAX_MINUTES = 240;
export const MAX_DAYS_AHEAD = 120;
export const MAX_IN_SERIES = 26;

export type Slot = { start: number; end: number };
export const overlaps = (a: Slot, b: Slot) => a.start < b.end && b.start < a.end;

/** Start times as milliseconds, or an error message a teacher can act on. */
export function checkStarts(starts: unknown, now: number): number[] | string {
  if (!Array.isArray(starts) || starts.length === 0) return "Pick a date and time.";
  if (starts.length > MAX_IN_SERIES) return `Schedule at most ${MAX_IN_SERIES} classes at once.`;
  const times = starts.map((s) => (typeof s === "string" ? Date.parse(s) : NaN));
  if (times.some((t) => !Number.isFinite(t))) return "One of the dates isn't valid.";
  if (times.some((t) => t < now - 5 * 60_000)) return "That time has already passed.";
  if (times.some((t) => t > now + MAX_DAYS_AHEAD * 86_400_000))
    return `Classes can be scheduled up to ${MAX_DAYS_AHEAD} days ahead.`;
  return [...new Set(times)].sort((a, b) => a - b);
}

const IST = "Asia/Kolkata";
/** "Tue 28 Oct, 5:00 pm" in India time, whatever the server's clock zone. */
export function when(ms: number) {
  const d = new Date(ms);
  const day = d.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true });
  return `${day.replace(",", "")}, ${time.replace(/\s?(AM|PM)$/i, (m) => ` ${m.trim().toLowerCase()}`)}`;
}
