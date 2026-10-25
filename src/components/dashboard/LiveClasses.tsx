import { useCallback, useEffect, useState } from "react";

import { DASHBOARD_CONFIG } from "@/config/dashboardConfig";
import type { ClassChange, LiveClass, NewClasses, SaveResult } from "@/lib/firebase/classes";
import { istParts, joinState, statusLine, weeklyStarts, whenLabel, istIso } from "@/lib/classes/time";

const copy = DASHBOARD_CONFIG.classes;

/** Re-renders every 30 seconds, so countdowns and the Join button stay current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useList(load: () => Promise<LiveClass[]>) {
  const [list, setList] = useState<LiveClass[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(() => {
    setFailed(false);
    load().then(setList, () => setFailed(true));
  }, [load]);
  useEffect(reload, [reload]);
  return { list, failed, reload };
}

// ---------------------------------------------------------------------------------------------------
// Parents: the next class with its Join button, then what's coming up.

export function ParentClasses({
  load,
  onJoin,
  compact = false,
}: {
  load: () => Promise<LiveClass[]>;
  /** Records the tap; the class opens either way. Left out in the preview. */
  onJoin?: ((c: LiveClass) => void) | undefined;
  /** The home screen: only the next class, under "Next class". */
  compact?: boolean;
}) {
  const now = useNow();
  const { list, failed } = useList(load);
  if (failed) return <p className="pd-alert">{copy.loadFailed}</p>;
  if (!list) return <p className="pd-muted">{copy.loading}</p>;
  const current = list.filter((c) => joinState(c, now) !== "ended");
  const next = current.find((c) => c.status === "scheduled");
  const later = compact ? [] : current.filter((c) => c !== next).slice(0, 4);

  return (
    <section className="pd-section pd-lc" aria-labelledby="pd-lc-title">
      <h2 id="pd-lc-title">{compact ? copy.nextTitle : copy.parentTitle}</h2>
      {next ? (
        <article className="pd-lc-next" data-state={joinState(next, now)}>
          <p className="pd-lc-when">{statusLine(next, now)}</p>
          <h3>
            {next.subject || next.batchName}
            {next.teacherName && <span> with {next.teacherName}</span>}
          </h3>
          {next.topic && <p className="pd-lc-topic">{next.topic}</p>}
          {joinState(next, now) === "open" ? (
            <a
              className="pd-cta pd-lc-join"
              href={next.joinUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onJoin?.(next)}
            >
              {copy.join}
            </a>
          ) : (
            <p className="pd-lc-wait">
              {whenLabel(next.startAt, now)}. {copy.joinOpens}
            </p>
          )}
        </article>
      ) : (
        <p className="pd-muted">{copy.noneParent}</p>
      )}
      {later.length > 0 && (
        <ul className="pd-list pd-lc-list">
          {later.map((c) => (
            <li key={c.id} className="pd-item" data-cancelled={c.status === "cancelled" || undefined}>
              <span>
                <strong>{c.subject || c.batchName}</strong> {whenLabel(c.startAt, now)}
              </span>
              <span className="pd-muted">{c.status === "cancelled" ? copy.cancelled : c.teacherName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Teachers: schedule (once or weekly), start now, move, cancel, change the link.

export type ClassStore = {
  list(): Promise<LiveClass[]>;
  lastLink(): Promise<string>;
  schedule(input: Omit<NewClasses, "batchId">): Promise<SaveResult>;
  change(input: ClassChange): Promise<SaveResult>;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LENGTHS = [30, 45, 60, 75, 90, 120];
const errorText = (e: unknown) =>
  (e as { message?: string }).message?.replace(/^.*?:\s*/, "") || copy.saveFailed;

type Panel = { kind: "new"; now?: boolean } | { kind: "move"; c: LiveClass } | { kind: "cancel"; c: LiveClass } | { kind: "link"; c: LiveClass };

export function TeacherClasses({
  store,
  defaultMinutes,
  practice,
}: {
  store: ClassStore;
  defaultMinutes: number;
  practice: boolean;
}) {
  const now = useNow();
  const { list, failed, reload } = useList(store.list);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const done = (text: string, told = true) => {
    setPanel(null);
    setMessage(practice ? `${text} ${copy.practiceSaved}` : told ? `${text} ${copy.told}` : text);
    reload();
  };
  const upcoming = (list ?? []).filter((c) => joinState(c, now) !== "ended");

  return (
    <div className="pd-lc">
      <p className="pd-hint">{copy.teacherHint}</p>
      <div className="pd-lc-actions">
        <button type="button" className="pd-cta pd-lc-btn" onClick={() => setPanel({ kind: "new" })}>
          {copy.schedule}
        </button>
        <button type="button" className="pd-ghost" onClick={() => setPanel({ kind: "new", now: true })}>
          {copy.startNow}
        </button>
      </div>
      {message && (
        <p className="pd-toast" role="status">
          {message}
        </p>
      )}
      {panel?.kind === "new" && (
        <ScheduleForm
          store={store}
          now={now}
          startNow={panel.now === true}
          defaultMinutes={defaultMinutes}
          onCancel={() => setPanel(null)}
          onDone={done}
        />
      )}

      <h2 className="pd-lc-heading">{copy.upcoming}</h2>
      {failed && <p className="pd-alert">{copy.loadFailed}</p>}
      {!list && !failed && <p className="pd-muted">{copy.loading}</p>}
      {list && !upcoming.length && <p className="pd-muted">{copy.noneTeacher}</p>}
      <ul className="pd-list">
        {upcoming.map((c) => {
          const state = joinState(c, now);
          const status = statusLine(c, now);
          const extra = [status === whenLabel(c.startAt, now) ? "" : status, c.topic].filter(Boolean).join(" · ");
          return (
            <li key={c.id} className="pd-lc-item" data-state={state}>
              <div>
                <strong>{whenLabel(c.startAt, now)}</strong>
                <span className="pd-muted">
                  {" "}
                  · {c.durationMinutes} min{c.seriesId ? ` · ${copy.weekly}` : ""}
                </span>
                {extra && <p className="pd-lc-status">{extra}</p>}
              </div>
              {c.status === "scheduled" && (
                <div className="pd-lc-item-actions">
                  <a
                    className={state === "open" ? "pd-lc-start" : "pd-lc-start is-early"}
                    href={c.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {copy.start}
                  </a>
                  <button type="button" className="pd-link" onClick={() => setPanel({ kind: "move", c })}>
                    {copy.move}
                  </button>
                  <button type="button" className="pd-link" onClick={() => setPanel({ kind: "link", c })}>
                    {copy.changeLink}
                  </button>
                  <button type="button" className="pd-link" onClick={() => setPanel({ kind: "cancel", c })}>
                    {copy.cancel}
                  </button>
                </div>
              )}
              {panel && panel.kind !== "new" && panel.c.id === c.id && (
                <ChangePanel panel={panel} store={store} onCancel={() => setPanel(null)} onDone={done} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ClashList({ clashes }: { clashes: NonNullable<SaveResult["clashes"]> }) {
  return (
    <div className="pd-alert" role="alert">
      <strong>{copy.clashTitle}</strong>
      <ul>
        {clashes.map((c, i) => (
          <li key={i}>
            {c.who === "teacher" ? `You have ${c.with}` : `${c.name} has ${c.with}`} on {c.at}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScheduleForm({
  store,
  now,
  startNow,
  defaultMinutes,
  onCancel,
  onDone,
}: {
  store: ClassStore;
  now: number;
  startNow: boolean;
  defaultMinutes: number;
  onCancel: () => void;
  onDone: (text: string, told?: boolean) => void;
}) {
  // Default: the next round hour, or right now for "Start now".
  const start = istParts(startNow ? now : Math.ceil((now + 30 * 60_000) / 3_600_000) * 3_600_000);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [minutes, setMinutes] = useState(LENGTHS.includes(defaultMinutes) ? defaultMinutes : 60);
  const [weekly, setWeekly] = useState(false);
  const [days, setDays] = useState<number[]>([start.weekday]);
  const [weeks, setWeeks] = useState(4);
  const [link, setLink] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<SaveResult["clashes"]>(undefined);

  useEffect(() => {
    store.lastLink().then((l) => setLink((cur) => cur || l), () => undefined);
  }, [store]);

  const starts = startNow
    ? [new Date(now).toISOString()]
    : weekly
      ? weeklyStarts(date, time, days, weeks)
      : [istIso(date, time)];
  const save = async (force: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await store.schedule({ starts, durationMinutes: minutes, joinUrl: link.trim(), topic: topic.trim(), force });
      if (!result.saved) setClashes(result.clashes);
      else onDone(starts.length > 1 ? `${starts.length} ${copy.savedMany}` : copy.savedOne);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  return (
    <form
      className="pd-card pd-stack pd-lc-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void save(false);
      }}
    >
      <h2>{startNow ? copy.startNowTitle : copy.scheduleTitle}</h2>
      {!startNow && (
        <div className="pd-lc-grid">
          <label className="pd-field">
            {copy.date}
            <input type="date" required value={date} min={istParts(now).date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="pd-field">
            {copy.time}
            <input type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
      )}
      <label className="pd-field">
        {copy.length}
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {LENGTHS.map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </select>
      </label>
      {!startNow && (
        <fieldset className="pd-lc-repeat">
          <legend>{copy.repeat}</legend>
          <div className="pd-picker" role="group">
            <button type="button" aria-pressed={!weekly} onClick={() => setWeekly(false)}>
              {copy.once}
            </button>
            <button type="button" aria-pressed={weekly} onClick={() => setWeekly(true)}>
              {copy.everyWeek}
            </button>
          </div>
          {weekly && (
            <>
              <div className="pd-picker" role="group" aria-label={copy.days}>
                {WEEKDAYS.map((name, d) => (
                  <button key={name} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>
                    {name}
                  </button>
                ))}
              </div>
              <label className="pd-field">
                {copy.forWeeks}
                <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                  {[1, 2, 4, 8, 12].map((w) => (
                    <option key={w} value={w}>
                      {w} {w === 1 ? "week" : "weeks"}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pd-muted">
                {starts.length} {starts.length === 1 ? "class" : "classes"}
              </p>
            </>
          )}
        </fieldset>
      )}
      <label className="pd-field">
        {copy.link}
        <input
          type="url"
          required
          inputMode="url"
          placeholder="https://zoom.us/j/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <span className="pd-muted pd-lc-note">{copy.linkNote}</span>
      </label>
      <label className="pd-field">
        {copy.topic}
        <input maxLength={120} placeholder={copy.topicPlaceholder} value={topic} onChange={(e) => setTopic(e.target.value)} />
      </label>
      {clashes && clashes.length > 0 && <ClashList clashes={clashes} />}
      {error && (
        <p className="pd-alert" role="alert">
          {error}
        </p>
      )}
      <div className="pd-lc-actions">
        {clashes && clashes.length > 0 ? (
          <button type="button" className="pd-cta pd-lc-btn" disabled={busy} onClick={() => void save(true)}>
            {copy.scheduleAnyway}
          </button>
        ) : (
          <button type="submit" className="pd-cta pd-lc-btn" disabled={busy || (weekly && !days.length)}>
            {startNow ? copy.startNowSave : copy.save}
          </button>
        )}
        <button type="button" className="pd-ghost" onClick={onCancel}>
          {copy.back}
        </button>
      </div>
      <p className="pd-muted pd-lc-note">{copy.familiesTold}</p>
    </form>
  );
}

function ChangePanel({
  panel,
  store,
  onCancel,
  onDone,
}: {
  panel: Exclude<Panel, { kind: "new" }>;
  store: ClassStore;
  onCancel: () => void;
  onDone: (text: string, told?: boolean) => void;
}) {
  const c = panel.c;
  const start = istParts(c.startAt);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [link, setLink] = useState(c.joinUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<SaveResult["clashes"]>(undefined);
  const run = async (change: ClassChange, text: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await store.change(change);
      if (!result.saved) setClashes(result.clashes);
      else onDone(text, change.action !== "edit");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pd-card pd-stack pd-lc-change">
      {panel.kind === "move" && (
        <>
          <div className="pd-lc-grid">
            <label className="pd-field">
              {copy.date}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="pd-field">
              {copy.time}
              <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          {clashes && clashes.length > 0 && <ClashList clashes={clashes} />}
          <button
            type="button"
            className="pd-cta pd-lc-btn"
            disabled={busy}
            onClick={() =>
              void run(
                { classId: c.id, action: "move", startAt: istIso(date, time), force: Boolean(clashes?.length) },
                copy.moved,
              )
            }
          >
            {clashes?.length ? copy.moveAnyway : copy.moveSave}
          </button>
        </>
      )}
      {panel.kind === "link" && (
        <>
          <label className="pd-field">
            {copy.link}
            <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} />
          </label>
          <button
            type="button"
            className="pd-cta pd-lc-btn"
            disabled={busy}
            onClick={() => void run({ classId: c.id, action: "edit", joinUrl: link.trim(), following: true }, copy.linkSaved)}
          >
            {c.seriesId ? copy.linkSaveSeries : copy.linkSave}
          </button>
        </>
      )}
      {panel.kind === "cancel" && (
        <>
          <p>{copy.cancelAsk}</p>
          <button
            type="button"
            className="pd-cta pd-lc-btn pd-lc-danger"
            disabled={busy}
            onClick={() => void run({ classId: c.id, action: "cancel" }, copy.cancelledOne)}
          >
            {copy.cancelOne}
          </button>
          {c.seriesId && (
            <button
              type="button"
              className="pd-ghost"
              disabled={busy}
              onClick={() => void run({ classId: c.id, action: "cancel", following: true }, copy.cancelledMany)}
            >
              {copy.cancelFollowing}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="pd-alert" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="pd-link" onClick={onCancel}>
        {copy.back}
      </button>
    </div>
  );
}
