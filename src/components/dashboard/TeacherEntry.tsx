import { useEffect, useState, type ReactNode } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import type { Mark, RosterEntry } from "@/lib/firebase/school";
import { Shell } from "./Shell";

const copy = DASHBOARD_CONFIG.teacher;
type Tab = keyof typeof copy.tabs;
type Batch = { name: string; schedule: string; students: RosterEntry[] };

/** Where the teacher page saves. Left out, the page runs in practice mode and only shows what would be saved. */
export type TeacherStore = {
  loadAttendance(
    date: string,
  ): Promise<{ status: "held" | "cancelled"; attendance: Record<string, Mark> } | null>;
  saveAttendance(
    date: string,
    status: "held" | "cancelled",
    attendance: Record<string, Mark>,
  ): Promise<void>;
  saveMarks(test: {
    title: string;
    date: string;
    max: number;
    scores: Record<string, number | null>;
  }): Promise<void>;
  saveNotes(date: string, notes: Record<string, string[]>): Promise<void>;
};
type Save = (task: () => Promise<void>, message: string) => void;

/**
 * The teacher's whole job in three taps: attendance (everyone present unless tapped), test marks
 * (one number per child, checked as they type) and a quick note picked from ready-made lines.
 */
export function TeacherEntry({
  batch,
  store,
  today,
  picker,
  onSignOut,
}: {
  batch: Batch;
  store?: TeacherStore | undefined;
  today: string;
  picker?: ReactNode | undefined;
  onSignOut?: (() => void) | undefined;
}) {
  const [tab, setTab] = useState<Tab>("attendance");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const show = (t: Tab) => {
    setTab(t);
    setSaved(null);
    setError(null);
  };
  const save: Save = (task, message) => {
    setSaved(null);
    setError(null);
    if (!store) return setSaved(message);
    setBusy(true);
    task()
      .then(() => setSaved(message))
      .catch(() => setError("Couldn't save. Please check the internet connection and try again."))
      .finally(() => setBusy(false));
  };
  const props = { students: batch.students, store, today, save, busy };

  return (
    <Shell role="Teacher" onSignOut={onSignOut}>
      <p className="pd-banner">{store ? copy.liveBanner : copy.sampleBanner}</p>
      {picker}
      <section className="pd-child">
        <h1>{batch.name}</h1>
        <p>{batch.schedule}</p>
      </section>

      <div className="pd-tabs" role="tablist" aria-label="What to enter">
        {(Object.keys(copy.tabs) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`pd-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`pd-panel-${t}`}
            onClick={() => show(t)}
          >
            {copy.tabs[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`pd-panel-${tab}`} aria-labelledby={`pd-tab-${tab}`}>
        {tab === "attendance" && <AttendanceForm {...props} />}
        {tab === "marks" && <MarksForm {...props} />}
        {tab === "notes" && <NotesForm {...props} />}
      </div>
      {saved && (
        <p className="pd-toast" role="status">
          <strong>{copy.saved}.</strong> {saved}
        </p>
      )}
      {error && (
        <p className="pd-alert" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </Shell>
  );
}

type FormProps = {
  students: RosterEntry[];
  store?: TeacherStore | undefined;
  today: string;
  save: Save;
  busy: boolean;
};

/** Today or the two days before it: a teacher can catch up on a missed entry, not rewrite history. */
function DayField({
  value,
  onChange,
  today,
}: {
  value: string;
  onChange: (v: string) => void;
  today: string;
}) {
  const min = new Date(Date.parse(today) - 2 * 86_400_000).toISOString().slice(0, 10);
  return (
    <label className="pd-field">
      Class date
      <input
        type="date"
        value={value}
        min={min}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </label>
  );
}

const longDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

function AttendanceForm({ students, store, today, save, busy }: FormProps) {
  const [date, setDate] = useState(today);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [cancelled, setCancelled] = useState(false);
  const [loaded, setLoaded] = useState(!store);

  // Opening a day that was already marked shows what was saved.
  useEffect(() => {
    if (!store) return;
    let live = true;
    setLoaded(false);
    store
      .loadAttendance(date)
      .then((existing) => {
        if (!live) return;
        setCancelled(existing?.status === "cancelled");
        setAbsent(
          new Set(
            Object.entries(existing?.attendance ?? {})
              .filter(([, m]) => m === "absent")
              .map(([id]) => id),
          ),
        );
      })
      .catch(() => undefined)
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [store, date]);

  const toggle = (id: string) =>
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const present = students.length - absent.size;
  const attendance = Object.fromEntries(
    students.map((s) => [s.id, absent.has(s.id) ? "absent" : "present"]),
  ) as Record<string, Mark>;
  return (
    <>
      <p className="pd-hint">{copy.attendanceHint}</p>
      <div className="pd-row">
        <DayField value={date} onChange={setDate} today={today} />
      </div>
      <p className="pd-muted" suppressHydrationWarning>
        {longDay(date)}
      </p>
      <label className="pd-check">
        <input
          type="checkbox"
          checked={cancelled}
          onChange={(e) => setCancelled(e.target.checked)}
        />
        {copy.cancelled}
      </label>
      {!cancelled && (
        <ul className="pd-roster">
          {students.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="pd-roster-btn"
                aria-pressed={!absent.has(s.id)}
                onClick={() => toggle(s.id)}
              >
                {s.name}
                <span className="pd-mark">{absent.has(s.id) ? "Missed" : "Present"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="pd-save"
        disabled={busy || !loaded || !students.length}
        onClick={() =>
          cancelled
            ? save(
                () => store!.saveAttendance(date, "cancelled", {}),
                `Class on ${longDay(date)} marked as cancelled.`,
              )
            : save(
                () => store!.saveAttendance(date, "held", attendance),
                `${present} of ${students.length} present on ${longDay(date)}.`,
              )
        }
      >
        {cancelled ? copy.save : `${copy.save} · ${present} of ${students.length} present`}
      </button>
    </>
  );
}

function MarksForm({ students, store, today, save, busy }: FormProps) {
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [max, setMax] = useState("20");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const maxNum = Number(max);
  const problem = (v: string | undefined) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return "Please type a number.";
    if (maxNum > 0 && n > maxNum) return `More than ${maxNum}. Please check.`;
    return null;
  };
  const errors = students.map((s) => problem(marks[s.id]));
  const entered = students.filter((s) => marks[s.id]).length;
  const ready =
    title.trim() !== "" && maxNum > 0 && maxNum <= 500 && entered > 0 && errors.every((e) => !e);
  const submit = () => {
    const name = title.trim();
    const scores = Object.fromEntries(
      students.map((s) => [s.id, marks[s.id] ? Number(marks[s.id]) : null]),
    );
    const missed = students.length - entered;
    save(
      async () => {
        await store!.saveMarks({ title: name, date, max: maxNum, scores });
        setTitle("");
        setMarks({});
      },
      `${name}: marks for ${entered} of ${students.length} children.${missed ? ` ${missed} marked as missed.` : ""}`,
    );
  };
  return (
    <>
      <p className="pd-hint">{copy.marksHint}</p>
      <div className="pd-row">
        <label className="pd-field">
          Test name
          <input
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fractions quiz"
          />
        </label>
        <label className="pd-field">
          Out of
          <input
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          />
        </label>
      </div>
      <div className="pd-row" style={{ marginTop: 10 }}>
        <DayField value={date} onChange={setDate} today={today} />
      </div>
      <ul className="pd-roster" style={{ marginTop: 14 }}>
        {students.map((s, i) => (
          <li key={s.id}>
            <label className="pd-mark-row">
              {s.name}
              <input
                inputMode="decimal"
                value={marks[s.id] ?? ""}
                aria-invalid={errors[i] ? true : undefined}
                aria-describedby={errors[i] ? `pd-err-${i}` : undefined}
                placeholder={`/ ${max || "?"}`}
                onChange={(e) => setMarks((m) => ({ ...m, [s.id]: e.target.value.trim() }))}
              />
            </label>
            {errors[i] && (
              <p className="pd-error" id={`pd-err-${i}`}>
                {errors[i]}
              </p>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="pd-save" disabled={!ready || busy} onClick={submit}>
        {copy.save}
      </button>
    </>
  );
}

function NotesForm({ students, store, today, save, busy }: FormProps) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const toggle = (id: string, chip: string) =>
    setPicked((p) => {
      const cur = p[id] ?? [];
      return {
        ...p,
        [id]: cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip].slice(-2),
      };
    });
  const count = Object.values(picked).filter((v) => v.length).length;
  return (
    <>
      <p className="pd-hint">{copy.notesHint}</p>
      <ul className="pd-roster">
        {students.map((s) => (
          <li key={s.id} className="pd-note-card">
            <strong>{s.name}</strong>
            <div className="pd-chips">
              {copy.noteChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={(picked[s.id] ?? []).includes(chip)}
                  onClick={() => toggle(s.id, chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="pd-save"
        disabled={!count || busy}
        onClick={() =>
          save(
            async () => {
              await store!.saveNotes(today, picked);
              setPicked({});
            },
            `Notes for ${count} ${count === 1 ? "child" : "children"} will go into Sunday's report.`,
          )
        }
      >
        {copy.save}
      </button>
    </>
  );
}
