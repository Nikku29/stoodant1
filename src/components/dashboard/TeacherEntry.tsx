import { useState } from "react";

import { Logo } from "@/brand/Logo";
import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import "./dashboard.css";

const copy = DASHBOARD_CONFIG.teacher;
type Tab = keyof typeof copy.tabs;
type Batch = { name: string; schedule: string; students: string[] };

/**
 * The teacher's whole job in three taps: attendance (everyone present unless tapped), test marks
 * (one number per child, checked as they type) and a quick note picked from ready-made lines.
 * Practice mode for now: Save only shows what would be stored.
 */
export function TeacherEntry({ batch }: { batch: Batch }) {
  const [tab, setTab] = useState<Tab>("attendance");
  const [saved, setSaved] = useState<string | null>(null);
  const show = (t: Tab) => {
    setTab(t);
    setSaved(null);
  };

  return (
    <div className="pd">
      <header className="pd-top">
        <a href="/" className="pd-logo" aria-label="Stoodant home">
          <Logo variant="full" />
        </a>
        <span className="pd-role">Teacher</span>
      </header>
      <main className="pd-main">
        <p className="pd-banner">{copy.sampleBanner}</p>
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
          {tab === "attendance" && <AttendanceForm students={batch.students} onSave={setSaved} />}
          {tab === "marks" && <MarksForm students={batch.students} onSave={setSaved} />}
          {tab === "notes" && <NotesForm students={batch.students} onSave={setSaved} />}
        </div>
        {saved && (
          <p className="pd-toast" role="status">
            <strong>{copy.saved}.</strong> {saved}
          </p>
        )}
      </main>
    </div>
  );
}

const today = () =>
  new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

function AttendanceForm({
  students,
  onSave,
}: {
  students: string[];
  onSave: (msg: string) => void;
}) {
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const present = students.length - absent.size;
  return (
    <>
      <p className="pd-hint">{copy.attendanceHint}</p>
      <p className="pd-muted" suppressHydrationWarning>
        {today()}
      </p>
      <ul className="pd-roster">
        {students.map((name) => (
          <li key={name}>
            <button
              type="button"
              className="pd-roster-btn"
              aria-pressed={!absent.has(name)}
              onClick={() => toggle(name)}
            >
              {name}
              <span className="pd-mark">{absent.has(name) ? "Missed" : "Present"}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="pd-save"
        onClick={() => onSave(`${present} of ${students.length} present today.`)}
      >
        {copy.save} · {present} of {students.length} present
      </button>
    </>
  );
}

function MarksForm({ students, onSave }: { students: string[]; onSave: (msg: string) => void }) {
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
  const errors = students.map((s) => problem(marks[s]));
  const entered = students.filter((s) => marks[s]).length;
  const ready = title.trim() !== "" && maxNum > 0 && entered > 0 && errors.every((e) => !e);
  return (
    <>
      <p className="pd-hint">{copy.marksHint}</p>
      <div className="pd-row">
        <label className="pd-field">
          Test name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fractions quiz"
          />
        </label>
        <label className="pd-field">
          Out of
          <input
            inputMode="numeric"
            value={max}
            onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
          />
        </label>
      </div>
      <ul className="pd-roster" style={{ marginTop: 14 }}>
        {students.map((name, i) => (
          <li key={name}>
            <label className="pd-mark-row">
              {name}
              <input
                inputMode="decimal"
                value={marks[name] ?? ""}
                aria-invalid={errors[i] ? true : undefined}
                aria-describedby={errors[i] ? `pd-err-${i}` : undefined}
                placeholder={`/ ${max || "?"}`}
                onChange={(e) => setMarks((m) => ({ ...m, [name]: e.target.value.trim() }))}
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
      <button
        type="button"
        className="pd-save"
        disabled={!ready}
        onClick={() =>
          onSave(
            `${title.trim()}: marks for ${entered} of ${students.length} children. ${students.length - entered ? `${students.length - entered} marked as missed.` : ""}`,
          )
        }
      >
        {copy.save}
      </button>
    </>
  );
}

function NotesForm({ students, onSave }: { students: string[]; onSave: (msg: string) => void }) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const toggle = (name: string, chip: string) =>
    setPicked((p) => {
      const cur = p[name] ?? [];
      return {
        ...p,
        [name]: cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip].slice(-2),
      };
    });
  const count = Object.values(picked).filter((v) => v.length).length;
  return (
    <>
      <p className="pd-hint">{copy.notesHint}</p>
      <ul className="pd-roster">
        {students.map((name) => (
          <li key={name} className="pd-note-card">
            <strong>{name}</strong>
            <div className="pd-chips">
              {copy.noteChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={(picked[name] ?? []).includes(chip)}
                  onClick={() => toggle(name, chip)}
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
        disabled={!count}
        onClick={() => onSave(`Notes for ${count} children will go into Sunday's report.`)}
      >
        {copy.save}
      </button>
    </>
  );
}
