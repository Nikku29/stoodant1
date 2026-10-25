import { useEffect, useMemo, useState } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import { SITE_CONFIG } from "@/config/siteConfig";
import type { LiveClass } from "@/lib/firebase/classes";
import { istParts, joinState, statusLine, time12 } from "@/lib/classes/time";
import { formatDay } from "@/lib/progress/insights";
import { useSection, type Nav } from "./AppNav";
import { HelpBox } from "./HelpBox";
import type { ClassStore } from "./LiveClasses";
import { Shell } from "./Shell";
import { TeacherEntry, type Batch, type Tab, type TeacherStore } from "./TeacherEntry";

const copy = DASHBOARD_CONFIG.home;
type Section = keyof typeof DASHBOARD_CONFIG.nav.teacher;
const SECTIONS = Object.keys(DASHBOARD_CONFIG.nav.teacher) as Section[];
const ICON = { today: "sun", batches: "layers", help: "help" } as const;
// Class reminders and the team's links open a batch: /teacher?batch=...&class=...
const fromQuery = (q: URLSearchParams): Section | null =>
  q.has("batch") || q.has("class") || q.has("doubt") ? "batches" : null;

export type TeacherBatch = { id: string; batch: Batch; store?: TeacherStore | undefined };

/**
 * The teacher's app: Today (the day's classes, what is left to do, every batch), My batches (attendance,
 * marks, notes, classes and material for one batch) and Help. Without stores it is practice mode.
 */
