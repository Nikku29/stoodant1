import { useEffect, useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import {
  ACCEPT,
  allowedType,
  fileType,
  kindLabel,
  MAX_FILE_BYTES,
  sizeLabel,
  type Material,
  type MaterialKind,
} from "@/lib/firebase/materials";
import type { RosterEntry } from "@/lib/firebase/school";
import type { BatchHistory } from "@/lib/progress/classSummary";
import {
  formatDay,
  formatMonth,
  improvement,
  monthOf,
  previousPeriod,
  type Period,
} from "@/lib/progress/insights";
import { MarksChart } from "./Charts";
import { MaterialList } from "./MaterialList";

// Two teacher tools beside the daily entry forms: a child's report for a parent-teacher meeting, and
// study material (notes, past papers, homework) shared with the batch.

const copy = DASHBOARD_CONFIG.teacher;

export type BatchNote = { studentId: string; date: string; lines: string[] };
export type NewMaterial = {
  title: string;
  kind: MaterialKind;
  description: string;
  link?: string | undefined;
  file?: File | undefined;
};

// ---- Student report for parent-teacher meetings ----

type Range = "this" | "last" | "three";
const RANGES: [Range, string][] = [
  ["this", "This month"],
  ["last", "Last month"],
  ["three", "Last 3 months"],
];

function rangeOf(range: Range, today: string): Period {
  const thisMonth = monthOf(today);
  if (range === "this") return { from: thisMonth.from, to: today };
  const last = previousPeriod(thisMonth, "month");
  if (range === "last") return last;
  return { from: previousPeriod(last, "month").from, to: today };
}

const pct = (score: number | null, max: number) =>
  score == null || max <= 0 ? null : Math.round((score / max) * 100);

/** One child's month (or three) from the batch's saved records: classes, tests and the teacher's notes. */
export function StudentReport({
  student,
  batch,
  history,
  notes,
  today,
  onBack,
}: {
  student: RosterEntry;
  batch: { name: string; subject: string; schedule: string };
  history: BatchHistory;
  notes: BatchNote[] | null;
  today: string;
  onBack: () => void;
}) {
  const [range, setRange] = useState<Range>("this");
  const period = rangeOf(range, today);
  const within = (d: string) => d >= period.from && d <= period.to;

  const days = history.days
    .filter((d) => d.status === "held" && within(d.date) && student.id in d.attendance)
    .sort((a, b) => a.date.localeCompare(b.date));
  const missed = days.filter((d) => d.attendance[student.id] === "absent");
  const late = days.filter((d) => d.attendance[student.id] === "late").length;
  const attended = days.length - missed.length;
  const attendance = days.length ? Math.round((attended / days.length) * 100) : null;
  const cancelled = history.days.filter((d) => d.status === "cancelled" && within(d.date)).length;

  const allTests = history.tests
    .filter((t) => student.id in t.scores && t.date <= period.to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      subject: batch.subject,
      title: t.title,
      score: t.scores[student.id] ?? null,
      max: t.max,
    }));
  const tests = allTests.filter((t) => within(t.date));
  const marked = tests.map((t) => pct(t.score, t.max)).filter((p): p is number => p != null);
  const average = marked.length
    ? Math.round(marked.reduce((a, b) => a + b, 0) / marked.length)
    : null;
  const { delta, trend } = improvement(allTests);
  const points = allTests
    .filter((t) => t.score != null)
    .slice(-10)
    .map((t) => ({ ...t, percent: pct(t.score, t.max) as number }));
  const myNotes = (notes ?? [])
    .filter((n) => n.studentId === student.id && within(n.date) && n.lines.length)
    .sort((a, b) => b.date.localeCompare(a.date));

  const label =
    range === "three"
      ? `${formatMonth(period.from)} to ${formatMonth(period.to)}`
      : formatMonth(period.from);
  const first = student.name.split(" ")[0];
  const summary = [
    days.length
      ? `${first} attended ${attended} of ${days.length} classes (${attendance}%).`
      : `No classes were marked for ${first} in this period.`,
    average != null
      ? `Average ${average}% across ${marked.length} ${marked.length === 1 ? "test" : "tests"}${
          delta != null && trend !== "unknown"
            ? trend === "up"
              ? `, up ${delta} points on the tests before.`
              : trend === "down"
                ? `, down ${-delta} points on the tests before.`
                : ", steady compared with the tests before."
            : "."
        }`
      : tests.length
        ? `${first} missed the ${tests.length === 1 ? "test" : "tests"} in this period.`
        : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="pd-report" aria-labelledby="pd-report-name">
      <div className="pd-noprint pd-actions">
        <button type="button" className="pd-link" onClick={onBack}>
          ← Back to the class
        </button>
      </div>
      <header className="pd-report-head">
        <p className="pd-muted">{copy.reportKicker}</p>
        <h2 id="pd-report-name">{student.name}</h2>
        <p>
          {batch.name} · {label}
        </p>
      </header>
      <div className="pd-chips pd-noprint" role="group" aria-label="Period">
        {RANGES.map(([r, text]) => (
          <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
            {text}
          </button>
        ))}
      </div>

      <p className="pd-summary">{summary}</p>

      <section className="pd-stats" aria-label="Summary">
        <div className="pd-stat">
          <span className="pd-stat-label">Attendance</span>
          <strong className="pd-stat-value">{attendance == null ? "–" : `${attendance}%`}</strong>
          <span className="pd-stat-hint">
            {attended} of {days.length} classes{late ? ` · ${late} late` : ""}
          </span>
        </div>
        <div className="pd-stat">
          <span className="pd-stat-label">Test average</span>
          <strong className="pd-stat-value">{average == null ? "–" : `${average}%`}</strong>
          <span className="pd-stat-hint">
            {marked.length} {marked.length === 1 ? "test" : "tests"}
          </span>
        </div>
        <div className="pd-stat">
          <span className="pd-stat-label">Improvement</span>
          <strong className="pd-stat-value">
            {delta == null ? "–" : `${delta > 0 ? "+" : ""}${delta}`}
          </strong>
          <span className="pd-stat-hint">
            {delta == null ? "needs 2 tests" : "points, own earlier tests"}
          </span>
        </div>
      </section>

      <h3 className="pd-subhead">Marks over time</h3>
      <MarksChart points={points} label={`${student.name}: marks in ${batch.subject}`} />

      <h3 className="pd-subhead">Tests</h3>
      {!tests.length && <p className="pd-empty">No tests in this period.</p>}
      <ul className="pd-list">
        {tests
          .slice()
          .reverse()
          .map((t) => (
            <li key={`${t.date}-${t.title}`} className="pd-item">
              <div className="pd-item-head">
                <strong>{t.title}</strong>
                <span>
                  {t.score == null ? "Missed" : `${t.score} / ${t.max} (${pct(t.score, t.max)}%)`}
                </span>
              </div>
              <span className="pd-muted">{formatDay(t.date)}</span>
            </li>
          ))}
      </ul>

      <h3 className="pd-subhead">Classes missed</h3>
      <p className="pd-muted">
        {missed.length
          ? `${missed.map((d) => formatDay(d.date)).join(", ")}.`
          : days.length
            ? "None. Every class attended."
            : "No classes marked."}
        {cancelled
          ? ` ${cancelled} ${cancelled === 1 ? "class was" : "classes were"} cancelled.`
          : ""}
      </p>

      <h3 className="pd-subhead">Teacher's notes</h3>
      {notes == null ? (
        <p className="pd-muted">Loading…</p>
      ) : !myNotes.length ? (
        <p className="pd-empty">No notes in this period.</p>
      ) : (
        <ul className="pd-list">
          {myNotes.map((n) => (
            <li key={n.date} className="pd-item">
              <strong>{formatDay(n.date)}</strong>
              <span>{n.lines.join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="pd-save pd-noprint" onClick={() => window.print()}>
        {copy.printReport}
      </button>
      <p className="pd-muted pd-noprint">{copy.printHint}</p>
    </article>
  );
}

// ---- Study material ----

const KINDS = Object.entries(kindLabel) as [MaterialKind, string][];

export function Materials({
  load,
  add,
  remove,
  open,
  practice,
}: {
  load: () => Promise<Material[]>;
  add: (m: NewMaterial) => Promise<void>;
  remove: (m: Material) => Promise<void>;
  open?: ((m: Material) => Promise<string>) | undefined;
  practice: boolean;
}) {
  const [items, setItems] = useState<Material[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    load()
      .then((m) => live && setItems(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [load, version]);

  if (adding)
    return (
      <MaterialForm
        practice={practice}
        onCancel={() => setAdding(false)}
        onSave={async (m) => {
          await add(m);
          setAdding(false);
          setMessage({
            ok: true,
            text: practice
              ? `"${m.title}" would now be on parents' pages. Practice mode saves nothing.`
              : `"${m.title}" is now on parents' pages.`,
          });
          setVersion((v) => v + 1);
        }}
      />
    );

  return (
    <>
      <p className="pd-hint">{copy.materialsHint}</p>
      <button type="button" className="pd-save" onClick={() => setAdding(true)}>
        {copy.materialsAdd}
      </button>
      {message && (
        <p className={message.ok ? "pd-toast" : "pd-alert"} role="status" style={{ marginTop: 12 }}>
          {message.text}
        </p>
      )}
      {failed && <p className="pd-alert">Couldn't load the study material. Please try again.</p>}
      {items && !items.length && (
        <p className="pd-empty" style={{ marginTop: 14 }}>
          {copy.materialsEmpty}
        </p>
      )}
      {!items && !failed && <p className="pd-muted">Loading…</p>}
      <MaterialList
        items={items ?? []}
        open={practice ? undefined : open}
        openError={practice ? copy.materialsPractice : undefined}
        onRemove={(m) => {
          if (!window.confirm(`Remove "${m.title}"? Parents won't see it any more.`)) return;
          remove(m).then(
            () => {
              setMessage({ ok: true, text: `"${m.title}" removed.` });
              setVersion((v) => v + 1);
            },
            () => setMessage({ ok: false, text: "Couldn't remove it. Please try again." }),
          );
        }}
      />
    </>
  );
}

function MaterialForm({
  practice,
  onSave,
  onCancel,
}: {
  practice: boolean;
  onSave: (m: NewMaterial) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MaterialKind>("notes");
  const [description, setDescription] = useState("");
  const [how, setHow] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileProblem = !file
    ? null
    : file.size > MAX_FILE_BYTES
      ? `That file is ${sizeLabel(file.size)}. The limit is 20 MB; try a smaller PDF or a photo.`
      : !allowedType(fileType(file))
        ? "That kind of file can't be shared. Use a PDF, a photo, or a Word, PowerPoint, Excel or text file."
        : null;
  const linkOk = /^https:\/\/\S+\.\S+/.test(link.trim());
  const valid =
    title.trim().length > 0 && (how === "file" ? Boolean(file) && !fileProblem : linkOk);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    onSave({
      title: title.trim(),
      kind,
      description: description.trim(),
      ...(how === "file" ? { file: file! } : { link: link.trim() }),
    }).catch(() => {
      setBusy(false);
      setError("Couldn't share it. Please check the internet connection and try again.");
    });
  };

  return (
    <form className="pd-card pd-stack" onSubmit={submit}>
      <h2>{copy.materialsAdd}</h2>
      <label className="pd-field">
        Title
        <input
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Chapter 5 notes"
          required
        />
      </label>
      <label className="pd-field">
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
          {KINDS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="pd-field">
        A line for parents (optional)
        <textarea
          value={description}
          maxLength={300}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Revise this before Friday's test."
        />
      </label>
      <div className="pd-toggle" role="group" aria-label="Share a file or a link">
        <button type="button" aria-pressed={how === "file"} onClick={() => setHow("file")}>
          Upload a file
        </button>
        <button type="button" aria-pressed={how === "link"} onClick={() => setHow("link")}>
          Paste a link
        </button>
      </div>
      {how === "file" ? (
        <label className="pd-field">
          File (PDF, photo, Word, PowerPoint or Excel, up to 20 MB)
          <input
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && !fileProblem && (
            <span className="pd-muted">
              {file.name}, {sizeLabel(file.size)}
            </span>
          )}
          {fileProblem && (
            <span className="pd-alert" role="alert">
              {fileProblem}
            </span>
          )}
        </label>
      ) : (
        <label className="pd-field">
          Link (Google Drive, YouTube or any https address)
          <input
            type="url"
            inputMode="url"
            value={link}
            maxLength={500}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
          />
        </label>
      )}
      {practice && <p className="pd-muted">{copy.sampleBanner}</p>}
      {error && (
        <p className="pd-alert" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="pd-save" disabled={!valid || busy}>
        {busy ? (file && how === "file" ? "Uploading…" : "Saving…") : "Share with parents"}
      </button>
      <button type="button" className="pd-link" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </form>
  );
}
