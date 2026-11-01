import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "firebase-functions";
import { FieldValue, Timestamp, getFirestore, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { z } from "zod";
import { keyedHash } from "../../lib/hash.js";
import { clientIp, isRateLimited } from "../../lead/submit.js";
import { REG_NO_PATTERN } from "../schema.js";
import { passesGate, payStatusOf, payToken, pepperOr500 } from "../http.js";
import { PER_SUBJECT, SUBJECTS, paperKey, scorePaper, type PaperItem } from "./paper.js";
import { download, lockedPaper, type LockedPaper } from "./locked.js";
import { getStorage } from "firebase-admin/storage";
import { ALL_SLOTS, DEFAULT_CAPACITY, EXAM_MINUTES, LATE_JOIN_MINUTES, READING_MINUTES, bookingOpen, canStartAt, isSlot, loginOpens, paperEnds, questionsOpen, slotStart } from "./slots.js";

const MIN = 60 * 1000;
/** Answers sent this long after the end still count (slow networks); after that the paper is closed. */
const GRACE_MS = 2 * MIN;
/** Tab switches allowed: the third ends the test. */
export const MAX_STRIKES = 3;
const ROLL = /^\d{9}$/;

const capacity = async () => {
  const snap = await getFirestore().doc("settings/scholarshipExam").get().catch(() => null);
  const value = Number(snap?.get("capacity"));
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_CAPACITY;
};
const counterRef = (id: string) => getFirestore().doc(`counters/scholarship-slot-${id}`);

/**
 * The time. Tests in the emulator move it forward to an exam day by writing testing/clock { offsetMs };
 * outside the emulator that document is never read.
 */
export async function examNow(): Promise<number> {
  if (process.env["FUNCTIONS_EMULATOR"] !== "true") return Date.now();
  const snap = await getFirestore().doc("testing/clock").get();
  return Date.now() + (Number(snap.get("offsetMs")) || 0);
}

const tokenMatches = (expected: string, given: string) => {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

// ---------- Slot booking: POST { regNo, token, slotId? } ----------

const slotSchema = z.object({
  regNo: z.string().regex(REG_NO_PATTERN),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  slotId: z.string().max(20).optional(),
}).strict();

/** The Join button (and the password) show from this long before the booked hour. */
const JOIN_EARLY_MS = 10 * MIN;
const joinOpen = (slotId: string, now: number) =>
  now >= slotStart(slotId) - JOIN_EARLY_MS && now <= slotStart(slotId) + (EXAM_MINUTES + LATE_JOIN_MINUTES + READING_MINUTES) * MIN;

/**
 * The family picks (or changes) the exam hour once the fee is confirmed. Without slotId it only lists the slots.
 * Answers { ok, slotId, slots: [{ id, full, open }], password? }; 409 not_paid / full / closed.
 * The exam password (date of birth as DDMMYYYY) comes with the list only from 10 minutes before the booked hour
 * until it closes, so the page can show it next to the Join button on the day.
 */
export async function handleScholarshipSlot(req: Request, res: Response): Promise<void> {
  const started = await examNow();
  if (!(await passesGate(req, res, 2 * 1024, "scholarship_slot_rejected"))) return;
  const parsed = slotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid" }); return; }
  const { regNo, token, slotId } = parsed.data;
  const pepper = pepperOr500(res, "scholarship_slot_failed");
  if (!pepper) return;
  if (!tokenMatches(payToken(pepper, regNo), token)) { res.status(403).json({ error: "forbidden" }); return; }
  const db = getFirestore();
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-slot-ip:${clientIp(req)}`), started, { per10Min: 60, perDay: 400 })) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const regRef = db.doc(`scholarshipRegistrations/${regNo}`);
  const cap = await capacity();
  const list = async (current: string | null) => {
    const counts = await db.getAll(...ALL_SLOTS.map(counterRef));
    return {
      ok: true,
      slotId: current,
      slots: ALL_SLOTS.map((id, i) => ({
        id,
        full: ((counts[i]!.get("count") as number | undefined) ?? 0) >= cap && id !== current,
        open: bookingOpen(id, started),
      })),
    };
  };

  try {
    if (slotId === undefined) {
      const reg = await regRef.get();
      if (!reg.exists) { res.status(404).json({ error: "not_found" }); return; }
      const current = (reg.get("slotId") as string | undefined) ?? null;
      const showPassword = current && isSlot(current) && payStatusOf(reg.data()) === "paid" && joinOpen(current, started);
      res.status(200).json({ ...(await list(current)), ...(showPassword ? { password: dobPassword(String(reg.get("dob"))) } : {}) });
      return;
    }
    if (!isSlot(slotId)) { res.status(400).json({ error: "invalid" }); return; }
    const result = await db.runTransaction(async (tx) => {
      const [reg, next] = await tx.getAll(regRef, counterRef(slotId));
      if (!reg!.exists) return "not_found" as const;
      if (payStatusOf(reg!.data()) !== "paid") return "not_paid" as const;
      const current = reg!.get("slotId") as string | undefined;
      if (current === slotId) return "same" as const;
      if (!bookingOpen(slotId, started) || (current && !bookingOpen(current, started))) return "closed" as const;
      if (((next!.get("count") as number | undefined) ?? 0) >= cap) return "full" as const;
      const now = Timestamp.fromMillis(started);
      tx.set(counterRef(slotId), { count: FieldValue.increment(1), updatedAt: now }, { merge: true });
      if (current) tx.set(counterRef(current), { count: FieldValue.increment(-1), updatedAt: now }, { merge: true });
      tx.update(regRef, { slotId, slotBookedAt: now, updatedAt: now });
      return "booked" as const;
    });
    if (result === "not_found") { res.status(404).json({ error: "not_found" }); return; }
    if (result === "not_paid" || result === "closed" || result === "full") { res.status(409).json({ error: result }); return; }
    logger.info("scholarship_slot", { regNo, slotId, result });
    res.status(200).json(await list(slotId));
  } catch (error) {
    logger.error("scholarship_slot_failed", { code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}

// ---------- The exam: POST { action: "start" | "save", ... } ----------

const startSchema = z.object({
  action: z.literal("start"),
  rollNo: z.string().regex(ROLL),
  /** Date of birth as DDMMYYYY: the password. */
  password: z.string().regex(/^\d{8}$/),
  /** The version of the locked paper already downloaded on this phone: then only its key is sent. */
  have: z.string().regex(/^[a-f0-9]{16}$/).optional(),
}).strict();
/** A photo from the front camera at a random moment of the test (small JPEG, base64), or a note that the camera is off. */
const photoSchema = z.object({
  action: z.literal("photo"),
  rollNo: z.string().regex(ROLL),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  image: z.string().min(100).max(60_000).regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(),
  cameraOff: z.literal(true).optional(),
}).strict();
/** Photos kept per paper: enough for the random moments plus retries. */
const MAX_PHOTOS = 12;
const paperSchema = z.object({
  action: z.literal("paper"),
  regNo: z.string().regex(REG_NO_PATTERN),
  token: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
/** A mock test's marks, sent from the phone that took it (the mock test is marked there). */
const sectionMarks = z.number().int().min(0).max(PER_SUBJECT);
const practiceSchema = z.object({
  action: z.literal("practice"),
  regNo: z.string().regex(REG_NO_PATTERN),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  studentClass: z.enum(["9", "10"]),
  bySection: z.object({ maths: sectionMarks, science: sectionMarks, reasoning: sectionMarks, english: sectionMarks }).strict(),
}).strict();
const indexMap = z.record(z.string().regex(/^\d{1,2}$/), z.number().int().min(0).max(3));
const saveSchema = z.object({
  action: z.literal("save"),
  rollNo: z.string().regex(ROLL),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  answers: indexMap,
  marked: z.array(z.number().int().min(0).max(99)).max(100),
  visited: z.array(z.number().int().min(0).max(99)).max(100),
  strikes: z.number().int().min(0).max(MAX_STRIKES),
  submit: z.boolean(),
}).strict();

const examToken = (pepper: string, rollNo: string) => keyedHash(pepper, `scholarship-exam:${rollNo}`);
const dobPassword = (dob: string) => { const [y, m, d] = dob.split("-"); return `${d}${m}${y}`; };

export async function handleScholarshipExam(req: Request, res: Response): Promise<void> {
  const started = await examNow();
  if (!(await passesGate(req, res, 64 * 1024, "scholarship_exam_rejected"))) return;
  const pepper = pepperOr500(res, "scholarship_exam_failed");
  if (!pepper) return;
  const action = (req.body as { action?: unknown } | undefined)?.action;
  try {
    if (action === "start") return await start(req, res, pepper, started);
    if (action === "save") return await save(req, res, pepper, started);
    if (action === "paper") return await paper(req, res, pepper, started);
    if (action === "photo") return await photo(req, res, pepper, started);
    if (action === "practice") return await practice(req, res, pepper, started);
    res.status(400).json({ error: "invalid" });
  } catch (error) {
    logger.error("scholarship_exam_failed", { action, code: (error as { code?: unknown }).code ?? null, message: String(error).slice(0, 200) });
    res.status(503).json({ error: "retry" });
  }
}

async function start(req: Request, res: Response, pepper: string, now: number) {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid" }); return; }
  const { rollNo, password, have } = parsed.data;
  const db = getFirestore();
  // Many phones share one address on mobile networks, so the address limit is loose; wrong passwords are counted per roll number.
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-exam-ip:${clientIp(req)}`), now, { per10Min: 300, perDay: 3000 })) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-exam-roll:${rollNo}`), now, { per10Min: 10, perDay: 60 })) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const found = await db.collection("scholarshipRegistrations").where("rollNo", "==", rollNo).limit(1).get();
  const reg = found.docs[0];
  if (!reg || payStatusOf(reg.data()) !== "paid" || dobPassword(String(reg.get("dob"))) !== password) {
    logger.info("scholarship_exam_rejected", { reason: "login" });
    res.status(401).json({ error: "login" });
    return;
  }
  const slotId = reg.get("slotId") as string | undefined;
  if (!slotId || !isSlot(slotId)) { res.status(409).json({ error: "no_slot" }); return; }

  const attemptRef = db.doc(`examAttempts/${rollNo}`);
  let attempt = await attemptRef.get();
  if (!attempt.exists) {
    // Log-in opens 5 minutes before the hour; the page tries again by itself then.
    if (now < loginOpens(slotId)) { res.status(425).json({ error: "too_early", slotId, startsAt: loginOpens(slotId), serverNow: now }); return; }
    if (!canStartAt(slotId, now)) { res.status(410).json({ error: "missed", slotId }); return; }
    // The paper made when the fee was confirmed (and downloaded since), or made now if it wasn't.
    const locked = await lockedPaper(pepper, rollNo, String(reg.get("studentClass")), true);
    if (!locked) { logger.error("scholarship_exam_failed", { reason: "no_bank" }); res.status(503).json({ error: "retry" }); return; }
    try {
      await attemptRef.create({
        rollNo, regNo: reg.id, studentName: reg.get("studentName"), studentClass: reg.get("studentClass"), slotId,
        paper: locked.paper, paperVersion: locked.version, answers: {}, marked: [], visited: [], strikes: 0, status: "started",
        photos: 0, startedAt: Timestamp.fromMillis(now), questionsAt: Timestamp.fromMillis(questionsOpen(slotId, now)), endsAt: Timestamp.fromMillis(paperEnds(slotId, now)), savedAt: Timestamp.fromMillis(now),
      });
    } catch {
      // Two taps at once: the other one made it. Carry on with that.
    }
    attempt = await attemptRef.get();
  }
  const a = attempt.data()!;
  if (a["status"] !== "started") { res.status(409).json({ error: "finished", status: a["status"] }); return; }
  if (now > (a["endsAt"] as Timestamp).toMillis() + GRACE_MS) {
    await finishAttempt(attempt, "timeout", now);
    res.status(409).json({ error: "finished", status: "timeout" });
    return;
  }
  // The phone already holds this paper (downloaded ahead, locked): it only needs the key. Otherwise send it now.
  const version = a["paperVersion"] as string;
  const onPhone = have !== undefined && have === version;
  const questions = onPhone ? null : ((await db.doc(`examPapers/${rollNo}`).get()).get("questions") as LockedPaper["questions"] | undefined);
  if (!onPhone && !questions) { logger.error("scholarship_exam_failed", { reason: "no_paper" }); res.status(503).json({ error: "retry" }); return; }
  logger.info("scholarship_exam_start", { rollNo, slotId, onPhone });
  res.status(200).json({
    ok: true,
    token: examToken(pepper, rollNo),
    student: { name: a["studentName"], studentClass: a["studentClass"], rollNo },
    sections: SUBJECTS,
    version,
    ...(onPhone ? { key: paperKey(pepper, rollNo).toString("base64") } : { questions }),
    /** The rules show until then (from log-in, at least 2 minutes); the questions then open by themselves and the 60 minutes run to endsAt. */
    questionsAt: ((a["questionsAt"] ?? a["startedAt"]) as Timestamp).toMillis(),
    endsAt: (a["endsAt"] as Timestamp).toMillis(),
    serverNow: now,
    state: { answers: a["answers"], marked: a["marked"], visited: a["visited"], strikes: a["strikes"] },
  });
}

async function save(req: Request, res: Response, pepper: string, now: number) {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid" }); return; }
  const { rollNo, token, answers, marked, visited, strikes, submit } = parsed.data;
  if (!tokenMatches(examToken(pepper, rollNo), token)) { res.status(403).json({ error: "forbidden" }); return; }
  const db = getFirestore();
  const ref = db.doc(`examAttempts/${rollNo}`);
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { error: "not_found" as const };
    if (snap.get("status") !== "started") return { error: "finished" as const, status: snap.get("status") as string };
    const endsAt = (snap.get("endsAt") as Timestamp).toMillis();
    if (now > endsAt + GRACE_MS) return { finish: "timeout" as const };
    const count = (snap.get("paper") as unknown[]).length;
    const inRange = (i: number) => i < count;
    // Nothing can be answered while the rules are still showing.
    const reading = now < ((snap.get("questionsAt") ?? snap.get("startedAt")) as Timestamp).toMillis();
    const clean = reading ? {} : Object.fromEntries(Object.entries(answers).filter(([k]) => inRange(Number(k))));
    // Strikes only go up: a page reload can't wipe them.
    const strikesNow = Math.max(strikes, (snap.get("strikes") as number | undefined) ?? 0);
    tx.update(ref, {
      answers: clean, marked: marked.filter(inRange), visited: visited.filter(inRange), strikes: strikesNow,
      savedAt: Timestamp.fromMillis(now),
    });
    if (strikesNow >= MAX_STRIKES) return { finish: "struck" as const };
    if (submit || now > endsAt) return { finish: now > endsAt ? ("timeout" as const) : ("submitted" as const) };
    return { saved: true as const };
  });
  if ("error" in outcome) {
    res.status(outcome.error === "not_found" ? 404 : 409).json(outcome.error === "finished" ? { error: "finished", status: outcome.status } : { error: outcome.error });
    return;
  }
  if ("finish" in outcome) {
    await finishAttempt(await ref.get(), outcome.finish!, now);
    res.status(200).json({ ok: true, status: outcome.finish });
    return;
  }
  res.status(200).json({ ok: true, status: "started", serverNow: now });
}

/**
 * POST { action: "practice", regNo, token, studentClass, bySection } when a registered student finishes the mock test
 * on the phone they registered with: the marks go on the registration (practice.last, practice.best, practice.attempts)
 * so the team sees them in /admin. The mock test counts for nothing; it only shows how ready the student is.
 */
async function practice(req: Request, res: Response, pepper: string, now: number) {
  const parsed = practiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid" }); return; }
  const { regNo, token, studentClass, bySection } = parsed.data;
  if (!tokenMatches(payToken(pepper, regNo), token)) { res.status(403).json({ error: "forbidden" }); return; }
  const db = getFirestore();
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-practice:${regNo}`), now, { per10Min: 10, perDay: 40 })) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const marks = SUBJECTS.reduce((sum, s) => sum + bySection[s], 0);
  const ref = db.doc(`scholarshipRegistrations/${regNo}`);
  const saved = await db.runTransaction(async (tx) => {
    const reg = await tx.get(ref);
    // A mock test of the other class says nothing about this student.
    if (!reg.exists || String(reg.get("studentClass")) !== studentClass) return false;
    const before = (reg.get("practice") ?? {}) as { attempts?: number; best?: number };
    tx.update(ref, {
      practice: {
        attempts: (before.attempts ?? 0) + 1,
        best: Math.max(before.best ?? 0, marks),
        last: { marks, total: SUBJECTS.length * PER_SUBJECT, bySection, at: Timestamp.fromMillis(now) },
      },
    });
    return true;
  });
  if (!saved) { res.status(409).json({ error: "not_found" }); return; }
  logger.info("scholarship_practice_saved", { regNo, marks });
  res.status(200).json({ ok: true });
}

