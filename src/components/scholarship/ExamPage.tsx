import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "@/brand/Logo";
import { SCHOLARSHIP_EXAM as X } from "@/lib/scholarship";
import { EXAM_ENDPOINT, post, storedPaper, unlockPaper } from "@/lib/scholarship";

const E = X.exam;
const P = X.practice;
const display = "font-[family-name:var(--font-display)]";
type Subject = keyof typeof E.sections;
type Question = { subject: Subject; text: string; options: string[] };
type Paper = {
  token: string; rollNo: string; name: string; studentClass: string; questions: Question[]; questionsAt: number; endsAt: number; offset: number;
  /** Only on the practice paper: the answers, so it is marked on the phone and nothing goes to the server. */
  answerKey?: number[];
};
type Saved = { answers: Record<string, number>; marked: number[]; visited: number[]; strikes: number };
type Phase =
  | { kind: "login"; error?: string; waitUntil?: number }
  | { kind: "exam"; paper: Paper }
  | { kind: "done"; status: string }
  | { kind: "practiceDone"; paper: Paper; answers: Record<string, number> };
const MAX_STRIKES = 3;
const backupKey = (roll: string) => `stoodant-exam-${roll}`;
const readBackup = (roll: string): Saved | null => {
  try { return JSON.parse(localStorage.getItem(backupKey(roll)) ?? "null") as Saved | null; } catch { return null; }
};
const writeBackup = (roll: string, value: Saved) => { try { localStorage.setItem(backupKey(roll), JSON.stringify(value)); } catch { /* private mode */ } };

/** /exam: log in with roll number + date of birth inside the booked hour, then the test (NTA style). */
export function ExamPage() {
  return <><title>Scholarship test | Stoodant</title><meta name="robots" content="noindex" /><Exams /></>;
}

function Exams() {
  const [phase, setPhase] = useState<Phase>({ kind: "login" });
  // /exam?practice=9 or 10: the practice paper, which needs no login and never talks to the server.
  const [practiceClass, setPracticeClass] = useState<"9" | "10" | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("practice");
    if (c === "9" || c === "10") setPracticeClass(c);
  }, []);
  const startPractice = useCallback(async (cls: "9" | "10") => {
    const { PRACTICE, PRACTICE_MINUTES } = await import("@/content/scholarshipPractice");
    const now = Date.now();
    const opens = now + X.readingMinutes * 60_000;
    setPhase({
      kind: "exam",
      paper: {
        token: "", rollNo: `practice-${cls}`, name: P.title, studentClass: cls, offset: 0,
        questions: PRACTICE[cls].map(({ subject, text, options }) => ({ subject, text, options })),
        answerKey: PRACTICE[cls].map((q) => q.answer),
        questionsAt: opens, endsAt: opens + PRACTICE_MINUTES * 60_000,
      },
    });
  }, []);
  useEffect(() => { if (practiceClass) void startPractice(practiceClass); }, [practiceClass, startPractice]);

  if (phase.kind === "exam") {
    const paper = phase.paper;
    return <Exam key={paper.questionsAt} paper={paper} finish={(status, answers) =>
      setPhase(paper.answerKey ? { kind: "practiceDone", paper, answers: answers ?? {} } : { kind: "done", status })} />;
  }
  if (phase.kind === "practiceDone") return <PracticeDone paper={phase.paper} answers={phase.answers} again={() => void startPractice(phase.paper.studentClass as "9" | "10")} />;
  if (phase.kind === "done") return <Done status={phase.status} />;
  if (practiceClass) return <Shell><p className="text-neutral-600">…</p></Shell>;
  return <Login error={phase.error} waitUntil={phase.waitUntil} onPhase={setPhase} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-[#0a1026]">
      <header className="bg-[#0a1026] px-4 py-3 text-white"><div className="mx-auto flex max-w-xl items-center gap-3"><span className="logo w-32"><Logo /></span></div></header>
      <main className="mx-auto max-w-xl px-4 py-8">{children}</main>
    </div>
  );
}

