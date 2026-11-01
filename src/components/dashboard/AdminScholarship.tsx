import { useCallback, useEffect, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore/lite";
import {
  allRegistrations, checkPayment, deleteRegistration, findRegistration, listRegistrations, payStatus, photoUrl,
  registrationCounts, registrationsCsv, type PayStatus, type Registration,
} from "@/lib/firebase/scholarship";
import { Tile } from "./AppNav";

const when = (r: Registration) =>
  r.createdAt?.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) ?? "";
const born = (dob: string) => {
  const [y, m, d] = dob.split("-");
  return y && m && d ? `${d}/${m}/${y}` : dob;
};

const PAY_LABEL: Record<PayStatus, string> = { due: "Not paid", submitted: "To check", paid: "Paid", rejected: "Not received" };
const PAY_TONE: Record<PayStatus, string> = { due: "#6b7280", submitted: "#b45309", paid: "#047857", rejected: "#b91c1c" };
type Show = "all" | "9" | "10" | "submitted" | "paid" | "due";
const SHOW: [Show, string][] = [["all", "All"], ["9", "Class 9"], ["10", "Class 10"], ["submitted", "Fee to check"], ["paid", "Paid"], ["due", "Not paid"]];

/**
 * Team tab: scholarship test registrations, newest first. Every detail of each child (photo included), the ₹99
 * fee with its UPI reference to tick off against the bank account, lookup by number or phone, and a spreadsheet.
 */
export function AdminScholarship({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [next, setNext] = useState<QueryDocumentSnapshot | null>(null);
  const [counts, setCounts] = useState<Record<"9" | "10", number> | null>(null);
  const [show, setShow] = useState<Show>("all");
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<Registration | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [page, c] = await Promise.all([listRegistrations(), registrationCounts()]);
      setRows(page.rows);
      setNext(page.next);
      setCounts(c);
      setError("");
    } catch {
      setError("Couldn't load the registrations. Please check the internet connection and refresh.");
    }
  }, []);
  useEffect(() => void load(), [load]);

  const more = async () => {
    if (!next) return;
    setBusy(true);
    try {
      const page = await listRegistrations(next);
      setRows((r) => [...(r ?? []), ...page.rows]);
      setNext(page.next);
    } finally {
      setBusy(false);
    }
  };

  const lookup = async () => {
    if (!search.trim()) return setFound(undefined);
    setFound(await findRegistration(search).catch(() => null));
  };

  const download = async () => {
    setBusy(true);
    try {
      const csv = registrationsCsv(await allRegistrations());
      const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `scholarship-registrations-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setError("The download didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const replace = (r: Registration) => {
    setRows((all) => all?.map((x) => (x.regNo === r.regNo ? r : x)) ?? null);
    setFound((f) => (f?.regNo === r.regNo ? r : f));
  };

  const check = async (r: Registration, status: "paid" | "rejected") => {
    const ask = status === "paid"
      ? `Mark ₹${r.fee ?? 99} as received for ${r.studentName} (${r.regNo})?${r.payment?.utr ? `\nUPI reference: ${r.payment.utr}` : ""}`
      : `Mark the payment of ${r.studentName} (${r.regNo}) as not received? The family can then send the reference again.`;
    if (!window.confirm(ask)) return;
    try {
      await checkPayment(r, status, uid);
      replace({ ...r, payment: { ...(r.payment ?? {}), status, checkedBy: uid } });
    } catch {
      setError("That change wasn't saved. Please try again.");
    }
  };

  const remove = async (r: Registration) => {
    if (!window.confirm(`Delete the registration of ${r.studentName} (${r.regNo})? This can't be undone.`)) return;
    try {
      await deleteRegistration(r);
      setRows((all) => all?.filter((x) => x.regNo !== r.regNo) ?? null);
      if (found?.regNo === r.regNo) setFound(undefined);
    } catch {
      setError("That registration wasn't deleted. Please try again.");
    }
  };

  const all = rows ?? [];
  const toCheck = all.filter((r) => payStatus(r) === "submitted").length;
  const paid = all.filter((r) => payStatus(r) === "paid").length;
  const shown = all.filter((r) =>
    show === "all" ? true
      : show === "9" || show === "10" ? r.studentClass === show
        : show === "due" ? payStatus(r) === "due" || payStatus(r) === "rejected"
          : payStatus(r) === show);
  const item = (r: Registration) => <Item key={r.regNo} r={r} check={check} remove={remove} />;
  return (
    <>
      {error && <p className="pd-alert" role="alert">{error}</p>}
      <div className="pd-tiles">
        <Tile label="Class 9" value={String(counts?.["9"] ?? "…")} hint="registered" onClick={() => setShow("9")} />
        <Tile label="Class 10" value={String(counts?.["10"] ?? "…")} hint="registered" onClick={() => setShow("10")} />
        <Tile label="Fee to check" value={rows ? String(toCheck) : "…"} hint={next ? "in the list below" : "UPI reference sent"} onClick={() => setShow("submitted")} />
        <Tile label="Paid" value={rows ? String(paid) : "…"} hint={next ? "in the list below" : "fee confirmed"} onClick={() => setShow("paid")} />
      </div>
      <form className="pd-actions" style={{ marginTop: 14 }} onSubmit={(e) => (e.preventDefault(), void lookup())}>
        <input className="pd-select-sm" style={{ flex: 1 }} placeholder="Registration number or parent's phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Registration number or phone" />
        <button type="submit" className="pd-link">Find</button>
        <button type="button" className="pd-link" onClick={() => void download()} disabled={busy}>Download spreadsheet</button>
      </form>
      {found === null && <p className="pd-empty">No registration with that number or phone.</p>}
      {found && <ul className="pd-list">{item(found)}</ul>}
      <div className="pd-picker" role="group" aria-label="Show">
        {SHOW.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={show === key} onClick={() => setShow(key)}>{label}</button>
        ))}
      </div>
      {rows && !shown.length && <p className="pd-empty">{all.length ? "Nothing here." : "No registrations yet. Share stoodant.com/scholarship to get the first ones."}</p>}
      <ul className="pd-list">{shown.map(item)}</ul>
      {next && <button type="button" className="pd-link" onClick={() => void more()} disabled={busy}>Show more</button>}
    </>
  );
}

