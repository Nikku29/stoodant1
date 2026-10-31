import { useCallback, useEffect, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore/lite";
import {
  allRegistrations, deleteRegistration, findRegistration, listRegistrations, photoUrl, registrationCounts,
  registrationsCsv, type Registration,
} from "@/lib/firebase/scholarship";
import { Tile } from "./AppNav";

const when = (r: Registration) =>
  r.createdAt?.toDate().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) ?? "";

/** Team tab: scholarship test registrations, newest first, with counts, lookup by number, photo and a spreadsheet download. */
export function AdminScholarship() {
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [next, setNext] = useState<QueryDocumentSnapshot | null>(null);
  const [counts, setCounts] = useState<Record<"9" | "10", number> | null>(null);
  const [cls, setCls] = useState<"all" | "9" | "10">("all");
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

  const shown = (rows ?? []).filter((r) => cls === "all" || r.studentClass === cls);
  return (
    <>
      {error && <p className="pd-alert" role="alert">{error}</p>}
      <div className="pd-tiles">
        <Tile label="Class 9" value={String(counts?.["9"] ?? "…")} hint="registered" onClick={() => setCls("9")} />
        <Tile label="Class 10" value={String(counts?.["10"] ?? "…")} hint="registered" onClick={() => setCls("10")} />
        <Tile label="Total" value={counts ? String(counts["9"] + counts["10"]) : "…"} hint="all classes" onClick={() => setCls("all")} />
      </div>
      <form className="pd-actions" style={{ marginTop: 14 }} onSubmit={(e) => (e.preventDefault(), void lookup())}>
        <input className="pd-select-sm" style={{ flex: 1 }} placeholder="Find by number, e.g. SS26-10-00042" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Registration number" />
        <button type="submit" className="pd-link">Find</button>
        <button type="button" className="pd-link" onClick={() => void download()} disabled={busy}>Download spreadsheet</button>
      </form>
      {found === null && <p className="pd-empty">No registration with that number.</p>}
      {found && <ul className="pd-list"><Item r={found} remove={remove} /></ul>}
      <div className="pd-picker" role="group" aria-label="Show">
        {(["all", "9", "10"] as const).map((key) => (
          <button key={key} type="button" aria-pressed={cls === key} onClick={() => setCls(key)}>{key === "all" ? "All" : `Class ${key}`}</button>
        ))}
      </div>
      {rows && !shown.length && <p className="pd-empty">No registrations here yet. Share stoodant.com/scholarship to get the first ones.</p>}
      <ul className="pd-list">{shown.map((r) => <Item key={r.regNo} r={r} remove={remove} />)}</ul>
      {next && <button type="button" className="pd-link" onClick={() => void more()} disabled={busy}>Show more</button>}
    </>
  );
}

function Item({ r, remove }: { r: Registration; remove: (r: Registration) => Promise<void> }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const wa = `https://wa.me/${r.parentPhoneE164.replace("+", "")}?text=${encodeURIComponent(`Hi ${r.parentName}, this is Stoodant about ${r.studentName}'s Scholarship Test registration (${r.regNo}).`)}`;
  return (
    <li className="pd-item">
      <div className="pd-item-head">
        <strong>{r.studentName}</strong>
        <span>{r.regNo}</span>
      </div>
      <p>Class {r.studentClass} · Born {r.dob} · {r.school}, {r.city} · {when(r)}</p>
      <p>Parent: {r.parentName} · {r.parentPhoneE164}</p>
      {photo && <img src={photo} alt={`Photo of ${r.studentName}`} width={96} style={{ borderRadius: 8, marginTop: 8 }} />}
      <div className="pd-actions">
        {!photo && <button type="button" className="pd-link" onClick={() => void photoUrl(r.photoPath).then(setPhoto).catch(() => undefined)}>Photo</button>}
        <a className="pd-link" href={`tel:${r.parentPhoneE164}`}>Call</a>
        <a className="pd-link" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button type="button" className="pd-link" onClick={() => void remove(r)}>Delete</button>
      </div>
    </li>
  );
}
