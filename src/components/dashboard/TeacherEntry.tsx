import { useEffect, useMemo, useState, type ReactNode } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import type { Material } from "@/lib/firebase/materials";
import type { Mark, RosterEntry } from "@/lib/firebase/school";
import {
  classSummary,
  testAverage,
  type BatchHistory,
  type StudentRow,
} from "@/lib/progress/classSummary";
import { formatDay } from "@/lib/progress/insights";
import { SAMPLE_BATCH_NOTES, SAMPLE_HISTORY, SAMPLE_MATERIALS } from "@/lib/progress/sampleData";
import { TeacherClasses, type ClassStore } from "./LiveClasses";
import { practiceDoubtStore, TeacherDoubts, type DoubtStore } from "./Doubts";
import { practiceNoticeStore, TeacherNotices, type NoticeStore } from "./Notices";
import { practiceClassStore } from "./practiceClasses";
import { Materials, StudentReport, type BatchNote, type NewMaterial } from "./TeacherExtras";

const copy = DASHBOARD_CONFIG.teacher;
export type Tab = keyof typeof copy.tabs;
/**
 * Each part of the teacher's app is its own screen in the menu: Records (attendance, marks, notes and
 * reports, which belong together), Classes, Homework, Doubts and Study material.
 */
export type Area = "records" | "classes" | "homework" | "doubts" | "material";
export const RECORD_TABS = [
  "attendance",
  "marks",
  "notes",
  "overview",
  "recent",
] as const satisfies readonly Tab[];
/** Which screen a tab lives on: a reminder can then open the right screen and tab. */
export const areaOf = (tab: Tab): Area =>
  tab === "classes"
    ? "classes"
    : tab === "homework"
      ? "homework"
      : tab === "doubts"
        ? "doubts"
        : tab === "materials"
          ? "material"
          : "records";
export type Batch = {
  name: string;
  schedule: string;
  subject?: string;
  durationMinutes?: number;
  students: RosterEntry[];
};

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
  loadHistory(): Promise<BatchHistory>;
  deleteTest(id: string): Promise<void>;
  loadNotes(): Promise<BatchNote[]>;
  listMaterials(): Promise<Material[]>;
  addMaterial(m: NewMaterial): Promise<void>;
  removeMaterial(m: Material): Promise<void>;
  openMaterial(m: Material): Promise<string>;
  /** Live classes of this batch (the app). Left out on stoodant.com's own teacher page. */
  classes?: ClassStore;
  /** Homework and notices for this batch. Left out, practice mode keeps them in memory. */
  notices?: NoticeStore;
  /** Doubts from this batch's students. Left out, practice mode keeps them in memory. */
  doubts?: DoubtStore;
  /** Children who tapped Join in that day's live classes, or null when there was no live class. */
  joinedOn?(date: string): Promise<Set<string> | null>;
};
type Save = (task: () => Promise<void>, message: string) => void;

/**
 * One batch on one of the teacher's screens. On Records, the teacher's whole job in three taps:
 * attendance (everyone present unless tapped), test marks (one number per child, checked as they type)
 * and a quick note picked from ready-made lines. The app frame (menu, Today, Help) is TeacherApp's.
 */