function Login({ error, waitUntil, onPhase }: { error?: string | undefined; waitUntil?: number | undefined; onPhase: (p: Phase) => void }) {
  const [roll, setRoll] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRoll(new URLSearchParams(location.search).get("roll")?.replace(/\D/g, "").slice(0, 9) ?? ""); }, []);

  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(/^\d{9}$/.test(roll) && storedPaper(roll) !== null); }, [roll]);

  const start = useCallback(async (rollNo: string, pass: string, fresh = false) => {
    setBusy(true);
    // Downloaded ahead on the scholarship page: ask only for the key that opens it.
    const onPhone = fresh ? null : storedPaper(rollNo);
    const answer = await post(EXAM_ENDPOINT, JSON.stringify({ action: "start", rollNo, password: pass, ...(onPhone ? { have: onPhone.version } : {}) }));
    if (!answer) { setBusy(false); return onPhase({ kind: "login", error: E.errors.network }); }
    const d = answer.data;
    if (answer.status === 200) {
      let questions = d["questions"] as Question[] | undefined;
      if (!questions && onPhone && typeof d["key"] === "string") questions = (await unlockPaper<Question[]>(onPhone, d["key"])) ?? undefined;
      // The copy on this phone couldn't be opened: fetch the paper itself.
      if (!questions) return start(rollNo, pass, true);
      setBusy(false);
      const student = d["student"] as { name: string; studentClass: string };
      return onPhase({
        kind: "exam",
        paper: {
          token: d["token"] as string, rollNo, name: student.name, studentClass: student.studentClass,
          questions, questionsAt: (d["questionsAt"] as number | undefined) ?? 0, endsAt: d["endsAt"] as number, offset: (d["serverNow"] as number) - Date.now(),
          ...mergeState(rollNo, d["state"] as Saved),
        } as Paper,
      });
    }
    setBusy(false);
    const code = String(d["error"] ?? "network");
    if (code === "finished") return onPhase({ kind: "done", status: String(d["status"] ?? "submitted") });
    if (code === "too_early") {
      const startsAt = d["startsAt"] as number;
      const time = new Date(startsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
      return onPhase({ kind: "login", error: E.errors.too_early.replace("{time}", time), waitUntil: startsAt - ((d["serverNow"] as number) - Date.now()) });
    }
    onPhase({ kind: "login", error: (E.errors as Record<string, string>)[code] ?? E.errors.network });
  }, [onPhase]);

  // Too early: try again by itself when the hour starts.
  useEffect(() => {
    if (!waitUntil) return;
    const t = setTimeout(() => void start(roll, password), Math.max(1000, waitUntil - Date.now() + 1500));
    return () => clearTimeout(t);
  }, [waitUntil, roll, password, start]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{9}$/.test(roll) || !/^\d{8}$/.test(password)) return;
    void start(roll, password);
  };
  const input = "mt-1 block min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-lg tracking-wider outline-none focus:border-[#0a1026] focus:ring-2 focus:ring-[#fbb308]";
  return (
    <Shell>
      <h1 className={`${display} text-2xl font-extrabold`}>{E.title}</h1>
      <form className="mt-6 space-y-4 rounded-3xl bg-white p-5 shadow-sm" onSubmit={submit} noValidate>
        <label className="block"><span className="text-sm font-semibold">{E.rollLabel}</span>
          <input value={roll} onChange={(e) => setRoll(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" autoComplete="off" className={input} /></label>
        <label className="block"><span className="text-sm font-semibold">{E.passwordLabel}</span>
          <input value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" type="password" autoComplete="off" className={input} />
          <small className="mt-1 block text-sm text-neutral-600">{E.passwordHint}</small></label>
        {ready && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">✓ {E.paperOnPhone}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <button type="submit" disabled={busy || roll.length !== 9 || password.length !== 8}
          className="min-h-12 w-full rounded-full bg-[#fbb308] px-5 text-lg font-extrabold disabled:opacity-50">{busy ? E.starting : E.start}</button>
      </form>
    </Shell>
  );
}

/** What the server saved plus what this phone kept (newer, if the last save didn't get through). */
function mergeState(roll: string, server: Saved): Saved {
  const local = readBackup(roll);
  if (!local) return server;
  return {
    answers: { ...server.answers, ...local.answers },
    marked: [...new Set([...server.marked, ...local.marked])],
    visited: [...new Set([...server.visited, ...local.visited])],
    strikes: Math.max(server.strikes, local.strikes),
  };
}

function Exam({ paper, finish }: { paper: Paper & Partial<Saved>; finish: (status: string, answers?: Record<string, number>) => void }) {
  const practice = paper.answerKey !== undefined;
  const qs = paper.questions;
  const sections = useMemo(() => (Object.keys(E.sections) as Subject[]).filter((s) => qs.some((q) => q.subject === s)), [qs]);
  const [answers, setAnswers] = useState<Record<string, number>>(paper.answers ?? {});
  const [marked, setMarked] = useState<Set<number>>(new Set(paper.marked ?? []));
  const [visited, setVisited] = useState<Set<number>>(new Set([...(paper.visited ?? []), 0]));
  const [strikes, setStrikes] = useState(paper.strikes ?? 0);
  const [current, setCurrent] = useState(0);
  const [choice, setChoice] = useState<number | undefined>(paper.answers?.["0"]);
  const [warning, setWarning] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [now, setNow] = useState(() => Date.now() + paper.offset);
  const state = useRef<Saved>({ answers, marked: [...marked], visited: [...visited], strikes });
  state.current = { answers, marked: [...marked], visited: [...visited], strikes };
  const dirty = useRef(false);
  const ended = useRef(false);
  const camera = useCamera(paper, !practice);
  // The practice paper can skip the reading time; its minutes then start at once.
  const [opensAt, setOpensAt] = useState(paper.questionsAt);
  const endsAt = practice ? opensAt + (paper.endsAt - paper.questionsAt) : paper.endsAt;

  const send = useCallback(async (submit: boolean) => {
    const s = state.current;
    if (practice) {
      if (!submit) return "started";
      ended.current = true;
      finish("practice", s.answers);
      return "practice";
    }
    writeBackup(paper.rollNo, s);
    setSaveState("saving");
    const answer = await post(EXAM_ENDPOINT, JSON.stringify({ action: "save", rollNo: paper.rollNo, token: paper.token, ...s, submit }));
    if (!answer) { setSaveState("offline"); return null; }
    dirty.current = false;
    setSaveState("saved");
    const status = String(answer.data["status"] ?? answer.data["error"] ?? "");
    if (status && status !== "started") {
      ended.current = true;
      finish(answer.data["error"] === "finished" ? String(answer.data["status"] ?? "submitted") : status);
    }
    return status;
  }, [paper.rollNo, paper.token, finish, practice]);

  // Clock, autosave every 30 seconds, and the end of time.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + paper.offset), 1000);
    const autosave = setInterval(() => { if (dirty.current && !ended.current) void send(false); }, 30_000);
    return () => { clearInterval(tick); clearInterval(autosave); };
  }, [paper.offset, send]);
  const left = Math.max(0, endsAt - now);
  useEffect(() => {
    if (left > 0 || ended.current) return;
    ended.current = true;
    void send(true).then((status) => { if (!status) finish("timeout"); });
  }, [left, send, finish]);

  // Leaving the page: warnings, the third ends the test.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState !== "hidden" || ended.current) return;
      setStrikes((n) => {
        const next = Math.min(MAX_STRIKES, n + 1);
        state.current = { ...state.current, strikes: next };
        dirty.current = true;
        setWarning(next);
        void send(next >= MAX_STRIKES);
        return next;
      });
    };
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, [send]);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(qs.length - 1, i));
    setCurrent(next);
    setChoice(answers[String(next)]);
    setVisited((v) => new Set(v).add(next));
    setShowPalette(false);
    dirty.current = true;
  };
  const record = (mark: boolean) => {
    const key = String(current);
    const nextAnswers = { ...answers };
    if (choice === undefined) delete nextAnswers[key]; else nextAnswers[key] = choice;
    setAnswers(nextAnswers);
    setMarked((m) => { const n = new Set(m); if (mark) n.add(current); else n.delete(current); return n; });
    dirty.current = true;
    if (!practice) writeBackup(paper.rollNo, { ...state.current, answers: nextAnswers });
    if (current === qs.length - 1) setConfirming(true); else go(current + 1);
  };
  const clear = () => {
    setChoice(undefined);
    setAnswers((a) => { const n = { ...a }; delete n[String(current)]; return n; });
    dirty.current = true;
  };

  const q = qs[current]!;
  const section = q.subject;
  const inSection = qs.map((x, i) => [x, i] as const).filter(([x]) => x.subject === section);
  const status = (i: number) => {
    const answered = answers[String(i)] !== undefined;
    if (marked.has(i)) return answered ? "answeredMarked" : "marked";
    if (answered) return "answered";
    return visited.has(i) ? "notAnswered" : "notVisited";
  };
  const counts = qs.reduce<Record<string, number>>((c, _, i) => { c[status(i)] = (c[status(i)] ?? 0) + 1; return c; }, {});
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  // The first 2 minutes: the rules, with the time until the questions open. The 60 minutes start after this.
  if (now < opensAt) {
    return <Rules opensAt={opensAt} now={now} camera={camera} warning={warning} closeWarning={() => setWarning(null)}
      startNow={practice ? () => { const t = Date.now() + paper.offset; setOpensAt(t); setNow(t); } : undefined} />;
  }

  return (
    <div className="flex min-h-screen select-none flex-col bg-neutral-50 text-[#0a1026]" onContextMenu={(e) => e.preventDefault()}>
      <header className="sticky top-0 z-20 bg-[#0a1026] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0 text-sm leading-5"><p className="truncate font-bold">{paper.name}</p><p className="text-[#c9cee0]">{practice ? `${P.badge} · Class ${paper.studentClass}` : `${E.rollLabel}: ${paper.rollNo} · Class ${paper.studentClass}`}</p></div>
          {camera.view("h-12 w-10 ml-auto")}
          <div className="text-right" aria-live="off">
            <p className="text-xs text-[#c9cee0]">{E.timeLeft}</p>
            <p className={`${display} text-xl font-extrabold tabular-nums ${left < 5 * 60000 ? "text-red-400" : "text-[#fbb308]"}`}>{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</p>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2" aria-label="Sections">
          {sections.map((s) => (
            <button key={s} type="button" aria-pressed={s === section} onClick={() => go(qs.findIndex((x) => x.subject === s))}
              className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold aria-pressed:bg-[#fbb308] aria-pressed:text-[#0a1026]">{E.sections[s]}</button>
          ))}
        </nav>
      </header>
      {saveState === "offline" && <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">{E.offline}</p>}

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-4 lg:grid-cols-[1fr_300px]">
        <main className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm font-bold text-neutral-500">
            <span>{E.sections[section]} · {E.question.replace("{n}", String(inSection.findIndex(([, i]) => i === current) + 1))}</span>
            <button type="button" className="rounded-lg border border-neutral-300 px-3 py-1 lg:hidden" onClick={() => setShowPalette(true)}>{E.palette}</button>
          </div>
          <p className="mt-4 text-lg leading-8"><Rich text={q.text} /></p>
          <div className="mt-5 space-y-3" role="radiogroup">
            {q.options.map((option, i) => (
              <label key={i} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 ${choice === i ? "border-[#0a1026] bg-[#0a1026]/5" : "border-neutral-300"}`}>
                <input type="radio" name={`q${current}`} checked={choice === i} onChange={() => setChoice(i)} className="h-5 w-5 accent-[#0a1026]" />
                <span className="font-bold">{"ABCD"[i]}.</span><span className="leading-6"><Rich text={option} /></span>
              </label>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => record(false)} className="min-h-12 rounded-xl bg-green-600 px-4 font-bold text-white">{E.saveNext}</button>
            <button type="button" onClick={() => record(true)} className="min-h-12 rounded-xl bg-violet-700 px-4 font-bold text-white">{E.markNext}</button>
            <button type="button" onClick={clear} className="min-h-12 rounded-xl border border-neutral-300 px-4 font-bold">{E.clear}</button>
            <button type="button" onClick={() => go(current - 1)} disabled={current === 0} className="min-h-12 rounded-xl border border-neutral-300 px-4 font-bold disabled:opacity-40">{E.back}</button>
          </div>
          <p className="mt-4 text-xs text-neutral-500">{saveState === "saving" ? E.saving : E.savedAt}</p>
        </main>

        <aside className={`${showPalette ? "fixed inset-0 z-30 overflow-auto bg-white p-4" : "hidden"} lg:static lg:block lg:rounded-2xl lg:bg-white lg:p-4 lg:shadow-sm`}>
          <div className="flex items-center justify-between"><p className="font-bold">{E.palette}</p>
            <button type="button" className="rounded-lg border px-3 py-1 lg:hidden" onClick={() => setShowPalette(false)}>✕</button></div>
          <Legend counts={counts} />
          {sections.map((s) => (
            <div key={s} className="mt-4">
              <p className="text-sm font-bold">{E.sections[s]}</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {qs.map((x, i) => x.subject !== s ? null : (
                  <button key={i} type="button" onClick={() => go(i)} aria-current={i === current}
                    className={`relative h-10 rounded-lg text-sm font-bold aria-[current=true]:ring-2 aria-[current=true]:ring-[#fbb308] ${TONE[status(i)]}`}>
                    {qs.slice(0, i + 1).filter((y) => y.subject === s).length}
                    {status(i) === "answeredMarked" && <span className="absolute right-1 bottom-1 h-2 w-2 rounded-full bg-green-400" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setConfirming(true)} className="mt-6 min-h-12 w-full rounded-xl bg-[#0a1026] font-extrabold text-white">{E.submit}</button>
        </aside>
      </div>

      {confirming && (
        <Modal>
          <h2 className={`${display} text-xl font-bold`}>{E.confirmHeading}</h2>
          <Legend counts={counts} />
          <p className="mt-3 text-sm text-neutral-600">{E.confirmLead}</p>
          <div className="mt-5 flex gap-2">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-[#0a1026] font-bold text-white" onClick={() => { setConfirming(false); ended.current = true; void send(true).then((s) => { if (!s) ended.current = false; }); }}>{E.confirmYes}</button>
            <button type="button" className="min-h-12 flex-1 rounded-xl border border-neutral-300 font-bold" onClick={() => setConfirming(false)}>{E.confirmNo}</button>
          </div>
        </Modal>
      )}
      {warning !== null && warning < MAX_STRIKES && (
        <Modal>
          <p className={`rounded-xl p-4 font-bold ${warning === 1 ? "bg-yellow-100 text-yellow-900" : "bg-orange-100 text-orange-900"}`}>{E.strike[warning - 1]}</p>
          <button type="button" className="mt-4 min-h-12 w-full rounded-xl bg-[#0a1026] font-bold text-white" onClick={() => setWarning(null)}>{E.strikeOk}</button>
        </Modal>
      )}
    </div>
  );
}

type Camera = { state: "asking" | "on" | "off"; ask: () => void; view: (className: string) => ReactNode };

/**
 * The front camera: asked for on the rules page, shown as a small preview, and used for a few photos at random
 * moments while the questions are open. Each photo is a small JPEG sent to the server and kept privately for the team.
 * If the camera is refused, the server notes it so the team checks that paper more closely.
 */
function useCamera(paper: Paper, enabled: boolean): Camera {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  // The preview moves from the rules page to the test page: each new element gets the same stream.
  const setVideo = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    if (el && stream.current) el.srcObject = stream.current;
  }, []);
  const [state, setState] = useState<Camera["state"]>("asking");
  const report = useCallback((body: Record<string, unknown>) =>
    post(EXAM_ENDPOINT, JSON.stringify({ action: "photo", rollNo: paper.rollNo, token: paper.token, ...body })), [paper.rollNo, paper.token]);

  const ask = useCallback(async () => {
    setState("asking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = s;
      if (video.current) video.current.srcObject = s;
      setState("on");
    } catch {
      setState("off");
      void report({ cameraOff: true });
    }
  }, [report]);
  useEffect(() => {
    if (!enabled) return;
    void ask();
    return () => stream.current?.getTracks().forEach((t) => t.stop());
  }, [ask, enabled]);

  // Six moments spread at random over the hour (plus one soon after the questions open), fixed per paper.
  useEffect(() => {
    if (!enabled) return;
    const span = Math.max(0, paper.endsAt - paper.questionsAt - 2 * 60_000);
    const times = [20_000, ...Array.from({ length: 6 }, () => 60_000 + Math.random() * span)].map((t) => paper.questionsAt + t - paper.offset);
    const timers = times.filter((t) => t > Date.now()).map((t) => setTimeout(() => {
      const v = video.current;
      if (!v || !stream.current || v.videoWidth === 0) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 320 / v.videoWidth);
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.6);
      void report({ image: data.slice(data.indexOf(",") + 1) });
    }, t - Date.now()));
    return () => timers.forEach(clearTimeout);
  }, [paper.endsAt, paper.questionsAt, paper.offset, report, enabled]);

  const view = (className: string) => (
    <video ref={setVideo} autoPlay muted playsInline aria-hidden="true"
      className={`shrink-0 rounded-lg bg-black object-cover ${className} ${state === "on" ? "" : "hidden"}`} />
  );
  return { state, ask: () => void ask(), view };
}

function Rules({ opensAt, now, camera, warning, closeWarning, startNow }: {
  opensAt: number; now: number; camera: Camera; warning: number | null; closeWarning: () => void; startNow?: (() => void) | undefined;
}) {
  const R = E.rules;
  const left = Math.max(0, opensAt - now);
  const time = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  return (
    <Shell>
      <h1 className={`${display} text-2xl font-extrabold`}>{R.heading}</h1>
      <p className="mt-1 text-neutral-700">{startNow ? P.lead : R.lead}</p>
      {startNow && <p className="mt-4 rounded-2xl border-2 border-sky-600 bg-sky-50 p-4 font-semibold text-sky-950">{P.note}</p>}
      <section className="mt-5 rounded-2xl border-2 border-red-600 bg-red-50 p-4 text-red-900">
        <h2 className="font-extrabold">⚠ {R.tabHeading}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">{R.tab.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>
      <section className="mt-4 rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 text-amber-950">
        <h2 className="font-extrabold">📷 {R.cameraHeading}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">{R.camera.map((l) => <li key={l}>{l}</li>)}</ul>
        {startNow && <p className="mt-3 font-bold">{P.cameraNote}</p>}
        {!startNow && camera.state === "on" && <p className="mt-3 flex items-center gap-3 font-bold text-emerald-800">{camera.view("h-20 w-16")}✓ {R.cameraOn}</p>}
        {!startNow && camera.state === "off" && <button type="button" onClick={camera.ask} className="mt-3 text-left text-sm font-bold underline">{R.cameraOffNote}</button>}
        {!startNow && camera.state === "asking" && <button type="button" onClick={camera.ask} className="mt-3 min-h-11 rounded-full bg-[#0a1026] px-5 font-bold text-white">{R.cameraAllow}</button>}
      </section>
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-extrabold">{R.formatHeading}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-6 text-neutral-700">{R.format.map((l) => <li key={l}>{l}</li>)}</ul>
        <h2 className="mt-4 font-extrabold">{R.howHeading}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 leading-6 text-neutral-700">{R.how.map((l) => <li key={l}>{l}</li>)}</ul>
        <Legend counts={{}} />
      </section>
      <div className="sticky bottom-0 mt-5 bg-neutral-50 py-3">
        {startNow
          ? <button type="button" onClick={startNow} className="min-h-12 w-full rounded-full bg-[#fbb308] px-5 text-lg font-extrabold">{P.startNow} ({time})</button>
          : <button type="button" disabled className="min-h-12 w-full rounded-full bg-[#fbb308] px-5 text-lg font-extrabold disabled:opacity-80">
              {R.startsIn.replace("{time}", time)}
            </button>}
      </div>
      {warning !== null && warning < MAX_STRIKES && (
        <Modal>
          <p className={`rounded-xl p-4 font-bold ${warning === 1 ? "bg-yellow-100 text-yellow-900" : "bg-orange-100 text-orange-900"}`}>{E.strike[warning - 1]}</p>
          <button type="button" className="mt-4 min-h-12 w-full rounded-xl bg-[#0a1026] font-bold text-white" onClick={closeWarning}>{E.strikeOk}</button>
        </Modal>
      )}
    </Shell>
  );
}

const TONE: Record<string, string> = {
  notVisited: "bg-neutral-200 text-neutral-700",
  notAnswered: "bg-red-600 text-white",
  answered: "bg-green-600 text-white",
  marked: "bg-violet-700 text-white",
  answeredMarked: "bg-violet-700 text-white",
};

function Legend({ counts }: { counts: Record<string, number> }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
      {(Object.keys(E.legend) as (keyof typeof E.legend)[]).map((k) => (
        <li key={k} className="flex items-center gap-2"><span className={`grid h-6 min-w-6 place-items-center rounded px-1 font-bold ${TONE[k]}`}>{counts[k] ?? 0}</span>{E.legend[k]}</li>
      ))}
    </ul>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-[#0a1026]">{children}</div>
    </div>
  );
}

/** The practice paper's marks, with every question, the student's answer and the right one. */
function PracticeDone({ paper, answers, again }: { paper: Paper; answers: Record<string, number>; again: () => void }) {
  const key = paper.answerKey ?? [];
  const marks = key.filter((a, i) => answers[String(i)] === a).length;
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <Shell>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className={`${display} text-2xl font-extrabold`}>{P.resultHeading}</h1>
        <p className="mt-2 text-lg font-bold">{P.score.replace("{marks}", String(marks)).replace("{total}", String(key.length))}</p>
        <ol className="mt-5 space-y-4">
          {paper.questions.map((q, i) => {
            const mine = answers[String(i)];
            const right = mine === key[i];
            return (
              <li key={i} className={`rounded-2xl border p-4 ${right ? "border-green-600 bg-green-50" : "border-red-300 bg-red-50"}`}>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-neutral-500">{E.sections[q.subject]} · {i + 1}</p>
                <p className="mt-1 leading-7"><Rich text={q.text} /></p>
                <p className="mt-2 text-sm">{P.yours}: <b>{mine === undefined ? P.none : <Rich text={`${"ABCD"[mine]}. ${q.options[mine]!}`} />}</b> {right ? "✓" : "✗"}</p>
                {!right && <p className="text-sm">{P.correct}: <b><Rich text={`${"ABCD"[key[i]!]}. ${q.options[key[i]!]!}`} /></b></p>}
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={again} className="inline-flex min-h-12 items-center rounded-full bg-[#0a1026] px-5 font-extrabold text-white">{P.again}</button>
          <a href="/scholarship" className="inline-flex min-h-12 items-center rounded-full bg-[#fbb308] px-5 font-extrabold">{E.back_home}</a>
        </div>
      </div>
    </Shell>
  );
}

function Done({ status }: { status: string }) {
  return (
    <Shell>
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className={`${display} text-2xl font-extrabold`}>✓ {E.doneHeading}</h1>
        {status === "timeout" && <p className="mt-3 leading-7">{E.doneTimeout}</p>}
        {status === "struck" && <p className="mt-3 leading-7">{E.doneStruck}</p>}
        <p className="mt-3 leading-7 text-neutral-700">{E.doneLead}</p>
        <a href="/scholarship" className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[#fbb308] px-5 font-extrabold">{E.back_home}</a>
      </div>
    </Shell>
  );
}


/**
 * Question text with powers written the usual way: x^2, x^(n+1), x^{10} and 10^-3 show the power small and raised (x²).
 * Text already using superscript characters (x²) shows as it is.
 */
export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const power = /\^(?:\{([^}]{1,20})\}|\(([^)]{1,20})\)|(-?[\w.]{1,10}))/g;
  let last = 0;
  for (const m of text.matchAll(power)) {
    parts.push(text.slice(last, m.index), <sup key={m.index} className="text-[.7em]">{m[1] ?? m[2] ?? m[3]}</sup>);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
