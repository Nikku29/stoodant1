import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { UpiQr } from "@/components/UpiQr";
export { UpiQr };
import { SITE_CONFIG } from "@/config/siteConfig";
import { isUtr, rupees, upiLink, type Fee, type PaySettings } from "@/lib/firebase/fees";
import {
  addDays as addDaysIso,
  addMonths as addMonthsIso,
  nextPeriod as nextPeriodIso,
  planPrice,
} from "@/lib/billing/period";
import type { Billing } from "@/lib/firebase/fees";
import { formatDay } from "@/lib/progress/insights";
import { PlanCard, PlanPicker, longDay, monthsLabel, type PlanState, type PlanStore } from "./Plan";

const copy = DASHBOARD_CONFIG.fees;
const plan = DASHBOARD_CONFIG.plan;

export type CouponResult =
  { payable: number; discount: number; percent: number; code: string } | { error: string };

/** Where a family's fees come from. The parent preview uses an in-memory one. */
export type FamilyFeeStore = {
  list(): Promise<Fee[]>;
  settings(): Promise<PaySettings | null>;
  applyCoupon(feeId: string, code: string): Promise<CouponResult>;
  submit(feeId: string, utr: string): Promise<void>;
  /** Monthly plans; left out, only the fees the team creates. */
  plan?: PlanStore;
  practice?: boolean;
};

const ORDER = { due: 0, submitted: 1, paid: 2, cancelled: 3 } as const;
/** Fees to pay first (soonest due), then the ones being checked, then paid ones (newest first). */
export function sortFees(fees: Fee[]): Fee[] {
  return [...fees].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] ||
      (a.status === "due"
        ? a.due.localeCompare(b.due)
        : (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt)),
  );
}

export const totalDue = (fees: Fee[]) =>
  fees.filter((f) => f.status === "due").reduce((n, f) => n + f.payable, 0);

const day = (ms: number) => formatDay(new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10));

// ---------------------------------------------------------------------------------------------------
// Families: what's due, pay by UPI, say it's paid, and a receipt once the team confirms it.

