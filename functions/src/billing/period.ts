// Monthly plans, worked out from the payments themselves. A child's paid-until date is never stored on its
// own: it is replayed from every confirmed plan payment in the order they were paid, so cancelling or
// correcting a payment can never leave a wrong date behind.
//
// Rules (from how subscription services handle this, owner request 2026-10-26):
// - A month runs from the start day to the day before the same day next month. Starting on the 31st (or
//   29th, 30th) keeps that day as the anchor and uses the month's last day when it is shorter, so dates
//   never drift to the 28th.
// - Paying before the end, or within the grace days after it, continues from the old end: no lost days
//   and no free days. Paying later starts fresh from the day of payment.
// - A payment being checked by the team keeps classes open, so a slow check never pauses a family.
//
// The app has the same file (src/lib/billing/period.ts) to show dates and prices; a test keeps them equal.

/** Days after the end of a plan when classes stay open while the family renews. */
export const GRACE_DAYS = 3;
/** Days before the end of a plan when the family is reminded to renew. */
export const SOON_DAYS = 5;
/** The plan lengths a family can choose, in months. */
export const PLAN_MONTHS = [1, 3, 6, 12] as const;

const DAY = 86_400_000;
const parse = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => iso(parse(day) + n * DAY);
export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to) - parse(from)) / DAY);

/** The anchor day `months` later: Jan 31 + 1 month is Feb 28 (or 29), then Mar 31 with the same anchor. */
export function addMonths(day: string, months: number, anchor = +day.slice(8, 10)): string {
  const y = +day.slice(0, 4);
  const m = +day.slice(5, 7) - 1 + months;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(Date.UTC(year, month, Math.min(anchor, last)));
}

export type PlanPayment = { id: string; months: number; payDay: string; order: number };
export type Period = { id: string; from: string; to: string };

/** Every confirmed payment's period, and the day classes are paid until ('' when never paid). */
export function replay(payments: PlanPayment[]): {
  paidUntil: string;
  anchor: number;
  periods: Period[];
} {
  const sorted = [...payments]
    .filter((p) => p.months > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.payDay))
    .sort((a, b) => a.payDay.localeCompare(b.payDay) || a.order - b.order);
  let paidUntil = "";
  let anchor = 0;
  const periods: Period[] = [];
  for (const p of sorted) {
    const continues = paidUntil && addDays(paidUntil, 1 + GRACE_DAYS) >= p.payDay;
    const from = continues ? addDays(paidUntil, 1) : p.payDay;
    if (!continues) anchor = +from.slice(8, 10);
    const to = addDays(addMonths(from, p.months, anchor), -1);
    periods.push({ id: p.id, from, to });
    paidUntil = to;
  }
  return { paidUntil, anchor, periods };
}

/**
 * Where a family stands today. `open` says whether the child's classes, material and updates are on.
 * - new: never paid (classes start after the first payment)
 * - active / ending: paid; ending in the last SOON_DAYS days
 * - grace: the plan ended, still open for GRACE_DAYS more days
 * - paused: ended longer ago; pay to continue
 * - checking: a payment is waiting for the team to confirm it; open meanwhile
 */
export type BillingStatus = "new" | "active" | "ending" | "grace" | "paused" | "checking";
export function billingStatus(today: string, paidUntil: string, checking: boolean) {
  const daysLeft = paidUntil ? daysBetween(today, paidUntil) : null;
  let status: BillingStatus;
  if (daysLeft == null) status = checking ? "checking" : "new";
  else if (daysLeft >= SOON_DAYS) status = "active";
  else if (daysLeft >= 0) status = "ending";
  else if (daysLeft >= -GRACE_DAYS) status = checking ? "checking" : "grace";
  else status = checking ? "checking" : "paused";
  return { status, daysLeft, open: status !== "new" && status !== "paused" };
}

/** The next plan, if the family paid today: it starts after the current one, or today when lapsed. */
export function nextPeriod(today: string, paidUntil: string, anchor: number, months: number) {
  const continues = paidUntil && addDays(paidUntil, 1 + GRACE_DAYS) >= today;
  const from = continues ? addDays(paidUntil, 1) : today;
  const to = addDays(
    addMonths(from, months, continues && anchor ? anchor : +from.slice(8, 10)),
    -1,
  );
  return { from, to };
}

/** Reminder stages in order; each is sent once per plan end date. */
export const STAGES = ["soon", "last", "grace", "paused"] as const;
export type Stage = (typeof STAGES)[number];
export function reminderStage(status: BillingStatus, daysLeft: number | null): Stage | null {
  if (status === "ending") return daysLeft != null && daysLeft <= 1 ? "last" : "soon";
  if (status === "grace") return "grace";
  if (status === "paused") return "paused";
  return null;
}

/** Price of a plan: the monthly fee times the months, less the team's percent off for paying ahead (max 50%). */
export function planPrice(
  monthlyFee: number,
  months: number,
  planOff: Record<string, unknown> | undefined,
) {
  const list = monthlyFee * months;
  const off = planOff?.[String(months)];
  const percent = Math.min(
    50,
    Math.max(0, Math.round(typeof off === "number" && Number.isFinite(off) ? off : 0)),
  );
  return { list, percent, amount: list - Math.round((list * percent) / 100) };
}
