import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import {
  GRACE_DAYS,
  PLAN_MONTHS,
  addDays,
  billingStatus,
  nextPeriod,
  planPrice,
  type BillingStatus,
} from "@/lib/billing/period";
import { rupees, type Billing, type Fee, type PaySettings } from "@/lib/firebase/fees";
import type { StudentRecords } from "@/lib/progress/insights";

const copy = DASHBOARD_CONFIG.plan;

/** "25 Nov 2026": paid-until dates can be months away, so they carry the year. */
export const longDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export const monthsLabel = (n: number) =>
  n === 1 ? copy.month : copy.months.replace("{n}", String(n));

/** A family's monthly plan: read the paid-until date, and start paying for some months. */
export type PlanStore = {
  billing(): Promise<Billing | null>;
  /** Starts (or changes) the payment for `months`; resolves to the fee to pay. */
  start(months: number): Promise<string>;
};

export type PlanState = {
  billing: Billing | null;
  status: BillingStatus;
  daysLeft: number | null;
  /** Whether classes, material and updates are open for the child. */
  open: boolean;
};

/**
 * Where the family stands today. Worked out again here from the paid-until date (the stored status moves
 * on once a morning), counting a payment of theirs still being checked straight away.
 */
export function planState(billing: Billing | null, fees: Fee[], today: string): PlanState {
  const checking =
    Boolean(billing?.checking) || fees.some((f) => f.kind === "plan" && f.status === "submitted");
  const s = billingStatus(today, billing?.paidUntil ?? "", checking);
  return {
    billing,
    status: s.status,
    daysLeft: s.daysLeft,
    open: billing?.active !== false && s.open,
  };
}

/**
 * The child's plan: undefined while loading; null when there are no plans to go by (no store, or the
 * plans aren't switched on yet), so nothing is held back.
 */
export function usePlan(
  store: { plan?: PlanStore; list(): Promise<Fee[]> } | undefined,
  today: string,
) {
  const [state, setState] = useState<PlanState | null | undefined>(store?.plan ? undefined : null);
  const reload = useCallback(() => {
    const plan = store?.plan;
    if (!plan) return setState(null);
    Promise.all([plan.billing(), store.list()]).then(
      ([billing, fees]) => setState(planState(billing, fees, today)),
      () => setState((s) => s ?? null),
    );
  }, [store, today]);
  useEffect(reload, [reload]);
  return [state, reload] as const;
}

/** What the plan says, in one line for the family. */
export function planLine(state: PlanState): string {
  const until = state.billing?.paidUntil ?? "";
  switch (state.status) {
    case "active":
    case "ending":
      return copy.paidUntil.replace("{date}", longDay(until));
    case "grace":
      return copy.grace
        .replace("{end}", longDay(until))
        .replace("{date}", longDay(addDays(until, GRACE_DAYS)));
    case "paused":
      return copy.paused.replace("{date}", longDay(until));
    case "checking":
      return copy.checking;
    case "new":
      return copy.newLead;
  }
}

/** The plan at the top of the Fees screen, with Renew or pay ahead. */
export function PlanCard({
  state,
  onRenew,
}: {
  state: PlanState;
  onRenew?: (() => void) | undefined;
}) {
  return (
    <section className="pd-card pd-plan" data-status={state.status} aria-labelledby="pd-plan-title">
      <div className="pd-item-head">
        <strong id="pd-plan-title">{copy.title}</strong>
        <span className="pd-plan-chip" data-status={state.status}>
          {copy.status[state.status]}
        </span>
      </div>
      <p>{planLine(state)}</p>
      {onRenew && (
        <button
          type="button"
          className={state.status === "active" ? "pd-ghost" : "pd-save"}
          onClick={onRenew}
        >
          {copy.renew}
        </button>
      )}
    </section>
  );
}