export function FamilyFees({
  store,
  childName,
  planState,
  paywall = false,
  today,
  onChanged,
}: {
  store: FamilyFeeStore;
  childName: string;
  /** The child's monthly plan, when plans are on. */
  planState?: PlanState | null | undefined;
  /** The payment screen before classes open: only the plan and what's left to pay. */
  paywall?: boolean;
  today?: string;
  /** Called after the family starts or sends a payment, so the plan is read again. */
  onChanged?: (() => void) | undefined;
}) {
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [pay, setPay] = useState<PaySettings | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Fee | null>(null);
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    Promise.all([store.list(), store.settings().catch(() => null)]).then(
      ([list, settings]) => {
        const sorted = sortFees(list);
        setFees(sorted);
        setPay(settings);
        // The first fee to pay opens by itself.
        setOpen((o) => o ?? sorted.find((f) => f.status === "due")?.id ?? null);
      },
      () => setFailed(true),
    );
  }, [store]);
  useEffect(reload, [reload]);
  // After choosing a plan, its payment steps come into view.
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!focus || !fees?.some((f) => f.id === focus)) return;
    document.getElementById(`fee-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocus(null);
  }, [focus, fees]);

  // The plan payment the family started and hasn't paid yet, if any.
  const duePlan = fees?.find((f) => f.kind === "plan" && f.status === "due");
  const sentPlan = fees?.some((f) => f.kind === "plan" && f.status === "submitted");
  const billing: Billing | null = planState?.billing ?? null;
  const canPay = Boolean(
    billing && billing.active && billing.batches.length > 0 && billing.monthlyFee > 0,
  );
  const day0 = today ?? new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const showPicker = canPay && !sentPlan && fees !== null && (picking || (paywall && !duePlan));
  const start = async (months: number) => {
    if (!store.plan) return;
    if (
      duePlan &&
      duePlan.months === months &&
      duePlan.listAmount === planPrice(billing!.monthlyFee, months, pay?.planOff).list
    ) {
      setPicking(false);
      setOpen(duePlan.id);
      setFocus(duePlan.id);
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const id = await store.plan.start(months);
      setPicking(false);
      setOpen(id);
      setFocus(id);
      reload();
      onChanged?.();
    } catch (e) {
      setStartError(e instanceof Error && e.message ? e.message : plan.startFailed);
    } finally {
      setStarting(false);
    }
  };
  // The payment screen shows what's left to do, not the history.
  const shown = paywall
    ? fees?.filter((f) => f.status === "due" || f.status === "submitted")
    : fees;

  const due = fees ? totalDue(fees) : 0;
  return (
    <>
      {store.practice && <p className="pd-hint">{copy.preview}</p>}
      {planState && !paywall && (
        <PlanCard
          state={planState}
          onRenew={canPay && !picking && !duePlan && !sentPlan ? () => setPicking(true) : undefined}
        />
      )}
      {paywall && billing && !canPay && (
        <p className="pd-alert">
          {!billing.active ? plan.left : billing.batches.length ? plan.notSet : plan.noBatchYet}
        </p>
      )}
      {paywall && !billing && planState && <p className="pd-alert">{plan.notSet}</p>}
      {showPicker && billing && (
        <PlanPicker
          billing={billing}
          pay={pay}
          today={day0}
          busy={starting}
          error={startError}
          onContinue={(m) => void start(m)}
          onCancel={paywall && !duePlan ? undefined : () => setPicking(false)}
        />
      )}
      {fees && !paywall && (
        <div className="pd-fee-total" data-clear={due === 0 || undefined}>
          <span>{due ? copy.toPay : copy.allPaid}</span>
          <strong>{due ? rupees(due) : "✓"}</strong>
        </div>
      )}
      {failed && <p className="pd-alert">{copy.loadFailed}</p>}
      {!fees && !failed && <p className="pd-muted">Loading…</p>}
      {fees && !fees.length && !planState && <p className="pd-empty">{copy.empty}</p>}
      {shown && shown.length > 0 && (
        <ul className="pd-list pd-fees">
          {shown.map((f) => (
            <li key={f.id} id={`fee-${f.id}`} className="pd-item pd-fee" data-status={f.status}>
              <div className="pd-item-head">
                <strong>{f.title}</strong>
                <span className="pd-fee-status" data-status={f.status}>
                  {copy.status[f.status]}
                </span>
              </div>
              <div className="pd-fee-line">
                <span className="pd-fee-amount">
                  {rupees(f.payable)}
                  {f.discount > 0 && <s>{rupees(f.amount)}</s>}
                </span>
                <small className="pd-muted">
                  {f.status === "paid"
                    ? `${copy.paidOn} ${day(f.paidAt)}`
                    : f.status === "submitted"
                      ? `${copy.ref} ${f.utr}`
                      : f.kind === "plan"
                        ? ""
                        : `${copy.dueOn} ${formatDay(f.due)}`}
                </small>
              </div>
              {f.kind === "plan" && f.periodFrom && (
                <small className="pd-muted">
                  {plan.classes}:{" "}
                  {plan.covers
                    .replace("{from}", longDay(f.periodFrom))
                    .replace("{to}", longDay(f.periodTo))}
                  {f.planPercent > 0 &&
                    ` · ${plan.save.replace("{percent}", String(f.planPercent))} (${rupees(f.listAmount)})`}
                </small>
              )}
              {f.status === "due" &&
                (open === f.id ? (
                  <PayPanel
                    fee={f}
                    pay={pay}
                    store={store}
                    childName={childName}
                    onDone={() => {
                      setOpen(null);
                      reload();
                      onChanged?.();
                    }}
                    onChanged={reload}
                  />
                ) : (
                  <button type="button" className="pd-save" onClick={() => setOpen(f.id)}>
                    {copy.payNow.replace("{amount}", rupees(f.payable))}
                  </button>
                ))}
              {f.status === "due" && f.kind === "plan" && canPay && !showPicker && (
                <button type="button" className="pd-link" onClick={() => setPicking(true)}>
                  {plan.change}
                </button>
              )}
              {f.status === "submitted" && <p className="pd-hint">{copy.checking}</p>}
              {f.status === "paid" && (
                <button type="button" className="pd-ghost" onClick={() => setReceipt(f)}>
                  {copy.receipt}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {receipt && <Receipt fee={receipt} pay={pay ?? null} onClose={() => setReceipt(null)} />}
    </>
  );
}

function PayPanel({
  fee,
  pay,
  store,
  childName,
  onDone,
  onChanged,
}: {
  fee: Fee;
  pay: PaySettings | null | undefined;
  store: FamilyFeeStore;
  childName: string;
  onDone: () => void;
  onChanged: () => void;
}) {
  const [code, setCode] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [utr, setUtr] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const coupon = async (value: string) => {
    setChecking(true);
    setCouponMsg(null);
    try {
      const r = await store.applyCoupon(fee.id, value);
      if ("error" in r) setCouponMsg({ ok: false, text: r.error });
      else {
        if (r.code) navigator.vibrate?.(12);
        setCouponMsg(
          r.code
            ? { ok: true, text: copy.couponApplied.replace("{amount}", rupees(r.discount)) }
            : null,
        );
        setCode("");
        onChanged();
      }
    } catch (e) {
      setCouponMsg({
        ok: false,
        text: e instanceof Error && e.message ? e.message : copy.couponFailed,
      });
    } finally {
      setChecking(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ref = utr.replace(/\s+/g, "");
    if (!isUtr(ref)) return setError(copy.utrInvalid);
    setSending(true);
    setError(null);
    store
      .submit(fee.id, ref)
      .then(() => {
        navigator.vibrate?.(20);
        onDone();
      })
      .catch(() => setError(copy.submitFailed))
      .finally(() => setSending(false));
  };

  if (pay === undefined) return <p className="pd-muted">Loading…</p>;
  if (pay === null)
    return (
      <div className="pd-pay">
        <p className="pd-alert">{copy.notSetUp}</p>
        <a
          className="pd-cta"
          href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent(`Hi Stoodant, I'd like to pay ${fee.title} for ${childName}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.whatsapp}
        </a>
      </div>
    );

  const link = upiLink(pay, { ...fee, studentName: childName });
  return (
    <div className="pd-pay">
      <dl className="pd-pay-sum">
        <div>
          <dt>{fee.kind === "plan" ? monthsLabel(fee.months) : copy.fee}</dt>
          <dd>{rupees(fee.planPercent > 0 ? fee.listAmount : fee.amount)}</dd>
        </div>
        {fee.planPercent > 0 && (
          <div className="pd-pay-off">
            <dt>{plan.save.replace("{percent}", String(fee.planPercent))}</dt>
            <dd>−{rupees(fee.listAmount - fee.amount)}</dd>
          </div>
        )}
        {fee.discount > 0 && (
          <div className="pd-pay-off">
            <dt>
              {copy.coupon} {fee.couponCode} ({fee.couponPercent}% off){" "}
              <button
                type="button"
                className="pd-link"
                disabled={checking}
                onClick={() => void coupon("")}
              >
                {copy.removeCoupon}
              </button>
            </dt>
            <dd>−{rupees(fee.discount)}</dd>
          </div>
        )}
        <div className="pd-pay-total">
          <dt>{copy.toPay}</dt>
          <dd>{rupees(fee.payable)}</dd>
        </div>
      </dl>

      {!fee.couponCode &&
        (couponOpen ? (
          <form
            className="pd-coupon"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) void coupon(code.trim());
            }}
          >
            <label className="pd-field">
              {copy.couponLabel}
              <span className="pd-coupon-row">
                <input
                  value={code}
                  maxLength={20}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="DIWALI10"
                />
                <button type="submit" className="pd-ghost" disabled={!code.trim() || checking}>
                  {checking ? "…" : copy.apply}
                </button>
              </span>
            </label>
          </form>
        ) : (
          <button
            type="button"
            className="pd-link pd-coupon-open"
            onClick={() => setCouponOpen(true)}
          >
            {copy.haveCoupon}
          </button>
        ))}
      {couponMsg && (
        <p className={couponMsg.ok ? "pd-toast" : "pd-alert"} role="status">
          {couponMsg.text}
        </p>
      )}

      <ol className="pd-pay-steps">
        <li>
          <strong>{copy.step1}</strong>
          <a className="pd-cta pd-upi-btn" href={link}>
            {copy.openUpi.replace("{amount}", rupees(fee.payable))}
          </a>
          <div className="pd-upi-scan">
            <UpiQr
              text={link}
              size={168}
              label={copy.qrLabel.replace("{amount}", rupees(fee.payable))}
            />
            <div>
              <p className="pd-muted">{copy.scan}</p>
              <p className="pd-upi-id">
                <span>{pay.upiId}</span>
                <button
                  type="button"
                  className="pd-link"
                  onClick={() =>
                    void navigator.clipboard?.writeText(pay.upiId).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                  }
                >
                  {copied ? copy.copied : copy.copy}
                </button>
              </p>
              <p className="pd-muted">
                {copy.payee} {pay.payeeName}
              </p>
              {pay.note && <p className="pd-muted">{pay.note}</p>}
            </div>
          </div>
        </li>
        <li>
          <strong>{copy.step2}</strong>
          <form className="pd-stack" onSubmit={submit}>
            <label className="pd-field">
              {copy.utrLabel}
              <input
                value={utr}
                inputMode="numeric"
                autoComplete="off"
                maxLength={30}
                placeholder="412345678901"
                onChange={(e) => setUtr(e.target.value)}
              />
            </label>
            <p className="pd-hint" style={{ margin: 0 }}>
              {copy.utrHint}
            </p>
            {error && (
              <p className="pd-alert" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="pd-save" disabled={!utr.trim() || sending}>
              {sending ? copy.sending : copy.paid}
            </button>
          </form>
        </li>
      </ol>
    </div>
  );
}

