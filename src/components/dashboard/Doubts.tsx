import { useCallback, useEffect, useState, type FormEvent } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import type { Doubt } from "@/lib/firebase/doubts";
import { formatDay } from "@/lib/progress/insights";

const copy = DASHBOARD_CONFIG.doubts;
const MIN = 60_000;

/** A batch's doubts, for its teacher. Practice mode uses an in-memory one. */
export type DoubtStore = {
  list(): Promise<Doubt[]>;
  answer(id: string, text: string): Promise<void>;
};

/** One child's doubts, for the family. `batches` are the child's batches, i.e. whom they can ask. */
export type FamilyDoubtStore = {
  batches: { id: string; name: string; subject: string }[];
  list(): Promise<Doubt[]>;
  ask(batchId: string, question: string): Promise<void>;
  withdraw(id: string): Promise<void>;
  practice?: boolean;
};

/** "just now", "12 min ago", "3 h ago", then the day. */
export function ago(at: number, now = Date.now()): string {
  const d = now - at;
  if (d < MIN) return "just now";
  if (d < 60 * MIN) return `${Math.floor(d / MIN)} min ago`;
  if (d < 24 * 60 * MIN) return `${Math.floor(d / (60 * MIN))} h ago`;
  return formatDay(new Date(at + 5.5 * 60 * MIN).toISOString().slice(0, 10));
}

/** Waiting ones first, oldest first (first asked, first answered); then answered ones, newest first. */
export function forTeacher(items: Doubt[]): { waiting: Doubt[]; answered: Doubt[] } {
  return {
    waiting: items.filter((d) => d.status === "open").sort((a, b) => a.createdAt - b.createdAt),
    answered: items
      .filter((d) => d.status === "answered")
      .sort((a, b) => b.answeredAt - a.answeredAt)
      .slice(0, 20),
  };
}

/** Answers the family hasn't seen yet: answered after the last time they opened their doubts. */
export const unseenAnswers = (items: Doubt[], seenAt: number) =>
  items.filter((d) => d.status === "answered" && d.answeredAt > seenAt);

// ---------------------------------------------------------------------------------------------------
// Teachers: what's waiting, one answer box each, and what's been answered.