export function TeacherApp({
  name,
  batches,
  today,
  loadClasses,
  practiceClasses,
  practice = false,
  onSignOut,
}: {
  name: string;
  /** Can be empty: a new teacher still gets the whole app, with a note until the team adds a batch. */
  batches: TeacherBatch[];
  /** Practice mode (sample batch): nothing is saved or sent. */
  practice?: boolean;
  today: string;
  /** Live classes of every batch here, soonest first. */
  loadClasses: () => Promise<LiveClass[]>;
  practiceClasses?: ClassStore | undefined;
  onSignOut?: (() => void) | undefined;
}) {
  const [section, go, href] = useSection("/teacher", SECTIONS, fromQuery);
  const [pick, setPick] = useState(() => {
    const wanted = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("batch");
    return Math.max(0, batches.findIndex((b) => b.id === wanted));
  });
  const [startTab, setStartTab] = useState<Tab | undefined>(undefined);
  const nav: Nav<Section> = {
    items: SECTIONS.map((key) => ({ key, label: DASHBOARD_CONFIG.nav.teacher[key], icon: ICON[key] })),
    active: section,
    go: (key) => {
      setStartTab(undefined);
      go(key);
    },
    href,
  };
  const open = (batchId: string, tab?: Tab) => {
    setPick(Math.max(0, batches.findIndex((b) => b.id === batchId)));
    setStartTab(tab);
    go("batches");
  };
  const current = batches[Math.min(pick, batches.length - 1)];

  return (
    <Shell role="Teacher" onSignOut={onSignOut} nav={nav}>
      {section === "today" && (
        <TeacherToday name={name} batches={batches} loadClasses={loadClasses} open={open} />
      )}
      {section === "batches" && !current && (
        <>
          <section className="pd-child">
            <h1>{DASHBOARD_CONFIG.nav.teacher.batches}</h1>
          </section>
          <NoBatchYet />
        </>
      )}
      {section === "batches" && current && (
        <TeacherEntry
          key={`${current.id}-${startTab ?? ""}`}
          batch={current.batch}
          store={current.store}
          today={today}
          startTab={startTab}
          practiceClasses={practiceClasses}
          picker={
            batches.length > 1 ? (
              <div className="pd-picker" role="group" aria-label="Choose a batch">
                {batches.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={i === pick}
                    onClick={() => {
                      setStartTab(undefined);
                      setPick(i);
                    }}
                  >
                    {b.batch.name}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        />
      )}
      {section === "help" && (
        <>
          <section className="pd-child">
            <h1>{DASHBOARD_CONFIG.nav.teacher.help}</h1>
            <p>{DASHBOARD_CONFIG.teacher.help}</p>
          </section>
          <HelpBox
            practice={practice}
            startOpen
            whatsappText={
              current ? `Hi Stoodant, I need help with ${current.batch.name}.` : "Hi Stoodant, I'm a teacher and need help with the app."
            }
          />
        </>
      )}
    </Shell>
  );
}

/** A teacher the team hasn't put in a batch yet: what happens next, and two things to do meanwhile. */
function NoBatchYet() {
  return (
    <section className="pd-card pd-stack pd-welcome">
      <h2>{DASHBOARD_CONFIG.teacher.noBatchTitle}</h2>
      <p>{DASHBOARD_CONFIG.teacher.noBatches}</p>
      <a className="pd-cta" href="/teacher?sample=1">
        {DASHBOARD_CONFIG.teacher.tryPractice}
      </a>
      <a
        className="pd-ghost pd-ghost-link"
        href={`https://wa.me/${SITE_CONFIG.contact.whatsapp}?text=${encodeURIComponent("Hi Stoodant, please add me to my batch in the app.")}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {DASHBOARD_CONFIG.teacher.askToAdd}
      </a>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type Todo = { kind: "attendance" | "homework" | "doubts"; batchId: string; batchName: string; at: number };

/** The teacher's day on one screen. Every row opens the batch, on the right tab. */
function TeacherToday({
  name,
  batches,
  loadClasses,
  open,
}: {
  name: string;
  batches: TeacherBatch[];
  loadClasses: () => Promise<LiveClass[]>;
  open: (batchId: string, tab?: Tab) => void;
}) {
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const now = Date.now();
  // The real day in India, also in practice mode (whose sample records sit on a fixed date).
  const today = istParts(now).date;

  useEffect(() => {
    let live = true;
    loadClasses()
      .then((list) => {
        if (!live) return;
        const todays = list.filter((c) => c.status === "scheduled" && istParts(c.startAt).date === today);
        setClasses(todays);
        // A batch with a class today still needs its attendance once that class has started.
        const firstByBatch = new Map<string, LiveClass>();
        for (const c of todays) if (!firstByBatch.has(c.batchId)) firstByBatch.set(c.batchId, c);
        return Promise.all(
          [...firstByBatch.values()].map(async (c) => {
            const b = batches.find((x) => x.id === c.batchId);
            if (!b) return null;
            const saved = b.store ? await b.store.loadAttendance(today).catch(() => null) : null;
            return saved ? null : { kind: "attendance" as const, batchId: b.id, batchName: b.batch.name, at: c.startAt };
          }),
        );
      })
      .then(async (attendance) => {
        // A batch with no homework set in the last 7 days gets a gentle nudge.
        const weekAgo = Date.now() - 7 * 86_400_000;
        const homework = await Promise.all(
          batches.map(async (b) => {
            const list = b.store?.notices ? await b.store.notices.list().catch(() => null) : null;
            if (!list || list.some((n) => n.kind === "homework" && n.createdAt >= weekAgo)) return null;
            return { kind: "homework" as const, batchId: b.id, batchName: b.batch.name, at: 0 };
          }),
        );
        // Doubts waiting for an answer come first: a child is stuck until then. `at` holds how many.
        const doubts = await Promise.all(
          batches.map(async (b) => {
            const list = b.store?.doubts ? await b.store.doubts.list().catch(() => null) : null;
            const waiting = list?.filter((d) => d.status === "open").length ?? 0;
            return waiting ? { kind: "doubts" as const, batchId: b.id, batchName: b.batch.name, at: waiting } : null;
          }),
        );
        if (live)
          setTodos([...doubts, ...(attendance ?? []), ...homework].filter((r): r is Todo => r !== null));
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setTodos([]);
      });
    return () => {
      live = false;
    };
  }, [loadClasses, batches, today]);

  const students = useMemo(() => batches.reduce((n, b) => n + b.batch.students.length, 0), [batches]);
  const first = name.trim().split(" ")[0];

  return (
    <>
      <section className="pd-child">
        <p className="pd-hello">
          {greeting()} · {formatDay(today)}
        </p>
        <h1>{first ? `Welcome, ${first}` : "Welcome"}</h1>
        <p>
          {batches.length} {batches.length === 1 ? "batch" : "batches"} · {students} {copy.students}
        </p>
      </section>

      <section className="pd-section" aria-labelledby="pd-t-classes">
        <h2 id="pd-t-classes">{copy.teacherToday}</h2>
        {failed && <p className="pd-alert">{DASHBOARD_CONFIG.classes.loadFailed}</p>}
        {!classes && !failed && <p className="pd-muted">{DASHBOARD_CONFIG.classes.loading}</p>}
        {classes && !classes.length && <p className="pd-empty">{copy.noClassToday}</p>}
        {classes && classes.length > 0 && (
          <ul className="pd-todo">
            {classes.map((c) => {
              const state = joinState(c, now);
              return (
                <li key={c.id}>
                  <div className="pd-todo-row">
                    <span className="pd-todo-mark" aria-hidden="true">
                      {state === "ended" ? "✓" : "●"}
                    </span>
                    <span>
                      {time12(c.startAt)} · {c.batchName}
                      <small>
                        {c.topic ? `${c.topic} · ` : ""}
                        {statusLine(c, now)}
                      </small>
                    </span>
                    {state === "open" && c.joinUrl ? (
                      <a
                        className="pd-cta pd-today-start"
                        href={c.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Start
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="pd-link pd-todo-go"
                        onClick={() => open(c.batchId, "classes")}
                        aria-label={`Open ${c.batchName}'s classes`}
                      >
                        →
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pd-section" aria-labelledby="pd-t-todo">
        <h2 id="pd-t-todo">{copy.todo}</h2>
        {!todos ? (
          <p className="pd-muted">Loading…</p>
        ) : todos.length ? (
          <ul className="pd-todo">
            {todos.map((t) => (
              <li key={`${t.kind}-${t.batchId}`}>
                <button type="button" onClick={() => open(t.batchId, t.kind)}>
                  <span className="pd-todo-mark" aria-hidden="true">
                    {t.kind === "attendance" ? "!" : t.kind === "doubts" ? "?" : "+"}
                  </span>
                  {t.kind === "doubts" ? (
                    <span>
                      {copy.answerDoubts}: {t.batchName}
                      <small>
                        {t.at === 1 ? copy.answerDoubtsHintOne : copy.answerDoubtsHint.replace("{n}", String(t.at))}
                      </small>
                    </span>
                  ) : t.kind === "attendance" ? (
                    <span>
                      {copy.markAttendance}: {t.batchName}
                      <small>After the {time12(t.at)} class</small>
                    </span>
                  ) : (
                    <span>
                      {copy.setHomework}: {t.batchName}
                      <small>{copy.setHomeworkHint}</small>
                    </span>
                  )}
                  <span className="pd-todo-go" aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="pd-todo">
            <li>
              <div className="pd-todo-row">
                <span className="pd-todo-mark" data-done aria-hidden="true">
                  ✓
                </span>
                <span>{copy.allDone}</span>
              </div>
            </li>
          </ul>
        )}
      </section>

      <section className="pd-section" aria-labelledby="pd-t-batches">
        <h2 id="pd-t-batches">{copy.yourBatches}</h2>
        {!batches.length && <NoBatchYet />}
        <div className="pd-tiles">
          {batches.map((b) => (
            <button key={b.id} type="button" className="pd-tile" onClick={() => open(b.id)}>
              <span className="pd-tile-label">{b.batch.subject || "Batch"}</span>
              <strong className="pd-tile-name">{b.batch.name}</strong>
              <span className="pd-tile-hint">
                {b.batch.schedule}
                <br />
                {b.batch.students.length} {copy.students}
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