/** A payment receipt to save or print. Not a tax invoice: Stoodant isn't GST-registered yet. */
function Receipt({
  fee,
  pay,
  onClose,
}: {
  fee: Fee;
  pay: PaySettings | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onClose]);
  const rows: [string, string][] = [
    [copy.receiptNo, fee.id.slice(0, 10).toUpperCase()],
    [copy.paidOnLabel, day(fee.paidAt)],
    [copy.student, fee.studentName],
    [copy.for, fee.title],
    ...(fee.kind === "plan" && fee.periodFrom
      ? ([
          [
            plan.classes,
            plan.covers
              .replace("{from}", longDay(fee.periodFrom))
              .replace("{to}", longDay(fee.periodTo)),
          ],
        ] as [string, string][])
      : []),
    ...(fee.planPercent > 0
      ? ([
          [copy.fee, rupees(fee.listAmount)],
          [
            plan.save.replace("{percent}", String(fee.planPercent)),
            `−${rupees(fee.listAmount - fee.amount)}`,
          ],
        ] as [string, string][])
      : ([[copy.fee, rupees(fee.amount)]] as [string, string][])),
    fee.couponCode
      ? [
          `${copy.coupon} ${fee.couponCode} (${fee.couponPercent}% off)`,
          `−${rupees(fee.discount)}`,
        ]
      : [copy.coupon, copy.noCoupon],
    [copy.amountPaid, rupees(fee.payable)],
    fee.method && fee.method !== "upi"
      ? [copy.method, plan.methods[fee.method as keyof typeof plan.methods] ?? fee.method]
      : [copy.method, `UPI${pay ? ` to ${pay.upiId}` : ""}`],
    ...(fee.utr ? ([[copy.ref, fee.utr]] as [string, string][]) : []),
  ];
  return (
    <div
      className="pd-receipt-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pd-receipt-title"
    >
      <div className="pd-receipt">
        <p className="pd-receipt-brand">{SITE_CONFIG.brand.name}</p>
        <h2 id="pd-receipt-title">{copy.receiptTitle}</h2>
        <dl>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="pd-muted">{copy.receiptNote}</p>
        <p className="pd-muted">
          {SITE_CONFIG.contact.email} · {SITE_CONFIG.contact.phone}
        </p>
        <div className="pd-actions pd-noprint">
          <button type="button" className="pd-save" onClick={() => window.print()}>
            {copy.printReceipt}
          </button>
          <button type="button" className="pd-ghost" onClick={onClose}>
            {copy.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// The parent preview: a plan ending in a few days and a fee paid last month, or (`fresh`) a new family who
// hasn't paid yet, which opens on the payment screen. Nothing is saved or sent.

export function previewFeeStore(today: string, fresh = false): FamilyFeeStore {
  const now = Date.now();
  const at = (d: string) => Date.parse(`${d}T06:00:00Z`);
  const settings: PaySettings = {
    upiId: "stoodant@okaxis",
    payeeName: "Stoodant",
    note: "",
    planOff: { "3": 5, "6": 8, "12": 12 },
  };
  const blank: Fee = {
    id: "",
    studentId: "s1",
    studentName: "Aarav Mehta",
    batchId: "",
    title: "",
    amount: 0,
    discount: 0,
    payable: 0,
    couponCode: "",
    couponPercent: 0,
    due: today,
    status: "due",
    utr: "",
    note: "",
    createdAt: now,
    submittedAt: 0,
    paidAt: 0,
    kind: "plan",
    months: 1,
    periodFrom: "",
    periodTo: "",
    classLevel: "7",
    board: "CBSE",
    parentName: "Neha Mehta",
    batches: [],
    subjects: [],
    listAmount: 0,
    planPercent: 0,
    submittedPhone: "",
    method: "",
  };
  const monthlyFee = 2999;
  // The last plan started 27 days ago, so it ends in a few days and Home shows Renew.
  const from = addDaysIso(today, -27);
  const until = addDaysIso(addMonthsIso(from, 1), -1);
  let billing: Billing = {
    studentId: "s1",
    studentName: "Aarav Mehta",
    classLevel: "7",
    board: "CBSE",
    parentName: "Neha Mehta",
    parentPhone: "+919876543210",
    active: true,
    monthlyFee,
    feeOverride: 0,
    batches: [
      { id: "b1", name: "Class 7 Maths A", subject: "Maths", monthlyFee: 1500 },
      { id: "b2", name: "Class 7 Science A", subject: "Science", monthlyFee: 1499 },
    ],
    paidUntil: fresh ? "" : until,
    anchor: fresh ? 0 : Number(from.slice(8, 10)),
    status: fresh ? "new" : "ending",
    open: !fresh,
    checking: false,
  };
  let list: Fee[] = fresh
    ? []
    : [
        {
          ...blank,
          id: "pf1",
          title: "1 month of classes",
          amount: monthlyFee,
          listAmount: monthlyFee,
          payable: monthlyFee - 300,
          discount: 300,
          couponCode: "WELCOME10",
          couponPercent: 10,
          due: from,
          status: "paid",
          utr: "412345678901",
          periodFrom: from,
          periodTo: until,
          createdAt: at(from),
          paidAt: at(from),
        },
      ];
  return {
    practice: true,
    list: async () => list,
    settings: async () => settings,
    applyCoupon: async (id, code) => {
      if (code && code !== "TRY10")
        return { error: "That code isn't valid. In this preview, try TRY10." };
      list = list.map((f) => {
        if (f.id !== id) return f;
        const discount = code ? Math.round(f.amount / 10) : 0;
        return {
          ...f,
          couponCode: code,
          couponPercent: code ? 10 : 0,
          discount,
          payable: f.amount - discount,
        };
      });
      const f = list.find((x) => x.id === id)!;
      return { payable: f.payable, discount: f.discount, percent: f.couponPercent, code };
    },
    submit: async (id, utr) => {
      list = list.map((f) =>
        f.id === id ? { ...f, status: "submitted", utr, submittedAt: Date.now() } : f,
      );
      if (list.some((f) => f.id === id && f.kind === "plan"))
        billing = { ...billing, checking: true };
    },
    plan: {
      billing: async () => billing,
      start: async (months) => {
        const price = planPrice(monthlyFee, months, settings.planOff);
        const period = nextPeriodIso(today, billing.paidUntil, billing.anchor, months);
        const fee: Fee = {
          ...blank,
          id: "plan-new",
          title: months === 1 ? "1 month of classes" : `${months} months of classes`,
          months,
          amount: price.amount,
          payable: price.amount,
          listAmount: price.list,
          planPercent: price.percent,
          periodFrom: period.from,
          periodTo: period.to,
        };
        list = [...list.filter((f) => f.id !== fee.id), fee];
        return fee.id;
      },
    },
  };
}
