import { useEffect, useState, type ChangeEvent } from "react";
import { SCHOLARSHIP_EXAM as X, slotHours, slotDay, slotId } from "@/lib/scholarship";
import {
  checkBank, classResults, examPhotos, examSettings, resultsCsv, saveExamSettings, slotCounts, uploadBank, type Attempt, type ExamSettings,
} from "@/lib/firebase/scholarship";

const ALL = X.dates.flatMap((d) => X.hours.map((h) => slotId(d, h)));
const STATUS: Record<string, string> = { started: "Writing now", submitted: "Submitted", timeout: "Time up", struck: "Ended (3 warnings)" };

/** Team tab for the test days: how many students each hour can take, the question bank, bookings and results. */
export function AdminScholarshipExam({ uid }: { uid: string }) {
  const [settings, setSettings] = useState<ExamSettings | null>(null);
  const [capacity, setCapacity] = useState("");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [bankNote, setBankNote] = useState("");
  const [results, setResults] = useState<{ cls: string; rows: Attempt[] } | null>(null);
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<{ rollNo: string; urls: string[] } | null>(null);
  const showPhotos = async (rollNo: string) => {
    try { setPhotos({ rollNo, urls: await examPhotos(rollNo) }); } catch { setMessage("Couldn't load the photos."); }
  };

  useEffect(() => {
    void examSettings().then((s) => { setSettings(s); setCapacity(String(s.capacity)); }).catch(() => setMessage("Couldn't load the exam settings."));
    void slotCounts(ALL).then(setCounts).catch(() => undefined);
  }, []);

  const saveCapacity = async () => {
    const value = Number(capacity);
    if (!settings || !Number.isInteger(value) || value < 1 || value > 20000) return setMessage("Please enter a number from 1 to 20000.");
    try {
      await saveExamSettings({ ...settings, capacity: value }, uid);
      setSettings({ ...settings, capacity: value });
      setMessage("Saved.");
    } catch {
      setMessage("That wasn't saved. Please try again.");
    }
  };

  const pickBank = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !settings) return;
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { return setBankNote("This file can't be read. Please choose the question bank .json file."); }
    const check = checkBank(parsed);
    if (!check.ok) return setBankNote(check.problems[0] ?? "No questions found in this file.");
    const summary = Object.entries(check.counts).map(([k, n]) => `Class ${k.replace("-", " ")}: ${n}`).join(" · ");
    if (!window.confirm(`Upload this question bank?\n\n${summary}${check.problems.length ? `\n\n${check.problems.length} questions skipped (incomplete).` : ""}\n\nPapers already started keep their questions.`)) return;
    try {
      await uploadBank(new File([JSON.stringify(parsed)], "bank.json", { type: "application/json" }));
      const { serverTimestamp } = await import("firebase/firestore/lite");
      const next = { ...settings, bankCounts: check.counts, bankUploadedAt: serverTimestamp() as never };
      await saveExamSettings(next, uid);
      setSettings({ ...settings, bankCounts: check.counts });
      setBankNote(`Uploaded. ${summary}`);
    } catch {
      setBankNote("The upload didn't work. Please try again.");
    }
  };

  const loadResults = async (cls: string) => {
    setResults(null);
    try { setResults({ cls, rows: await classResults(cls) }); } catch { setMessage("Couldn't load the results."); }
  };
  const downloadResults = () => {
    if (!results) return;
    const url = URL.createObjectURL(new Blob(["﻿", resultsCsv(results.rows)], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `scholarship-results-class-${results.cls}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  return (
    <>
      {message && <p className="pd-alert" role="status">{message}</p>}
      <section className="pd-card">
        <h3>Students per hour</h3>
        <p className="pd-empty" style={{ textAlign: "left" }}>Once an hour has this many students, families can't pick it any more.</p>
        <div className="pd-actions">
          <input className="pd-select-sm" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 5))} aria-label="Students per hour" />
          <button type="button" className="pd-link" onClick={() => void saveCapacity()}>Save</button>
        </div>
      </section>

      <section className="pd-card">
        <h3>Question bank</h3>
        <p className="pd-empty" style={{ textAlign: "left" }}>
          {settings?.bankCounts
            ? Object.entries(settings.bankCounts).map(([k, n]) => `Class ${k.replace("-", " ")}: ${n}`).join(" · ")
            : "No question bank uploaded yet. The exam can't start without one."}
        </p>
        <label className="pd-confirm" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
          Upload question bank (.json)
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void pickBank(e)} />
        </label>
        {bankNote && <p className="pd-empty" style={{ textAlign: "left" }}>{bankNote}</p>}
      </section>

      <section className="pd-card">
        <h3>Bookings {total !== null && `(${total})`}</h3>
        {X.dates.map((date) => (
          <div key={date} style={{ marginTop: 10 }}>
            <strong>{slotDay(`${date}T09`)}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, marginTop: 6 }}>
              {X.hours.map((h) => {
                const id = slotId(date, h);
                const n = counts?.[id] ?? 0;
                const full = settings && n >= settings.capacity;
                return <span key={id} style={{ padding: "6px 10px", borderRadius: 8, background: full ? "#fee2e2" : "#eef0f5", fontSize: 14 }}>{slotHours(id)}: <b>{counts ? n : "…"}</b></span>;
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="pd-card">
        <h3>Results</h3>
        <div className="pd-actions">
          <button type="button" className="pd-link" onClick={() => void loadResults("9")}>Class 9</button>
          <button type="button" className="pd-link" onClick={() => void loadResults("10")}>Class 10</button>
          {results && <button type="button" className="pd-link" onClick={downloadResults}>Download spreadsheet</button>}
        </div>
        {results && !results.rows.length && <p className="pd-empty">No papers yet for Class {results.cls}.</p>}
        {results && results.rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr style={{ textAlign: "left" }}><th>Rank</th><th>Student</th><th>Roll no.</th><th>Marks</th><th>Minutes</th><th>Warnings</th><th>Camera</th><th>Status</th></tr></thead>
              <tbody>
                {results.rows.map((r, i) => (
                  <tr key={r.rollNo} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td>{r.score ? i + 1 : "—"}</td><td>{r.studentName}</td><td>{r.rollNo}</td>
                    <td><b>{r.score?.marks ?? "—"}</b>{r.score && ` / 60`}</td>
                    <td>{r.timeTakenMs ? (r.timeTakenMs / 60000).toFixed(1) : "—"}</td><td>{r.strikes ?? 0}</td>
                    <td>{r.cameraOff && !r.photos ? <b style={{ color: "#b91c1c" }}>Off</b> : <button type="button" className="pd-link" onClick={() => void showPhotos(r.rollNo)}>{r.photos ?? 0} photos{r.cameraOff ? " (was off)" : ""}</button>}</td>
                    <td>{STATUS[r.status] ?? r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {photos && (
          <div style={{ marginTop: 12 }}>
            <p><b>Camera photos: {photos.rollNo}</b> <button type="button" className="pd-link" onClick={() => setPhotos(null)}>Close</button></p>
            {!photos.urls.length && <p className="pd-empty">No photos.</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {photos.urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" width={120} style={{ borderRadius: 8 }} /></a>)}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
