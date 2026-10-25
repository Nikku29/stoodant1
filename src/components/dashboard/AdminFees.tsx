import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import {
  addCoupon,
  createFees,
  deleteCoupon,
  deleteFee,
  isCouponCode,
  isUpiId,
  listCoupons,
  paySettings,
  rupees,
  savePaySettings,
  setCouponActive,
  setFeeStatus,
  type Coupon,
  type Fee,
  type FeeStatus,
  type PaySettings,
} from "@/lib/firebase/fees";
import type { Batch, Student } from "@/lib/firebase/school";
import { formatDay } from "@/lib/progress/insights";
import { UpiQr } from "./Fees";

const copy = DASHBOARD_CONFIG.adminFees;
type Act = (task: () => Promise<unknown>) => Promise<boolean>;
type View = keyof typeof copy.tabs;
type Filter = "submitted" | "due" | "paid" | "all";

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const monthTitle = (iso: string) =>
  `${new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })} fees`;
const day = (ms: number) => formatDay(new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10));

/** The team's Fees screen: payments to check, creating fees, coupon codes and where families pay. */
export function AdminFees({
  fees,
  students,
  batches,
  act,
  uid,
  today,
}: {
  fees: Fee[];
  students: Student[];
  batches: Batch[];
  act: Act;
  uid: string;
  today: string;
}) {
  const toCheck = fees.filter((f) => f.status === "submitted").length;
  const [view, setView] = useState<View>("payments");
  return (
    <>
      <div className="pd-tabs" role="tablist" aria-label={DASHBOARD_CONFIG.nav.admin.fees}>
        {(Object.keys(copy.tabs) as View[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={view === t}
            onClick={() => setView(t)}
          >
            {copy.tabs[t]}
            {t === "payments" && toCheck > 0 && <span className="pd-count">{toCheck}</span>}
          </button>
        ))}
      </div>
      {view === "payments" && <Payments fees={fees} act={act} uid={uid} />}
      {view === "create" && (
        <CreateFees
          fees={fees}
          students={students}
          batches={batches}
          act={act}
          uid={uid}
          today={today}
          onDone={() => setView("payments")}
        />
      )}
      {view === "coupons" && <Coupons uid={uid} today={today} />}
      {view === "upi" && <UpiSettings uid={uid} />}
    </>
  );
}

// ---- Payments: check what families say they've paid, see what's due ----

