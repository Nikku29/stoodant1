import { useEffect, useMemo, useState } from "react";

import { istDay, sessionsBetween, type SessionRow } from "@/lib/firebase/school";
import { formatMonth, monthOf } from "@/lib/progress/insights";
import type { Data } from "./AdminPage";

// The team's overview: what happened in a month, and each teacher's classes and hours for salaries.
// Hours = classes held × the batch's class length (60 minutes unless set on the batch).

const DEFAULT_MINUTES = 60;

function shiftMonth(from: string, by: number) {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by, 1);
  return monthOf(d.toISOString().slice(0, 10));
}

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

type TeacherRow = {
  id: string;
  name: string;
  phone: string;
  batches: number;
  students: number;
  held: number;
  cancelled: number;
  minutes: number;
  present: number;
  marked: number;
  lastClass: string | null;
};

export function Overview({ data }: { data: Data }) {
  const [month, setMonth] = useState(() => monthOf(istDay()));
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const thisMonth = monthOf(istDay()).from;

  useEffect(() => {
    let live = true;
    setSessions(null);
    setFailed(false);
    sessionsBetween(month.from, month.to)
      .then((rows) => live && setSessions(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [month]);

  const rows = useMemo(() => teacherRows(data, sessions ?? []), [data, sessions]);
  const totals = rows.reduce(
    (t, r) => ({
      held: t.held + r.held,
      cancelled: t.cancelled + r.cancelled,
      minutes: t.minutes + r.minutes,
      present: t.present + r.present,
      marked: t.marked + r.marked,
    }),
    { held: 0, cancelled: 0, minutes: 0, present: 0, marked: 0 },
  );
  const openLeads = data.leads.filter((l) => !["enrolled", "closed"].includes(l.status)).length;

  return (
    <>
      <div className="pd-month" role="group" aria-label="Month">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month.from, -1))}
          aria-label="Previous month"
        >
          ←
        </button>
        <strong>{formatMonth(month.from)}</strong>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month.from, 1))}
          disabled={month.from >= thisMonth}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <section className="pd-stats pd-stats-4" aria-label="This month">
        <Stat
          label="Classes held"
          value={sessions ? String(totals.held) : "…"}
          hint={`${totals.cancelled} cancelled`}
        />
        <Stat
          label="Hours taught"
          value={sessions ? String(hours(totals.minutes)) : "…"}
          hint="all teachers"
        />
        <Stat
          label="Attendance"
          value={totals.marked ? `${Math.round((totals.present / totals.marked) * 100)}%` : "–"}
          hint="children present"
        />
        <Stat
          label="Students"
          value={String(data.students.filter((s) => s.active).length)}
          hint={`${openLeads} open demo ${openLeads === 1 ? "request" : "requests"}`}
        />
      </section>

      {failed && (
        <p className="pd-alert" role="alert">
          Couldn't load this month's classes. Please check the internet connection and try again.
        </p>
      )}

      <div className="pd-section-head">
        <h2 className="pd-subhead">Teachers: classes and hours</h2>
        {sessions && rows.length > 0 && (
          <button type="button" className="pd-link" onClick={() => downloadCsv(rows, month.from)}>
            Download for salaries (CSV)
          </button>
        )}
      </div>
      {!data.teachers.length && <p className="pd-empty">No teachers yet.</p>}
      <ul className="pd-list">
        {rows.map((r) => (
          <li key={r.id} className="pd-item">
            <div className="pd-item-head">
              <strong>{r.name}</strong>
              <span>{sessions ? `${hours(r.minutes)} h` : "…"}</span>
            </div>
            <dl className="pd-class-nums pd-nums-4">
              <div>
                <dt>Classes held</dt>
                <dd>{r.held}</dd>
              </div>
              <div>
                <dt>Cancelled</dt>
                <dd>{r.cancelled}</dd>
              </div>
              <div>
                <dt>Batches</dt>
                <dd>{r.batches}</dd>
              </div>
              <div>
                <dt>Children present</dt>
                <dd>{r.marked ? `${Math.round((r.present / r.marked) * 100)}%` : "–"}</dd>
              </div>
            </dl>
            <span className="pd-muted">
              {r.students} children · last class{" "}
              {r.lastClass ? shortDay(r.lastClass) : "none this month"}
            </span>
          </li>
        ))}
      </ul>
      <p className="pd-muted">
        A class counts once the teacher saves its attendance. Hours use each batch's class length,
        which you can change on the Batches tab.
      </p>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="pd-stat">
      <span className="pd-stat-label">{label}</span>
      <strong className="pd-stat-value">{value}</strong>
      <span className="pd-stat-hint">{hint}</span>
    </div>
  );
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** One row per teacher (active ones, plus anyone who taught that month), most hours first. */
export function teacherRows(
  data: Pick<Data, "teachers" | "batches">,
  sessions: SessionRow[],
): TeacherRow[] {
  const batchById = new Map(data.batches.map((b) => [b.id, b]));
  const rows = new Map<string, TeacherRow>();
  for (const t of data.teachers) {
    const mine = data.batches.filter((b) => b.teacherId === t.id);
    rows.set(t.id, {
      id: t.id,
      name: t.name,
      phone: t.phone,
      batches: mine.filter((b) => b.active !== false).length,
      students: new Set(mine.flatMap((b) => b.studentIds ?? [])).size,
      held: 0,
      cancelled: 0,
      minutes: 0,
      present: 0,
      marked: 0,
      lastClass: null,
    });
  }
  for (const s of sessions) {
    const batch = batchById.get(s.batchId);
    const row = batch && rows.get(batch.teacherId);
    if (!row) continue;
    if (s.status === "cancelled") {
      row.cancelled++;
      continue;
    }
    row.held++;
    row.minutes += batch.durationMinutes ?? DEFAULT_MINUTES;
    row.present += s.present;
    row.marked += s.marked;
    if (!row.lastClass || s.date > row.lastClass) row.lastClass = s.date;
  }
  const teachersById = new Map(data.teachers.map((t) => [t.id, t]));
  return [...rows.values()]
    .filter((r) => r.held || r.cancelled || teachersById.get(r.id)?.active !== false)
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

function downloadCsv(rows: TeacherRow[], month: string) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Teacher", "Mobile", "Batches", "Classes held", "Cancelled", "Hours"],
    ...rows.map((r) => [r.name, r.phone, r.batches, r.held, r.cancelled, hours(r.minutes)]),
  ].map((line) => line.map(cell).join(","));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `stoodant-teachers-${month.slice(0, 7)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