export function TeacherEntry({
  area,
  title,
  batch,
  store,
  today,
  picker,
  startTab,
  practiceClasses,
}: {
  area: Area;
  /** The screen's name, e.g. "Doubts". */
  title: string;
  batch: Batch;
  store?: TeacherStore | undefined;
  today: string;
  picker?: ReactNode | undefined;
  /** The tab to open first, e.g. Attendance from a "Mark attendance" reminder on the Today screen. */
  startTab?: Tab | undefined;
  /** Practice mode's in-memory classes, shared with the Today screen so both show the same list. */
  practiceClasses?: ClassStore | undefined;
}) {
  const tabs: readonly Tab[] =
    area === "records" ? RECORD_TABS : [area === "material" ? "materials" : area];
  const [tab, setTab] = useState<Tab>(() =>
    startTab && tabs.includes(startTab) ? startTab : tabs[0]!,
  );
  const classStore = useMemo(
    () => store?.classes ?? practiceClasses ?? practiceClassStore(),
    [store, practiceClasses],
  );
  const noticeStore = useMemo(() => store?.notices ?? practiceNoticeStore(today), [store, today]);
  const doubtStore = useMemo(() => store?.doubts ?? practiceDoubtStore(), [store]);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openDate, setOpenDate] = useState(today);
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
  const materials = useMaterialStore(store);
  const openDay = (date: string) => {
    setOpenDate(date);
    show("attendance");
  };

  return (
    <>
      {!store && <p className="pd-banner">{copy.sampleBanner}</p>}
      <section className="pd-child">
        <h1>{title}</h1>
        <p>
          {batch.name} · {batch.schedule}
        </p>
      </section>
      {picker}

      {tabs.length > 1 && (
        <div className="pd-tabs" role="tablist" aria-label="What to enter">
          {tabs.map((t) => (
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
      )}

      {store && area === "records" && <p className="pd-hint">{copy.liveBanner}</p>}
      <div
        role={tabs.length > 1 ? "tabpanel" : undefined}
        id={`pd-panel-${tab}`}
        aria-labelledby={tabs.length > 1 ? `pd-tab-${tab}` : undefined}
      >
        {tab === "classes" && (
          <TeacherClasses
            store={classStore}
            defaultMinutes={batch.durationMinutes ?? 60}
            practice={!store}
          />
        )}
        {tab === "attendance" && <AttendanceForm key={openDate} {...props} start={openDate} />}
        {tab === "marks" && <MarksForm {...props} />}
        {tab === "homework" && (
          <TeacherNotices
            store={noticeStore}
            today={today}
            students={batch.students.length}
            practice={!store?.notices}
          />
        )}
        {tab === "doubts" && <TeacherDoubts store={doubtStore} practice={!store?.doubts} />}
        {tab === "notes" && <NotesForm {...props} />}
        {tab === "overview" && (
          <ClassOverview
            {...props}
            batch={{ name: batch.name, schedule: batch.schedule, subject: batch.subject ?? "" }}
          />
        )}
        {tab === "materials" && <Materials {...materials} practice={!store} />}
        {tab === "recent" && <Recent {...props} openDay={openDay} />}
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
    </>
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

function AttendanceForm({
  students,
  store,
  today,
  save,
  busy,
  start,
}: FormProps & { start: string }) {
  const [date, setDate] = useState(start);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [cancelled, setCancelled] = useState(false);
  const [loaded, setLoaded] = useState(!store);
  const [fromJoins, setFromJoins] = useState(false);

  // Opening a day that was already marked shows what was saved.
  useEffect(() => {
    if (!store) return;
    let live = true;
    setLoaded(false);
    setFromJoins(false);
    store
      .loadAttendance(date)
      .then(async (existing) => {
        // A new day after a live class starts from who tapped Join; the teacher only corrects it.
        const joined = existing ? null : await store.joinedOn?.(date).catch(() => null);
        if (!live) return;
        setCancelled(existing?.status === "cancelled");
        if (joined) {
          setFromJoins(true);
          setAbsent(new Set(students.filter((s) => !joined.has(s.id)).map((s) => s.id)));
          return;
        }
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
    // Students is the batch roster; it only changes when the batch does, which remounts this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {fromJoins && <p className="pd-banner">{DASHBOARD_CONFIG.classes.joinedHint}</p>}
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

/** Saved days and tests for the batch, from the store, or the sample history in practice mode. */
function useHistory(store: TeacherStore | undefined) {
  const [history, setHistory] = useState<BatchHistory | null>(store ? null : SAMPLE_HISTORY);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!store) return;
    let live = true;
    store
      .loadHistory()
      .then((h) => live && setHistory(h))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [store, version]);
  return { history, failed, reload: () => setVersion((v) => v + 1) };
}

const LOAD_FAILED =
  "Couldn't load the saved records. Please check the internet connection and try again.";

function ClassOverview({
  students,
  store,
  today,
  batch,
}: FormProps & { batch: { name: string; schedule: string; subject: string } }) {
  const { history, failed } = useHistory(store);
  const [child, setChild] = useState<RosterEntry | null>(null);
  const [notes, setNotes] = useState<BatchNote[] | null>(store ? null : SAMPLE_BATCH_NOTES);
  useEffect(() => {
    if (!store || !child || notes) return;
    store.loadNotes().then(setNotes, () => setNotes([]));
  }, [store, child, notes]);
  if (failed) return <p className="pd-alert">{LOAD_FAILED}</p>;
  if (!history) return <p className="pd-muted">Loading…</p>;
  if (child)
    return (
      <StudentReport
        student={child}
        batch={batch}
        history={history}
        notes={notes}
        today={today}
        onBack={() => setChild(null)}
      />
    );
  if (!history.days.length && !history.tests.length)
    return <p className="pd-empty">{copy.noHistory}</p>;
  const summary = classSummary(students, history, today);
  const rows = [...summary.rows].sort(
    (a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name),
  );
  return (
    <>
      <p className="pd-hint">{copy.overviewHint}</p>
      <section className="pd-stats" aria-label="Class summary">
        <div className="pd-stat">
          <span className="pd-stat-label">Attendance</span>
          <strong className="pd-stat-value">
            {summary.attendance == null ? "–" : `${summary.attendance}%`}
          </strong>
          <span className="pd-stat-hint">{summary.classesHeld} classes, last 30 days</span>
        </div>
        <div className="pd-stat">
          <span className="pd-stat-label">Class average</span>
          <strong className="pd-stat-value">
            {summary.average == null ? "–" : `${summary.average}%`}
          </strong>
          <span className="pd-stat-hint">last {summary.testsCount} tests</span>
        </div>
        <div className="pd-stat">
          <span className="pd-stat-label">Check in with</span>
          <strong className="pd-stat-value">{summary.needAttention}</strong>
          <span className="pd-stat-hint">
            {summary.needAttention ? copy.needAttention : copy.allGood}
          </span>
        </div>
      </section>
      <ul className="pd-roster pd-class" style={{ marginTop: 14 }}>
        {rows.map((r) => (
          <ClassRow key={r.id} r={r} onOpen={() => setChild({ id: r.id, name: r.name })} />
        ))}
      </ul>
    </>
  );
}

function ClassRow({ r, onOpen }: { r: StudentRow; onOpen: () => void }) {
  const arrow = r.trend === "up" ? "↑" : r.trend === "down" ? "↓" : "";
  return (
    <li className={`pd-class-row${r.flags.length ? " is-flagged" : ""}`}>
      <div className="pd-class-name">
        <strong>{r.name}</strong>
        {r.flags.length > 0 && <span className="pd-class-flags">{r.flags.join(" · ")}</span>}
      </div>
      <dl className="pd-class-nums">
        <div>
          <dt>Classes</dt>
          <dd>{r.held ? `${r.attended}/${r.held}` : "–"}</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd>
            {r.average == null ? "–" : `${r.average}%`}
            {arrow && (
              <span className="pd-class-trend" aria-label={DASHBOARD_CONFIG.trendLabels[r.trend]}>
                {" "}
                {arrow}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Last test</dt>
          <dd>{r.latest == null ? "–" : `${r.latest}%`}</dd>
        </div>
      </dl>
      <button type="button" className="pd-link pd-row-link" onClick={onOpen}>
        {copy.openReport}
      </button>
    </li>
  );
}

const TWO_DAYS = 48 * 3_600_000;

function Recent({
  students,
  store,
  today,
  save,
  busy,
  openDay,
}: FormProps & { openDay: (date: string) => void }) {
  const { history, failed, reload } = useHistory(store);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  if (failed) return <p className="pd-alert">{LOAD_FAILED}</p>;
  if (!history) return <p className="pd-muted">Loading…</p>;
  if (!history.days.length && !history.tests.length)
    return <p className="pd-empty">{copy.noHistory}</p>;
  // Practice mode measures "two days" from the sample's own today.
  const now = store ? Date.now() : Date.parse(`${today}T20:00:00+05:30`);
  const earliest = new Date(Date.parse(today) - 2 * 86_400_000).toISOString().slice(0, 10);
  const days = [...history.days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const tests = history.tests
    .filter((t) => !removed.has(t.id))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  return (
    <>
      <p className="pd-hint">{copy.recentHint}</p>
      <h2 className="pd-subhead">Class days</h2>
      <ul className="pd-list">
        {days.map((d) => {
          const marks = Object.values(d.attendance);
          const present = marks.filter((m) => m !== "absent").length;
          return (
            <li key={d.date} className="pd-item">
              <div className="pd-item-head">
                <strong>{formatDay(d.date)}</strong>
                <span>
                  {d.status === "cancelled"
                    ? "Cancelled"
                    : `${present} of ${marks.length || students.length} present`}
                </span>
              </div>
              {d.date >= earliest && (
                <div className="pd-actions">
                  <button type="button" className="pd-link" onClick={() => openDay(d.date)}>
                    Open in Attendance
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <h2 className="pd-subhead">Tests</h2>
      {!tests.length && <p className="pd-empty">No tests saved yet.</p>}
      <ul className="pd-list">
        {tests.map((t) => {
          const sat = Object.values(t.scores).filter((v) => v != null).length;
          const avg = testAverage(t);
          const canRemove = t.createdAt != null && now - t.createdAt < TWO_DAYS;
          return (
            <li key={t.id} className="pd-item">
              <div className="pd-item-head">
                <strong>{t.title}</strong>
                <span>{formatDay(t.date)}</span>
              </div>
              <span className="pd-muted">
                Out of {t.max} · {sat} of {Object.keys(t.scores).length} sat it
                {avg != null && ` · class average ${avg}%`}
              </span>
              {canRemove && (
                <div className="pd-actions">
                  <button
                    type="button"
                    className="pd-link"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Remove "${t.title}"? You can enter it again from Test marks.`,
                        )
                      )
                        return;
                      if (!store) setRemoved((r) => new Set(r).add(t.id));
                      save(async () => {
                        await store!.deleteTest(t.id);
                        setRemoved((r) => new Set(r).add(t.id));
                        reload();
                      }, `"${t.title}" removed. Enter it again from Test marks if needed.`);
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** The study material store, or an in-memory list in practice mode where nothing is saved. */
function useMaterialStore(store: TeacherStore | undefined) {
  const [practiceList, setPracticeList] = useState<Material[]>(SAMPLE_MATERIALS);
  return useMemo(
    () =>
      store
        ? {
            load: () => store.listMaterials(),
            add: (m: NewMaterial) => store.addMaterial(m),
            remove: (m: Material) => store.removeMaterial(m),
            open: (m: Material) => store.openMaterial(m),
          }
        : {
            load: async () => practiceList,
            add: async (m: NewMaterial) =>
              setPracticeList((list) => [
                {
                  id: `practice-${list.length}`,
                  batchId: "sample",
                  title: m.title,
                  kind: m.kind,
                  ...(m.description ? { description: m.description } : {}),
                  ...(m.file
                    ? {
                        file: { path: "", name: m.file.name, size: m.file.size, type: m.file.type },
                      }
                    : { link: m.link ?? "" }),
                  teacherName: "You",
                  createdBy: "practice",
                  createdAt: { toMillis: () => Date.now() },
                },
                ...list,
              ]),
            remove: async (m: Material) =>
              setPracticeList((list) => list.filter((x) => x.id !== m.id)),
          },
    [store, practiceList],
  );
}