function Payments({ fees, act, uid }: { fees: Fee[]; act: Act; uid: string }) {
  const [filter, setFilter] = useState<Filter>(() =>
    fees.some((f) => f.status === "submitted") ? "submitted" : "due",
  );
  const shown = fees.filter((f) => (filter === "all" ? true : f.status === filter));
  const sum = (s: FeeStatus) =>
    fees.filter((f) => f.status === s).reduce((n, f) => n + f.payable, 0);
  return (
    <>
      <div className="pd-tiles" style={{ marginTop: 16 }}>
        <div className="pd-tile pd-tile-static">
          <span className="pd-tile-label">{copy.filters.submitted}</span>
          <strong className="pd-tile-value">{rupees(sum("submitted"))}</strong>
        </div>
        <div className="pd-tile pd-tile-static">
          <span className="pd-tile-label">{copy.filters.due}</span>
          <strong className="pd-tile-value">{rupees(sum("due"))}</strong>
        </div>
        <div className="pd-tile pd-tile-static" data-tone="good">
          <span className="pd-tile-label">{copy.filters.paid}</span>
          <strong className="pd-tile-value">{rupees(sum("paid"))}</strong>
        </div>
      </div>
      <div className="pd-picker" role="group" aria-label="Show" style={{ marginTop: 16 }}>
        {(Object.keys(copy.filters) as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {copy.filters[f]} (
            {f === "all" ? fees.length : fees.filter((x) => x.status === f).length})
          </button>
        ))}
      </div>
      {filter === "submitted" && shown.length > 0 && <p className="pd-hint">{copy.checkHint}</p>}
      {!shown.length && <p className="pd-empty">{copy.emptyFilter}</p>}
      <ul className="pd-list pd-fees">
        {shown.map((f) => (
          <li key={f.id} className="pd-item pd-fee" data-status={f.status}>
            <div className="pd-item-head">
              <strong>{f.studentName}</strong>
              <span className="pd-fee-status" data-status={f.status}>
                {DASHBOARD_CONFIG.fees.status[f.status]}
              </span>
            </div>
            <span>
              {f.title} · <strong>{rupees(f.payable)}</strong>
              {f.discount > 0 && (
                <small className="pd-muted">
                  {" "}
                  ({rupees(f.amount)} − {f.couponCode} {f.couponPercent}%)
                </small>
              )}
            </span>
            <small className="pd-muted">
              {f.status === "paid"
                ? `${copy.paidOn} ${day(f.paidAt)}`
                : f.status === "submitted"
                  ? `${copy.sentOn} ${day(f.submittedAt)}`
                  : `${copy.dueOn} ${formatDay(f.due)}`}
              {f.utr && ` · UPI ref ${f.utr}`}
            </small>
            {f.note && <small className="pd-muted">{f.note}</small>}
            <div className="pd-actions">
              {f.status === "submitted" && (
                <>
                  <button
                    type="button"
                    className="pd-save pd-save-sm"
                    onClick={() => void act(() => setFeeStatus(f.id, "paid", uid))}
                  >
                    {copy.markPaid}
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => {
                      const note = window.prompt(copy.notFoundPrompt, copy.notFoundDefault);
                      if (note !== null) void act(() => setFeeStatus(f.id, "due", uid, note));
                    }}
                  >
                    {copy.notFound}
                  </button>
                </>
              )}
              {f.status === "due" && (
                <button
                  type="button"
                  className="pd-link"
                  onClick={() =>
                    window.confirm(copy.paidCashConfirm.replace("{name}", f.studentName)) &&
                    void act(() => setFeeStatus(f.id, "paid", uid, copy.paidCashNote))
                  }
                >
                  {copy.paidCash}
                </button>
              )}
              {f.status !== "paid" && f.status !== "cancelled" && (
                <button
                  type="button"
                  className="pd-link"
                  onClick={() =>
                    window.confirm(copy.cancelConfirm.replace("{name}", f.studentName)) &&
                    void act(() => setFeeStatus(f.id, "cancelled", uid))
                  }
                >
                  {copy.cancel}
                </button>
              )}
              {f.status === "cancelled" && (
                <button
                  type="button"
                  className="pd-link"
                  onClick={() => void act(() => deleteFee(f.id))}
                >
                  {copy.delete}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---- Create fees for a whole batch or one child ----

function CreateFees({
  fees,
  students,
  batches,
  act,
  uid,
  today,
  onDone,
}: {
  fees: Fee[];
  students: Student[];
  batches: Batch[];
  act: Act;
  uid: string;
  today: string;
  onDone: () => void;
}) {
  const running = batches.filter((b) => b.active !== false);
  const active = students.filter((s) => s.active);
  const [who, setWho] = useState<"batch" | "child">("batch");
  const [batchId, setBatchId] = useState(running[0]?.id ?? "");
  const [studentId, setStudentId] = useState(active[0]?.id ?? "");
  const [due, setDue] = useState(addDays(today, 7));
  const [title, setTitle] = useState(monthTitle(addDays(today, 7)));
  const [titleEdited, setTitleEdited] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const children = useMemo(() => {
    const list =
      who === "batch"
        ? active
            .filter((s) => s.batchIds.includes(batchId))
            .map((s) => ({ id: s.id, name: s.name, batchId }))
        : active
            .filter((s) => s.id === studentId)
            .map((s) => ({ id: s.id, name: s.name, batchId: s.batchIds[0] ?? "" }));
    // A child who already has this fee (same title, not cancelled) isn't charged twice.
    const has = new Set(
      fees
        .filter((f) => f.title === title.trim() && f.status !== "cancelled")
        .map((f) => f.studentId),
    );
    return { all: list, fresh: list.filter((c) => !has.has(c.id)) };
  }, [who, batchId, studentId, active, fees, title]);
  const rupeesValue = Number(amount);
  const valid =
    title.trim().length > 0 &&
    Number.isInteger(rupeesValue) &&
    rupeesValue > 0 &&
    rupeesValue <= 200000 &&
    due >= today &&
    children.fresh.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const ok = await act(() =>
      createFees(children.fresh, { title: title.trim(), amount: rupeesValue, due }, uid),
    );
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <form className="pd-card pd-stack" style={{ marginTop: 16 }} onSubmit={submit}>
      <p className="pd-hint" style={{ margin: 0 }}>
        {copy.createHint}
      </p>
      <div className="pd-toggle" role="group" aria-label={copy.who}>
        <button type="button" aria-pressed={who === "batch"} onClick={() => setWho("batch")}>
          {copy.wholeBatch}
        </button>
        <button type="button" aria-pressed={who === "child"} onClick={() => setWho("child")}>
          {copy.oneChild}
        </button>
      </div>
      {who === "batch" ? (
        <label className="pd-field">
          {copy.batch}
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {running.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="pd-field">
          {copy.child}
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Class {s.classLevel})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="pd-field">
        {copy.dueLabel}
        <input
          type="date"
          value={due}
          min={today}
          onChange={(e) => {
            setDue(e.target.value);
            if (!titleEdited && e.target.value) setTitle(monthTitle(e.target.value));
          }}
        />
      </label>
      <label className="pd-field">
        {copy.titleLabel}
        <input
          value={title}
          maxLength={80}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(true);
          }}
        />
      </label>
      <label className="pd-field">
        {copy.amountLabel}
        <input
          value={amount}
          inputMode="numeric"
          placeholder="2999"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </label>
      <p className="pd-muted" style={{ margin: 0 }}>
        {children.fresh.length
          ? copy.willCreate
              .replace("{n}", String(children.fresh.length))
              .replace("{names}", children.fresh.map((c) => c.name.split(" ")[0]).join(", "))
          : children.all.length
            ? copy.allHaveIt
            : copy.nobody}
        {children.fresh.length > 0 &&
          children.fresh.length < children.all.length &&
          ` ${copy.someHaveIt}`}
      </p>
      <button type="submit" className="pd-save" disabled={!valid || busy}>
        {busy
          ? "Saving…"
          : copy.create
              .replace("{n}", String(children.fresh.length))
              .replace("{amount}", rupeesValue > 0 ? rupees(rupeesValue) : "")}
      </button>
    </form>
  );
}

// ---- Coupons ----

function Coupons({ uid, today }: { uid: string; today: string }) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(() => {
    listCoupons().then(setCoupons, () => setFailed(true));
  }, []);
  useEffect(reload, [reload]);

  const p = Number(percent);
  const valid = isCouponCode(code) && Number.isInteger(p) && p >= 1 && p <= 100;
  const run = (task: () => Promise<unknown>, ok: string) => {
    setMessage(null);
    task().then(
      () => {
        setMessage({ ok: true, text: ok });
        reload();
      },
      () => setMessage({ ok: false, text: copy.couponFailed }),
    );
  };

  return (
    <>
      <form
        className="pd-card pd-stack"
        style={{ marginTop: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          if (coupons?.some((c) => c.code === code))
            return setMessage({ ok: false, text: copy.couponExists });
          run(
            () => addCoupon({ code, percent: p, maxUses: Number(maxUses) || 0, expires }, uid),
            copy.couponAdded.replace("{code}", code),
          );
          setCode("");
        }}
      >
        <p className="pd-hint" style={{ margin: 0 }}>
          {copy.couponHint}
        </p>
        <div className="pd-grid">
          <label className="pd-field">
            {copy.codeLabel}
            <input
              value={code}
              maxLength={20}
              placeholder="DIWALI10"
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            />
          </label>
          <label className="pd-field">
            {copy.percentLabel}
            <input
              value={percent}
              inputMode="numeric"
              maxLength={3}
              onChange={(e) => setPercent(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
        </div>
        <div className="pd-grid">
          <label className="pd-field">
            {copy.maxUsesLabel}
            <input
              value={maxUses}
              inputMode="numeric"
              placeholder={copy.noLimit}
              onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
          <label className="pd-field">
            {copy.expiresLabel}
            <input
              type="date"
              value={expires}
              min={today}
              onChange={(e) => setExpires(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="pd-save" disabled={!valid}>
          {copy.addCoupon}
        </button>
      </form>
      {message && (
        <p className={message.ok ? "pd-toast" : "pd-alert"} role="status" style={{ marginTop: 12 }}>
          {message.text}
        </p>
      )}
      <section className="pd-section" aria-labelledby="pd-coupons">
        <h2 id="pd-coupons">{copy.couponsTitle}</h2>
        {failed && <p className="pd-alert">{copy.couponsLoadFailed}</p>}
        {coupons && !coupons.length && <p className="pd-empty">{copy.noCoupons}</p>}
        <ul className="pd-list">
          {coupons?.map((c) => {
            const expired = Boolean(c.expires && c.expires < today);
            const usedUp = c.maxUses > 0 && c.uses >= c.maxUses;
            return (
              <li
                key={c.code}
                className="pd-item"
                data-done={!c.active || expired || usedUp || undefined}
              >
                <div className="pd-item-head">
                  <strong className="pd-coupon-code">{c.code}</strong>
                  <strong>{c.percent}% off</strong>
                </div>
                <small className="pd-muted">
                  {copy.used.replace("{n}", String(c.uses))}
                  {c.maxUses > 0 && ` ${copy.of} ${c.maxUses}`}
                  {c.expires && ` · ${expired ? copy.expired : copy.until} ${formatDay(c.expires)}`}
                  {!c.active && ` · ${copy.off}`}
                </small>
                <div className="pd-actions">
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() =>
                      run(
                        () => setCouponActive(c.code, !c.active),
                        c.active ? copy.turnedOff : copy.turnedOn,
                      )
                    }
                  >
                    {c.active ? copy.turnOff : copy.turnOn}
                  </button>
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() =>
                      window.confirm(copy.deleteCouponConfirm.replace("{code}", c.code)) &&
                      run(() => deleteCoupon(c.code), copy.deleted)
                    }
                  >
                    {copy.delete}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

// ---- Where families pay ----

function UpiSettings({ uid }: { uid: string }) {
  const [form, setForm] = useState<PaySettings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    paySettings().then(
      (s) => setForm(s ?? { upiId: "", payeeName: "Stoodant", note: "" }),
      () => setForm({ upiId: "", payeeName: "Stoodant", note: "" }),
    );
  }, []);
  if (!form) return <p className="pd-muted">Loading…</p>;
  const valid = isUpiId(form.upiId.trim()) && form.payeeName.trim().length > 0;
  const preview = `upi://pay?pa=${form.upiId.trim()}&pn=${encodeURIComponent(form.payeeName.trim())}&cu=INR`;
  return (
    <form
      className="pd-card pd-stack"
      style={{ marginTop: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setMessage(null);
        savePaySettings(form, uid).then(
          () => setMessage({ ok: true, text: copy.upiSaved }),
          () => setMessage({ ok: false, text: copy.upiFailed }),
        );
      }}
    >
      <p className="pd-hint" style={{ margin: 0 }}>
        {copy.upiHint}
      </p>
      <label className="pd-field">
        {copy.upiLabel}
        <input
          value={form.upiId}
          placeholder="stoodant@okaxis"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setForm({ ...form, upiId: e.target.value })}
        />
      </label>
      <label className="pd-field">
        {copy.payeeLabel}
        <input
          value={form.payeeName}
          maxLength={60}
          onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
        />
      </label>
      <label className="pd-field">
        {copy.noteLabel}
        <input
          value={form.note}
          maxLength={200}
          placeholder={copy.notePlaceholder}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </label>
      {valid && (
        <div className="pd-upi-scan">
          <UpiQr text={preview} size={140} label={copy.qrPreview} />
          <p className="pd-muted">{copy.qrPreviewHint}</p>
        </div>
      )}
      {message && (
        <p className={message.ok ? "pd-toast" : "pd-alert"} role="status">
          {message.text}
        </p>
      )}
      <button type="submit" className="pd-save" disabled={!valid}>
        {copy.saveUpi}
      </button>
    </form>
  );
}
