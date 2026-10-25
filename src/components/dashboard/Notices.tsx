import { useCallback, useEffect, useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import type { NewNotice, Notice, NoticeKind } from "@/lib/firebase/notices";
import { formatDay } from "@/lib/progress/insights";

const copy = DASHBOARD_CONFIG.notices;
const DAY = 86_400_000;

/** Where a batch's homework and notices are kept. Practice mode uses an in-memory one. */
export type NoticeStore = {
  list(): Promise<Notice[]>;
  add(n: NewNotice): Promise<void>;
  remove(id: string): Promise<void>;
  doneCount(id: string): Promise<number>;
};

/** A family's view: each item with its Done tick for the child. */
export type FamilyNotice = Notice & { done: boolean };
export type FamilyNoticeStore = {
  list(): Promise<FamilyNotice[]>;
  setDone(id: string, done: boolean): Promise<void>;
};

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function dueLabel(due: string, today: string): string {
  if (due === today) return copy.dueToday;
  if (due === addDays(today, 1)) return copy.dueTomorrow;
  if (due < today) return `${copy.overdue} (${formatDay(due)})`;
  return `${copy.due} ${formatDay(due)}`;
}

// ---------------------------------------------------------------------------------------------------
// Teachers: post homework or a notice to the batch, see who is done, remove a post.

export function TeacherNotices({
  store,
  today,
  students,
  practice,
}: {
  store: NoticeStore;
  today: string;
  students: number;
  practice: boolean;
}) {
  const [items, setItems] = useState<Notice[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    store.list().then(
      (list) => {
        setItems(list);
        for (const n of list.filter((x) => x.kind === "homework").slice(0, 10))
          store.doneCount(n.id).then(
            (c) => setCounts((all) => ({ ...all, [n.id]: c })),
            () => undefined,
          );
      },
      () => setFailed(true),
    );
  }, [store]);
  useEffect(reload, [reload]);

  return (
    <>
      <p className="pd-hint">{copy.teacherHint}</p>
      <NoticeForm
        today={today}
        onSave={async (n) => {
          await store.add(n);
          setMessage({ ok: true, text: practice ? copy.practicePosted : copy.posted });
          navigator.vibrate?.(12);
          reload();
        }}
      />
      {message && (
        <p className={message.ok ? "pd-toast" : "pd-alert"} role="status" style={{ marginTop: 12 }}>
          {message.text}
        </p>
      )}
      <section className="pd-section" aria-labelledby="pd-nt-list">
        <h2 id="pd-nt-list">{copy.sentTitle}</h2>
        {failed && <p className="pd-alert">{copy.loadFailed}</p>}
        {!items && !failed && <p className="pd-muted">Loading…</p>}
        {items && !items.length && <p className="pd-empty">{copy.teacherEmpty}</p>}
        {items && items.length > 0 && (
          <ul className="pd-list pd-notices">
            {items.map((n) => (
              <li key={n.id} className="pd-item pd-notice" data-kind={n.kind}>
                <div className="pd-item-head">
                  <span className="pd-notice-kind">{n.kind === "homework" ? copy.kindHomework : copy.kindNotice}</span>
                  <small className="pd-muted">
                    {n.kind === "homework" && n.due ? dueLabel(n.due, today) : formatDay(new Date(n.createdAt || Date.now()).toISOString().slice(0, 10))}
                  </small>
                </div>
                <strong>{n.title}</strong>
                {n.body && <p className="pd-notice-body">{n.body}</p>}
                <div className="pd-notice-foot">
                  {n.kind === "homework" ? (
                    <DoneBar done={counts[n.id]} total={students} />
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    className="pd-link"
                    onClick={() => {
                      if (!window.confirm(copy.removeConfirm.replace("{title}", n.title))) return;
                      store.remove(n.id).then(
                        () => {
                          setMessage({ ok: true, text: copy.removed });
                          reload();
                        },
                        () => setMessage({ ok: false, text: copy.removeFailed }),
                      );
                    }}
                  >
                    {copy.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function DoneBar({ done, total }: { done: number | undefined; total: number }) {
  if (done === undefined) return <span className="pd-muted">…</span>;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="pd-done">
      <span className="pd-meter" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <small>{copy.doneCount.replace("{n}", String(done)).replace("{total}", String(total))}</small>
    </span>
  );
}

function NoticeForm({ today, onSave }: { today: string; onSave: (n: NewNotice) => Promise<void> }) {
  const [kind, setKind] = useState<NoticeKind>("homework");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState(addDays(today, 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = title.trim().length > 0 && (kind === "notice" || due >= today);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    onSave({ kind, title: title.trim(), body: body.trim(), due: kind === "homework" ? due : null })
      .then(() => {
        setTitle("");
        setBody("");
      })
      .catch(() => setError(copy.postFailed))
      .finally(() => setBusy(false));
  };

  return (
    <form className="pd-card pd-stack" onSubmit={submit}>
      <div className="pd-toggle" role="group" aria-label={copy.kindLabel}>
        {(["homework", "notice"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "homework" ? copy.kindHomework : copy.kindNotice}
          </button>
        ))}
      </div>
      <label className="pd-field">
        {kind === "homework" ? copy.homeworkTitle : copy.noticeTitle}
        <input
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "homework" ? copy.homeworkPlaceholder : copy.noticePlaceholder}
          required
        />
      </label>
      <label className="pd-field">
        {copy.bodyLabel}
        <textarea value={body} maxLength={600} rows={2} onChange={(e) => setBody(e.target.value)} />
      </label>
      {kind === "homework" && (
        <label className="pd-field">
          {copy.dueLabel}
          <input type="date" value={due} min={today} max={addDays(today, 60)} onChange={(e) => setDue(e.target.value)} required />
        </label>
      )}
      {error && (
        <p className="pd-alert" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="pd-save" disabled={!valid || busy}>
        {busy ? copy.posting : copy.post}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------
// Families: what's due, with a Done tick, and recent notices. On the parent's Home screen.

/** Homework not done (or done in the last week) and notices from the last two weeks, most urgent first. */
export function currentFor(items: FamilyNotice[], today: string): FamilyNotice[] {
  const since = Date.parse(`${addDays(today, -14)}T00:00:00Z`);
  const keep = items.filter((n) =>
    n.kind === "homework" ? (!n.done && (n.due ?? today) >= addDays(today, -7)) || n.createdAt >= since : n.createdAt >= since,
  );
  const rank = (n: FamilyNotice) => (n.kind === "homework" ? (n.done ? 2 : 0) : 1);
  return keep
    .sort((a, b) => rank(a) - rank(b) || (a.due ?? "").localeCompare(b.due ?? "") || b.createdAt - a.createdAt)
    .slice(0, 6);
}

export function FamilyNotices({ store, today }: { store: FamilyNoticeStore; today: string }) {
  const [items, setItems] = useState<FamilyNotice[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    // Sorted once on load, so an item doesn't jump away from the finger that ticked it.
    store.list().then(
      (list) => live && setItems(currentFor(list, today)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [store, today]);

  const toggle = (n: FamilyNotice) => {
    const done = !n.done;
    // Ticks at once; goes back if it couldn't be saved.
    setItems((all) => all?.map((x) => (x.id === n.id ? { ...x, done } : x)) ?? null);
    if (done) navigator.vibrate?.(12);
    store.setDone(n.id, done).catch(() =>
      setItems((all) => all?.map((x) => (x.id === n.id ? { ...x, done: !done } : x)) ?? null),
    );
  };

  const shown = items ?? [];
  const pending = shown.filter((n) => n.kind === "homework" && !n.done).length;
  return (
    <section className="pd-section" aria-labelledby="pd-fn-title">
      <h2 id="pd-fn-title">
        {copy.parentTitle}
        {pending > 0 && <span className="pd-count">{pending}</span>}
      </h2>
      {failed && <p className="pd-alert">{copy.loadFailed}</p>}
      {!items && !failed && <p className="pd-muted">Loading…</p>}
      {items && !shown.length && <p className="pd-empty">{copy.parentEmpty}</p>}
      {shown.length > 0 && (
        <ul className="pd-list pd-notices">
          {shown.map((n) => (
            <li key={n.id} className="pd-item pd-notice" data-kind={n.kind} data-done={n.done || undefined}>
              <div className="pd-item-head">
                <span className="pd-notice-kind">
                  {n.kind === "homework" ? copy.kindHomework : copy.kindNotice}
                  {n.subject && ` · ${n.subject}`}
                </span>
                {n.kind === "homework" && n.due && (
                  <small className={!n.done && n.due <= today ? "pd-notice-due is-soon" : "pd-notice-due"}>
                    {dueLabel(n.due, today)}
                  </small>
                )}
              </div>
              <strong>{n.title}</strong>
              {n.body && <p className="pd-notice-body">{n.body}</p>}
              <div className="pd-notice-foot">
                <small className="pd-muted">{n.teacherName}</small>
                {n.kind === "homework" && (
                  <button
                    type="button"
                    className="pd-tick"
                    aria-pressed={n.done}
                    onClick={() => toggle(n)}
                  >
                    <span aria-hidden="true">{n.done ? "✓" : ""}</span>
                    {n.done ? copy.doneLabel : copy.markDone}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Practice mode and the parent preview: everything works on a list in memory. Nothing is saved or sent.

export function sampleNotices(today: string, now = Date.now()): Notice[] {
  const base = { batchId: "sample", batchName: "Class 7 Maths", subject: "Maths", teacherName: "Priya Ma'am" };
  return [
    { ...base, id: "sn1", kind: "homework", title: "Exercise 5.2, questions 1 to 10", body: "Show your working. Bring the notebook on Monday.", due: addDays(today, 1), createdAt: now - 3_600_000 },
    { ...base, id: "sn2", kind: "notice", title: "Unit test on Friday", body: "Chapters 4 and 5. 30 minutes, 25 marks.", due: null, createdAt: now - DAY },
    { ...base, id: "sn3", kind: "homework", title: "Learn the fraction rules", body: "", due: addDays(today, -1), createdAt: now - 3 * DAY },
  ];
}

export function practiceNoticeStore(today: string): NoticeStore {
  let list = sampleNotices(today);
  let n = 0;
  return {
    list: async () => [...list].sort((a, b) => b.createdAt - a.createdAt),
    add: async (input) => {
      list.push({ ...list[0]!, ...input, id: `practice-${++n}`, createdAt: Date.now() });
    },
    remove: async (id) => {
      list = list.filter((x) => x.id !== id);
    },
    doneCount: async (id) => (id === "sn3" ? 4 : id === "sn1" ? 2 : 0),
  };
}

export function previewFamilyStore(today: string): FamilyNoticeStore {
  let list: FamilyNotice[] = sampleNotices(today).map((x) => ({ ...x, done: x.id === "sn3" }));
  return {
    list: async () => list,
    setDone: async (id, done) => {
      list = list.map((x) => (x.id === id ? { ...x, done } : x));
    },
  };
}