/**
 * POST { action: "paper", regNo, token } from /scholarship once the fee is confirmed: the student's paper,
 * locked, to keep on the phone until the exam. Its key comes only with "start" inside the booked hour.
 * Answers { ok, rollNo, version, iv, data }, or 409 { error: "not_ready" } (fee not confirmed, or no bank yet).
 */
async function paper(req: Request, res: Response, pepper: string, now: number) {
  const parsed = paperSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid" }); return; }
  const { regNo, token } = parsed.data;
  if (!tokenMatches(payToken(pepper, regNo), token)) { res.status(403).json({ error: "forbidden" }); return; }
  const db = getFirestore();
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-paper-ip:${clientIp(req)}`), now, { per10Min: 120, perDay: 1000 })) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const reg = await db.doc(`scholarshipRegistrations/${regNo}`).get();
  const rollNo = reg.get("rollNo") as string | undefined;
  if (!reg.exists || payStatusOf(reg.data()) !== "paid" || !rollNo) { res.status(409).json({ error: "not_ready" }); return; }
  // Once the exam has begun, the paper it began with stays; before that, a newer bank upload makes a new paper.
  const started = (await db.doc(`examAttempts/${rollNo}`).get()).exists;
  const locked = await lockedPaper(pepper, rollNo, String(reg.get("studentClass")), !started).catch(() => null);
  if (!locked) { res.status(409).json({ error: "not_ready" }); return; }
  res.status(200).json({ ok: true, rollNo, ...download(locked) });
}

/**
 * POST { action: "photo", rollNo, token, image } during the test: the front camera's photo at a random moment,
 * kept privately for the team (private/exam-photos/{rollNo}/) to check top rankers. { cameraOff: true } records
 * that the student didn't allow the camera, so the team knows to check that paper more closely.
 */
async function photo(req: Request, res: Response, pepper: string, now: number) {
  const parsed = photoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid" }); return; }
  const { rollNo, token, image, cameraOff } = parsed.data;
  if (!tokenMatches(examToken(pepper, rollNo), token)) { res.status(403).json({ error: "forbidden" }); return; }
  const db = getFirestore();
  const ref = db.doc(`examAttempts/${rollNo}`);
  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("status") !== "started") return false;
    if (cameraOff) { tx.update(ref, { cameraOff: true }); return "noted" as const; }
    const n = (snap.get("photos") as number | undefined) ?? 0;
    if (n >= MAX_PHOTOS) return false;
    tx.update(ref, { photos: n + 1 });
    return true;
  });
  if (ok === "noted") { res.status(200).json({ ok: true }); return; }
  if (!ok || !image) { res.status(409).json({ error: "not_taken" }); return; }
  const bytes = Buffer.from(image, "base64");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) { res.status(400).json({ error: "invalid" }); return; }
  await getStorage().bucket().file(`private/exam-photos/${rollNo}/${now}.jpg`).save(bytes, {
    contentType: "image/jpeg", resumable: false, metadata: { cacheControl: "private, max-age=0" },
  });
  res.status(200).json({ ok: true });
}

/** Marks a paper (answers as last saved) and closes it. Safe to call twice: a closed paper is left alone. */
export async function finishAttempt(snap: DocumentSnapshot, status: "submitted" | "timeout" | "struck", now: number): Promise<void> {
  const data = snap.data() as DocumentData | undefined;
  if (!data || data["status"] !== "started") return;
  const score = scorePaper(data["paper"] as PaperItem[], data["answers"] as Record<string, number>);
  const startedAt = ((data["questionsAt"] ?? data["startedAt"]) as Timestamp).toMillis();
  const endedAt = Math.min(now, (data["endsAt"] as Timestamp).toMillis());
  await getFirestore().runTransaction(async (tx) => {
    const fresh = await tx.get(snap.ref);
    if (fresh.get("status") !== "started") return;
    tx.update(snap.ref, { status, score, submittedAt: Timestamp.fromMillis(now), timeTakenMs: Math.max(0, endedAt - startedAt) });
  });
  logger.info("scholarship_exam_finished", { rollNo: data["rollNo"], status, marks: score.marks });
}

/** Exam camera photos older than 90 days are deleted (the privacy policy promises this). Run once a day. */
export async function deleteOldExamPhotos(now = Date.now()): Promise<number> {
  const [files] = await getStorage().bucket().getFiles({ prefix: "private/exam-photos/" });
  const old = files.filter((f) => Date.parse(String(f.metadata.timeCreated)) < now - 90 * 24 * 60 * MIN);
  await Promise.all(old.map((f) => f.delete({ ignoreNotFound: true })));
  return old.length;
}

/** Every few minutes on exam days: closes papers whose time ran out without a final save (closed tab, lost phone). */
export async function finishExpiredAttempts(now?: number): Promise<number> {
  now ??= await examNow();
  const due = await getFirestore().collection("examAttempts")
    .where("status", "==", "started").where("endsAt", "<", Timestamp.fromMillis(now - GRACE_MS)).limit(500).get();
  for (const snap of due.docs) await finishAttempt(snap, "timeout", now);
  return due.size;
}