export function TeacherDoubts({ store, practice }: { store: DoubtStore; practice: boolean }) {
  const [items, setItems] = useState<Doubt[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    store.list().then(setItems, () => setFailed(true));
  }, [store]);
  useEffect(reload, [reload]);

  const { waiting, answered } = forTeacher(items ?? []);
  return (
    <>
      <p className="pd-hint">{copy.teacherHint}</p>
      {message && (
        <p className="pd-toast" role="status">
          {message}
        </p>
      )}
      <section className="pd-section" aria-labelledby="pd-dt-waiting">
        <h2 id="pd-dt-waiting">
          {copy.waitingTitle}
          {waiting.length > 0 && <span className="pd-count">{waiting.length}</span>}
        </h2>
        {failed && <p className="pd-alert">{copy.loadFailed}</p>}
        {!items && !failed && <p className="pd-muted">Loading…</p>}
        {items && !waiting.length && <p className="pd-empty">{copy.teacherEmpty}</p>}
        {waiting.length > 0 && (
          <ul className="pd-list pd-doubts">
            {waiting.map((d) => (
              <li key={d.id} className="pd-item pd-doubt">
                <div className="pd-item-head">
                  <strong>{d.studentName}</strong>
                  <small className="pd-muted">{ago(d.createdAt)}</small>
                </div>
                <p className="pd-doubt-q">{d.question}</p>
                <AnswerForm
                  onSend={async (text) => {
                    await store.answer(d.id, text);
                    navigator.vibrate?.(12);
                    setMessage(practice ? copy.practiceAnswered : copy.answeredToast);
                    reload();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      {answered.length > 0 && (
        <section className="pd-section" aria-labelledby="pd-dt-answered">
          <h2 id="pd-dt-answered">{copy.answeredTitle}</h2>
          <ul className="pd-list pd-doubts">
            {answered.map((d) => (
              <li key={d.id} className="pd-item pd-doubt" data-answered>
                <div className="pd-item-head">
                  <strong>{d.studentName}</strong>
                  <small className="pd-muted">{ago(d.answeredAt || d.createdAt)}</small>
                </div>
                <p className="pd-doubt-q">{d.question}</p>
                <div className="pd-doubt-a">
                  <small>{copy.you}</small>
                  <p>{d.answer}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AnswerForm({ onSend }: { onSend: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const answer = text.trim();
    if (!answer || busy) return;
    setBusy(true);
    setError(false);
    onSend(answer)
      .then(() => setText(""))
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  };
  return (
    <form className="pd-stack pd-doubt-form" onSubmit={submit}>
      <label className="pd-field">
        {copy.answerLabel}
        <textarea
          value={text}
          maxLength={1000}
          rows={3}
          placeholder={copy.answerPlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="pd-chips">
        {copy.quickAnswers.map((q) => (
          <button key={q} type="button" className="pd-chip" onClick={() => setText(q)}>
            {q}
          </button>
        ))}
      </div>
      {error && (
        <p className="pd-alert" role="alert">
          {copy.answerFailed}
        </p>
      )}
      <button type="submit" className="pd-save" disabled={!text.trim() || busy}>
        {busy ? copy.answering : copy.answer}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------
// Families: ask one of the child's teachers, and read the answers.

export function FamilyDoubts({ store }: { store: FamilyDoubtStore }) {
  const [items, setItems] = useState<Doubt[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(() => {
    setFailed(false);
    store.list().then(setItems, () => setFailed(true));
  }, [store]);
  useEffect(reload, [reload]);

  return (
    <>
      <section className="pd-section" aria-labelledby="pd-fd-ask">
        <h2 id="pd-fd-ask">{copy.askTitle}</h2>
        {store.batches.length ? (
          <AskForm
            batches={store.batches}
            onAsk={async (batchId, question) => {
              await store.ask(batchId, question);
              navigator.vibrate?.(12);
              setMessage({ ok: true, text: store.practice ? copy.practiceSent : copy.sent });
              reload();
            }}
          />
        ) : (
          <p className="pd-empty">{copy.noBatch}</p>
        )}
        {message && (
          <p className={message.ok ? "pd-toast" : "pd-alert"} role="status" style={{ marginTop: 12 }}>
            {message.text}
          </p>
        )}
      </section>

      <section className="pd-section" aria-labelledby="pd-fd-list">
        <h2 id="pd-fd-list">{copy.listTitle}</h2>
        {failed && <p className="pd-alert">{copy.loadFailed}</p>}
        {!items && !failed && <p className="pd-muted">Loading…</p>}
        {items && !items.length && <p className="pd-empty">{copy.empty}</p>}
        {items && items.length > 0 && (
          <ul className="pd-list pd-doubts">
            {items.map((d) => (
              <li key={d.id} className="pd-item pd-doubt" data-answered={d.status === "answered" || undefined}>
                <div className="pd-item-head">
                  <span className="pd-notice-kind">{d.subject || d.batchName || copy.waiting}</span>
                  <span className="pd-doubt-status" data-status={d.status}>
                    {d.status === "answered" ? copy.answered : copy.waiting}
                  </span>
                </div>
                <p className="pd-doubt-q">{d.question}</p>
                {d.status === "answered" ? (
                  <div className="pd-doubt-a">
                    <small>
                      {d.teacherName || "Teacher"} · {ago(d.answeredAt)}
                    </small>
                    <p>{d.answer}</p>
                  </div>
                ) : (
                  <div className="pd-notice-foot">
                    <small className="pd-muted">{ago(d.createdAt)}</small>
                    <button
                      type="button"
                      className="pd-link"
                      onClick={() => {
                        if (!window.confirm(copy.withdrawConfirm)) return;
                        store.withdraw(d.id).then(reload, () =>
                          setMessage({ ok: false, text: copy.withdrawFailed }),
                        );
                      }}
                    >
                      {copy.withdraw}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function AskForm({
  batches,
  onAsk,
}: {
  batches: FamilyDoubtStore["batches"];
  onAsk: (batchId: string, question: string) => Promise<void>;
}) {
  const [batchId, setBatchId] = useState(batches[0]!.id);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(false);
    onAsk(batchId, q)
      .then(() => setQuestion(""))
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  };
  return (
    <form className="pd-card pd-stack" onSubmit={submit}>
      <p className="pd-hint" style={{ margin: 0 }}>
        {copy.askHint}
      </p>
      {batches.length > 1 && (
        <div className="pd-toggle pd-toggle-wrap" role="group" aria-label={copy.teacherLabel}>
          {batches.map((b) => (
            <button key={b.id} type="button" aria-pressed={batchId === b.id} onClick={() => setBatchId(b.id)}>
              {b.subject || b.name}
            </button>
          ))}
        </div>
      )}
      <label className="pd-field">
        {copy.questionLabel}
        <textarea
          value={question}
          maxLength={600}
          rows={3}
          placeholder={copy.questionPlaceholder}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
      </label>
      {error && (
        <p className="pd-alert" role="alert">
          {copy.sendFailed}
        </p>
      )}
      <button type="submit" className="pd-save" disabled={!question.trim() || busy}>
        {busy ? copy.sending : copy.send}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------
// Practice mode and the parent preview: everything works on a list in memory. Nothing is saved or sent.

export function sampleDoubts(now = Date.now()): Doubt[] {
  const base = {
    batchId: "sample",
    batchName: "Class 7 Maths",
    subject: "Maths",
    teacherName: "Priya Ma'am",
    answer: "",
    answeredAt: 0,
  };
  return [
    { ...base, id: "sd1", studentId: "s1", studentName: "Aarav", status: "open", question: "In Exercise 5.2, question 4, why do we flip the second fraction when we divide?", createdAt: now - 40 * MIN },
    { ...base, id: "sd2", studentId: "s2", studentName: "Diya", status: "open", question: "Is 1 a prime number?", createdAt: now - 3 * 60 * MIN },
    { ...base, id: "sd3", studentId: "s1", studentName: "Aarav", status: "answered", question: "What is the difference between a factor and a multiple?", answer: "Factors of 12 divide it exactly (1, 2, 3, 4, 6, 12). Multiples of 12 are what you get when you multiply it (12, 24, 36…).", createdAt: now - 26 * 60 * MIN, answeredAt: now - 20 * 60 * MIN },
  ];
}

export function practiceDoubtStore(): DoubtStore {
  let list = sampleDoubts();
  return {
    list: async () => list,
    answer: async (id, text) => {
      list = list.map((d) => (d.id === id ? { ...d, status: "answered", answer: text, answeredAt: Date.now() } : d));
    },
  };
}

export function previewFamilyDoubts(): FamilyDoubtStore {
  let list = sampleDoubts().filter((d) => d.studentId === "s1");
  let n = 0;
  const batches = [
    { id: "sample", name: "Class 7 Maths", subject: "Maths" },
    { id: "sample-sci", name: "Class 7 Science", subject: "Science" },
  ];
  return {
    batches,
    practice: true,
    list: async () => [...list].sort((a, b) => b.createdAt - a.createdAt),
    ask: async (batchId, question) => {
      const b = batches.find((x) => x.id === batchId) ?? batches[0]!;
      list.push({ ...list[0]!, id: `preview-${++n}`, batchId, batchName: b.name, subject: b.subject, status: "open", question, answer: "", answeredAt: 0, createdAt: Date.now() });
    },
    withdraw: async (id) => {
      list = list.filter((d) => d.id !== id);
    },
  };
}