function Item({ r, check, remove }: {
  r: Registration;
  check: (r: Registration, status: "paid" | "rejected") => Promise<void>;
  remove: (r: Registration) => Promise<void>;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void photoUrl(r.photoPath).then((url) => live && setPhoto(url)).catch(() => undefined);
    return () => { live = false; };
  }, [r.photoPath]);
  const pay = payStatus(r);
  const wa = `https://wa.me/${r.parentPhoneE164.replace("+", "")}?text=${encodeURIComponent(
    pay === "paid"
      ? `Hi ${r.parentName}, your ₹${r.fee ?? 99} fee for ${r.studentName}'s Stoodant Scholarship Test is confirmed. Registration (roll) number: ${r.regNo}.`
      : `Hi ${r.parentName}, this is Stoodant about ${r.studentName}'s Scholarship Test registration (${r.regNo}).`,
  )}`;
  const rows: [string, string][] = [
    ["Registration no.", r.regNo],
    ["Class", r.studentClass],
    ["Date of birth", born(r.dob)],
    ["School", r.school],
    ["City", r.city],
    ["PIN code", r.pincode ?? "—"],
    ["Parent", r.parentName],
    ["Phone", r.parentPhoneE164],
    ["Registered", when(r)],
    ["UPI reference", r.payment?.utr ?? "—"],
  ];
  return (
    <li className="pd-item">
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 72, height: 90, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: "#eef0f5" }}>
          {photo && <a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={`Photo of ${r.studentName}`} width={72} height={90} style={{ objectFit: "cover", width: "100%", height: "100%" }} /></a>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="pd-item-head">
            <strong>{r.studentName}</strong>
            <span style={{ color: PAY_TONE[pay], fontWeight: 700 }}>₹{r.fee ?? 99} · {PAY_LABEL[pay]}</span>
          </div>
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", margin: "6px 0 0", fontSize: 14 }}>
            {rows.map(([k, v]) => [<dt key={`${k}-k`} style={{ color: "#6b7280" }}>{k}</dt>, <dd key={`${k}-v`} style={{ margin: 0, overflowWrap: "anywhere" }}>{v}</dd>])}
          </dl>
        </div>
      </div>
      <div className="pd-actions">
        {pay !== "paid" && <button type="button" className="pd-link" onClick={() => void check(r, "paid")}>Mark fee paid</button>}
        {pay === "submitted" && <button type="button" className="pd-link" onClick={() => void check(r, "rejected")}>Not received</button>}
        <a className="pd-link" href={`tel:${r.parentPhoneE164}`}>Call</a>
        <a className="pd-link" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button type="button" className="pd-link" onClick={() => void remove(r)}>Delete</button>
      </div>
    </li>
  );
}
