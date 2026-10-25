import qrcode from "qrcode-generator";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import { isUtr, rupees, upiLink, type Fee, type PaySettings } from "@/lib/firebase/fees";
import { formatDay } from "@/lib/progress/insights";

const copy = DASHBOARD_CONFIG.fees;

export type CouponResult =
  { payable: number; discount: number; percent: number; code: string } | { error: string };

/** Where a family's fees come from. The parent preview uses an in-memory one. */
export type FamilyFeeStore = {
  list(): Promise<Fee[]>;
  settings(): Promise<PaySettings | null>;
  applyCoupon(feeId: string, code: string): Promise<CouponResult>;
  submit(feeId: string, utr: string): Promise<void>;
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

/** A QR code drawn as one SVG path, so it stays sharp at any size and prints well. */
export function UpiQr({ text, size = 200, label }: { text: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { path, n };
  }, [text]);
  return (
    <svg
      className="pd-qr"
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={path} fill="#0a1026" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------
// Families: what's due, pay by UPI, say it's paid, and a receipt once the team confirms it.

export function FamilyFees({ store, childName }: { store: FamilyFeeStore; childName: string }) {
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [pay, setPay] = useState<PaySettings | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Fee | null>(null);

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

  const due = fees ? totalDue(fees) : 0;
  return (
    <>
      {store.practice && <p className="pd-hint">{copy.preview}</p>}
      {fees && (
        <div className="pd-fee-total" data-clear={due === 0 || undefined}>
          <span>{due ? copy.toPay : copy.allPaid}</span>
          <strong>{due ? rupees(due) : "✓"}</strong>
        </div>
      )}
      {failed && <p className="pd-alert">{copy.loadFailed}</p>}
      {!fees && !failed && <p className="pd-muted">Loading…</p>}
      {fees && !fees.length && <p className="pd-empty">{copy.empty}</p>}
      {fees && fees.length > 0 && (
        <ul className="pd-list pd-fees">
          {fees.map((f) => (
            <li key={f.id} className="pd-item pd-fee" data-status={f.status}>
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
                      : `${copy.dueOn} ${formatDay(f.due)}`}
                </small>
              </div>
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
                    }}
                    onChanged={reload}
                  />
                ) : (
                  <button type="button" className="pd-save" onClick={() => setOpen(f.id)}>
                    {copy.payNow.replace("{amount}", rupees(f.payable))}
                  </button>
                ))}
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
          <dt>{copy.fee}</dt>
          <dd>{rupees(fee.amount)}</dd>
        </div>
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
    [copy.fee, rupees(fee.amount)],
    ...(fee.discount > 0
      ? ([[`${copy.coupon} ${fee.couponCode}`, `−${rupees(fee.discount)}`]] as [string, string][])
      : []),
    [copy.amountPaid, rupees(fee.payable)],
    [copy.method, `UPI${pay ? ` to ${pay.upiId}` : ""}`],
    [copy.ref, fee.utr],
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
// The parent preview: a fee to pay, one being checked and one paid. Nothing is saved or sent.

export function previewFeeStore(today: string): FamilyFeeStore {
  const now = Date.now();
  const base = {
    studentId: "s1",
    studentName: "Aarav Mehta",
    batchId: "sample",
    discount: 0,
    couponCode: "",
    couponPercent: 0,
    utr: "",
    note: "",
    submittedAt: 0,
    paidAt: 0,
  };
  const month = (offset: number) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + offset * 30 * 86_400_000).toLocaleDateString(
      "en-IN",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
  let list: Fee[] = [
    {
      ...base,
      id: "pf1",
      title: `${month(1)} fees`,
      amount: 2999,
      payable: 2999,
      due: new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10),
      status: "due",
      createdAt: now - 86_400_000,
    },
    {
      ...base,
      id: "pf2",
      title: `${month(0)} fees`,
      amount: 2999,
      payable: 2699,
      discount: 300,
      couponCode: "WELCOME10",
      couponPercent: 10,
      due: today,
      status: "paid",
      utr: "412345678901",
      createdAt: now - 30 * 86_400_000,
      paidAt: now - 25 * 86_400_000,
    },
  ];
  return {
    practice: true,
    list: async () => list,
    settings: async () => ({ upiId: "stoodant@okaxis", payeeName: "Stoodant", note: "" }),
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
    },
  };
}