/** 1, 3, 6 or 12 months: the price, any discount for paying ahead, and the days each one covers. */
export function PlanPicker({
  billing,
  pay,
  today,
  busy,
  error,
  onContinue,
  onCancel,
}: {
  billing: Billing;
  pay: PaySettings | null | undefined;
  today: string;
  busy: boolean;
  error: string | null;
  onContinue: (months: number) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [months, setMonths] = useState<number>(1);
  const options = PLAN_MONTHS.map((m) => ({
    m,
    price: planPrice(billing.monthlyFee, m, pay?.planOff),
    period: nextPeriod(today, billing.paidUntil, billing.anchor, m),
  }));
  const chosen = options.find((o) => o.m === months) ?? options[0]!;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onContinue(months);
  };
  return (
    <form className="pd-card pd-stack pd-plan-pick" onSubmit={submit}>
      <fieldset className="pd-plans">
        <legend>{copy.pick}</legend>
        {options.map((o) => (
          <label key={o.m} className="pd-plan-opt" data-on={o.m === months || undefined}>
            <input
              type="radio"
              name="pd-plan-months"
              value={o.m}
              checked={o.m === months}
              onChange={() => setMonths(o.m)}
            />
            <span className="pd-plan-len">{monthsLabel(o.m)}</span>
            <strong className="pd-plan-price">{rupees(o.price.amount)}</strong>
            {o.price.percent > 0 && (
              <span className="pd-plan-save">
                {copy.save.replace("{percent}", String(o.price.percent))}
              </span>
            )}
            <small className="pd-muted">
              {o.m > 1 &&
                `${copy.perMonth.replace("{amount}", rupees(Math.round(o.price.amount / o.m)))} · `}
              {copy.covers
                .replace("{from}", longDay(o.period.from))
                .replace("{to}", longDay(o.period.to))}
            </small>
          </label>
        ))}
      </fieldset>
      {billing.paidUntil && chosen.period.from > today && (
        <p className="pd-hint" style={{ margin: 0 }}>
          {copy.ahead.replace("{date}", longDay(billing.paidUntil))}
        </p>
      )}
      {error && (
        <p className="pd-alert" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="pd-save" disabled={busy}>
        {busy ? copy.starting : copy.continue.replace("{amount}", rupees(chosen.price.amount))}
      </button>
      {onCancel && (
        <button type="button" className="pd-link" onClick={onCancel}>
          {copy.hide}
        </button>
      )}
    </form>
  );
}

/**
 * Before the first payment, and after a plan has paused: only this screen, with the child's details,
 * the plan picker and the way to pay. Everything else opens once the family has paid.
 */
export function Paywall({
  records,
  state,
  hello,
  children,
}: {
  records: StudentRecords;
  state: PlanState;
  hello: string;
  children: ReactNode;
}) {
  const { student } = records;
  const first = student.name.split(" ")[0] ?? student.name;
  const paused = state.status === "paused";
  const parent = student.parentName.trim();
  return (
    <>
      <section className="pd-child" aria-labelledby="pd-paywall-title">
        <p className="pd-hello">
          {hello}
          {parent ? `, ${parent}` : ""}
        </p>
        <h1 id="pd-paywall-title">
          {(paused ? copy.pausedTitle : copy.newTitle).replace("{child}", first)}
        </h1>
        <p>
          {paused
            ? copy.pausedLead.replace("{date}", longDay(state.billing?.paidUntil ?? ""))
            : copy.newLead}
        </p>
      </section>
      <dl className="pd-card pd-plan-who">
        <div>
          <dt>{copy.child}</dt>
          <dd>
            {student.name} · Class {student.classLevel} · {student.board}
          </dd>
        </div>
        <div>
          <dt>{copy.batches}</dt>
          <dd>{student.batch || copy.noBatch}</dd>
        </div>
        {student.subjects.length > 0 && (
          <div>
            <dt>{copy.subjects}</dt>
            <dd>{student.subjects.join(", ")}</dd>
          </div>
        )}
      </dl>
      {children}
      <a
        className="pd-ghost pd-plan-help"
        href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(`Hi Stoodant, I have a question about ${student.name}'s fees.`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {copy.help}
      </a>
    </>
  );
}
