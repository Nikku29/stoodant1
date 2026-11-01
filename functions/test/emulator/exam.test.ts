import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ORIGIN, PROJECT_ID, clearFirestore } from "./helpers.ts";

const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` }, "exam-test");
const db = getFirestore(app);
after(async () => { await db.doc("testing/clock").delete(); await deleteApp(app); });

const BASE = `http://${process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001"}/${PROJECT_ID}/asia-south1`;
const send = (fn: string, b: unknown) =>
  fetch(`${BASE}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify(b) });
const IST = 330 * 60 * 1000;
/** Moves the functions' clock to this India time. */
const at = async (iso: string) => db.doc("testing/clock").set({ offsetMs: Date.parse(`${iso}Z`) - IST - Date.now() });

// 20 questions per subject for Class 10: answer is always the option text "right".
const SUBJECTS = ["maths", "science", "reasoning", "english"];
const bank = SUBJECTS.flatMap((subject) => Array.from({ length: 20 }, (_, n) => ({
  id: `c10-${subject}-${n}`, class: "10", subject, level: ["easy", "medium", "hard"][n % 3],
  text: `${subject} question ${n}`, options: ["right", `wrong ${n}a`, `wrong ${n}b`, `wrong ${n}c`], answer: 0,
})));

let phones = 0;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 9)]).toString("base64");
/** Registers a Class 10 child, confirms the fee and waits for the roll number. */
async function paidStudent(dob = "2011-08-05") {
  const phone = `91234${String(10000 + phones++)}`;
  const r = await send("submitScholarship", {
    idempotencyKey: randomUUID(), studentName: "Aarav Sharma", studentClass: "10", dob, school: "KV No. 1", city: "Jaipur",
    pincode: "302001", parentName: "Neha Sharma", phone, photo: jpeg, consent: true,
    noticeVersion: "2026-11-01", startedAt: Date.now() - 10_000, website: "", source: { path: "/scholarship" },
  });
  const reg = (await r.json()) as { regNo: string; payment: { token: string } };
  await db.doc(`scholarshipRegistrations/${reg.regNo}`).update({ "payment.status": "paid" });
  for (let i = 0; i < 50; i++) {
    const rollNo = (await db.doc(`scholarshipRegistrations/${reg.regNo}`).get()).get("rollNo") as string | undefined;
    if (rollNo) return { regNo: reg.regNo, token: reg.payment.token, rollNo, phone };
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("no roll number");
}

before(async () => {
  await clearFirestore();
  await getStorage(app).bucket().file("private/exam/bank.json").save(JSON.stringify(bank), { contentType: "application/json" });
});

test("slots: pick one after the fee is paid, limited by capacity, closed 30 minutes before", async () => {
  await at("2026-11-09T12:00:00");
  const a = await paidStudent();
  const b = await paidStudent();
  await db.doc("settings/scholarshipExam").set({ capacity: 1 });

  const list = (await (await send("scholarshipSlot", { regNo: a.regNo, token: a.token })).json()) as { slotId: null; slots: { id: string }[] };
  assert.equal(list.slotId, null);
  assert.equal(list.slots.length, 24);

  const booked = await send("scholarshipSlot", { regNo: a.regNo, token: a.token, slotId: "2026-11-10T17" });
  assert.equal(booked.status, 200);
  assert.equal(((await booked.json()) as { slotId: string }).slotId, "2026-11-10T17");

  const full = await send("scholarshipSlot", { regNo: b.regNo, token: b.token, slotId: "2026-11-10T17" });
  assert.deepEqual(await full.json(), { error: "full" });

  // Moving to another hour frees the first one.
  assert.equal((await send("scholarshipSlot", { regNo: a.regNo, token: a.token, slotId: "2026-11-10T18" })).status, 200);
  assert.equal((await send("scholarshipSlot", { regNo: b.regNo, token: b.token, slotId: "2026-11-10T17" })).status, 200);
  assert.equal((await db.doc("counters/scholarship-slot-2026-11-10T17").get()).get("count"), 1);

  await at("2026-11-10T17:45:00");
  const late = await send("scholarshipSlot", { regNo: a.regNo, token: a.token, slotId: "2026-11-10T19" });
  assert.deepEqual(await late.json(), { error: "closed" });
  await db.doc("settings/scholarshipExam").delete();
});

test("the exam: only in the booked hour, with the right password, a shuffled paper without answers, marked on submit", async () => {
  await at("2026-11-09T12:00:00");
  const s = await paidStudent("2011-08-05");
  await send("scholarshipSlot", { regNo: s.regNo, token: s.token, slotId: "2026-11-10T09" });
  const start = (password = "05082011") => send("scholarshipExam", { action: "start", rollNo: s.rollNo, password });

  assert.equal((await start("01012011")).status, 401);
  await at("2026-11-10T08:55:00");
  assert.equal(((await (await start()).json()) as { error: string }).error, "too_early");

  await at("2026-11-10T09:02:00");
  const res = await start();
  assert.equal(res.status, 200);
  const paper = (await res.json()) as { token: string; questions: { subject: string; text: string; options: string[] }[]; endsAt: number };
  assert.equal(paper.questions.length, 60);
  assert.deepEqual(SUBJECTS.map((x) => paper.questions.filter((q) => q.subject === x).length), [15, 15, 15, 15]);
  assert.ok(!JSON.stringify(paper).includes("\"answer\""));
  // 2 minutes to read the rules, then 60 minutes for the questions.
  assert.ok(Math.abs(paper.endsAt - (Date.parse("2026-11-10T10:04:00Z") - IST)) < 2000);
  assert.ok(Math.abs((paper as unknown as { questionsAt: number }).questionsAt - (Date.parse("2026-11-10T09:04:00Z") - IST)) < 2000);

  // Answer the first 10 right and the next 5 wrong.
  const answers: Record<string, number> = {};
  paper.questions.forEach((q, i) => { if (i < 10) answers[String(i)] = q.options.indexOf("right"); else if (i < 15) answers[String(i)] = q.options.findIndex((o) => o !== "right"); });
  const save = (extra: Record<string, unknown> = {}) => send("scholarshipExam", {
    action: "save", rollNo: s.rollNo, token: paper.token, answers, marked: [3], visited: [0, 1, 2], strikes: 0, submit: false, ...extra,
  });
  // Answers sent while the rules are still showing are not kept.
  assert.equal((await save()).status, 200);
  assert.deepEqual((await db.doc(`examAttempts/${s.rollNo}`).get()).get("answers"), {});
  await at("2026-11-10T09:05:00");
  assert.equal((await save()).status, 200);
  assert.equal((await save({ token: "0".repeat(64) })).status, 403);

  // Photos from the front camera are kept privately; a camera that is off is noted.
  const jpegPhoto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)]).toString("base64");
  const shot = (extra: Record<string, unknown>) => send("scholarshipExam", { action: "photo", rollNo: s.rollNo, token: paper.token, ...extra });
  assert.equal((await shot({ image: jpegPhoto })).status, 200);
  assert.equal((await shot({ cameraOff: true })).status, 200);
  assert.equal((await shot({ image: jpegPhoto, token: undefined })).status, 400);
  const [photos] = await getStorage(app).bucket().getFiles({ prefix: `private/exam-photos/${s.rollNo}/` });
  assert.equal(photos.length, 1);
  assert.equal((await db.doc(`examAttempts/${s.rollNo}`).get()).get("cameraOff"), true);

  // Reloading the page gets the same paper and the saved answers back.
  const again = (await (await start()).json()) as { questions: unknown[]; state: { answers: Record<string, number> } };
  assert.deepEqual(again.questions, paper.questions);
  assert.deepEqual(again.state.answers, answers);

  assert.deepEqual(await (await save({ submit: true })).json(), { ok: true, status: "submitted" });
  const attempt = await db.doc(`examAttempts/${s.rollNo}`).get();
  assert.equal(attempt.get("score.marks"), 10);
  assert.equal(attempt.get("score.wrong"), 5);
  assert.equal(((await (await start()).json()) as { error: string }).error, "finished");
});

test("late, struck out, and timed out", async () => {
  await at("2026-11-09T12:00:00");
  const late = await paidStudent();
  const struck = await paidStudent();
  const away = await paidStudent();
  for (const s of [late, struck, away]) await send("scholarshipSlot", { regNo: s.regNo, token: s.token, slotId: "2026-11-11T14" });
  const start = (rollNo: string) => send("scholarshipExam", { action: "start", rollNo, password: "05082011" });

  await at("2026-11-11T14:05:00");
  const p1 = (await (await start(struck.rollNo)).json()) as { token: string };
  const p2 = (await (await start(away.rollNo)).json()) as { token: string };
  const strike = await send("scholarshipExam", { action: "save", rollNo: struck.rollNo, token: p1.token, answers: {}, marked: [], visited: [], strikes: 3, submit: false });
  assert.deepEqual(await strike.json(), { ok: true, status: "struck" });

  await at("2026-11-11T14:20:00");
  assert.equal(((await (await start(late.rollNo)).json()) as { error: string }).error, "missed");

  await at("2026-11-11T15:30:00");
  const closed = await send("scholarshipExam", { action: "save", rollNo: away.rollNo, token: p2.token, answers: { 0: 1 }, marked: [], visited: [], strikes: 0, submit: false });
  assert.deepEqual(await closed.json(), { ok: true, status: "timeout" });
});

/** Opens a locked paper the way the browser does (AES-GCM, tag at the end). */
function unlock(p: { iv: string; data: string }, key: string): unknown {
  const data = Buffer.from(p.data, "base64");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "base64"), Buffer.from(p.iv, "base64"));
  decipher.setAuthTag(data.subarray(data.length - 16));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8"));
}

test("the paper is made when the fee is confirmed, downloads locked, and unlocks only at the start", async () => {
  await at("2026-11-09T12:00:00");
  const s = await paidStudent();
  // Made by the trigger that gave the roll number.
  let made = false;
  for (let i = 0; i < 50 && !made; i++) { made = (await db.doc(`examPapers/${s.rollNo}`).get()).exists; if (!made) await new Promise((r) => setTimeout(r, 200)); }
  assert.ok(made);

  const res = await send("scholarshipExam", { action: "paper", regNo: s.regNo, token: s.token });
  assert.equal(res.status, 200);
  const locked = (await res.json()) as { rollNo: string; version: string; iv: string; data: string };
  assert.equal(locked.rollNo, s.rollNo);
  assert.ok(!JSON.stringify(locked).includes("right"));
  assert.equal((await send("scholarshipExam", { action: "paper", regNo: s.regNo, token: "0".repeat(64) })).status, 403);

  // The hour and the password show on the page only around the exam.
  await send("scholarshipSlot", { regNo: s.regNo, token: s.token, slotId: "2026-11-10T11" });
  const listAt = async (iso: string) => { await at(iso); return (await (await send("scholarshipSlot", { regNo: s.regNo, token: s.token })).json()) as { password?: string }; };
  assert.equal((await listAt("2026-11-10T10:40:00")).password, undefined);
  assert.equal((await listAt("2026-11-10T10:52:00")).password, "05082011");

  await at("2026-11-10T11:01:00");
  const start = (have?: string) => send("scholarshipExam", { action: "start", rollNo: s.rollNo, password: "05082011", ...(have ? { have } : {}) });
  const keyOnly = (await (await start(locked.version)).json()) as { key: string; questions?: unknown; version: string };
  assert.equal(keyOnly.questions, undefined);
  const questions = unlock(locked, keyOnly.key) as { subject: string; options: string[] }[];
  assert.equal(questions.length, 60);
  // A phone without the download (or with an old one) gets the same paper in full.
  const full = (await (await start()).json()) as { questions: unknown[]; key?: string };
  assert.equal(full.key, undefined);
  assert.deepEqual(full.questions, questions);

  // Marked from the student's own answer key, whatever order their options were in.
  await at("2026-11-10T11:04:00");
  const answers: Record<string, number> = {};
  questions.forEach((q, i) => { answers[String(i)] = q.options.indexOf("right"); });
  const token = ((await (await start()).json()) as { token: string }).token;
  await send("scholarshipExam", { action: "save", rollNo: s.rollNo, token, answers, marked: [], visited: [], strikes: 0, submit: true });
  assert.equal((await db.doc(`examAttempts/${s.rollNo}`).get()).get("score.marks"), 60);
});

test("log in on the scholarship page with the mobile number and date of birth", async () => {
  await at("2026-11-09T12:00:00");
  const s = await paidStudent("2010-02-14");
  const login = (dob: string, phone = s.phone) => send("scholarshipPayment", { phone, dob });
  assert.equal((await login("2010-02-15")).status, 401);
  assert.equal((await login("2010-02-14", "9000000000")).status, 401);
  const ok = await login("2010-02-14", `+91 ${s.phone}`);
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { regNo: string; rollNo: string; payment: { token: string; status: string }; slotId: null };
  assert.equal(body.regNo, s.regNo);
  assert.equal(body.rollNo, s.rollNo);
  assert.equal(body.payment.token, s.token);
  assert.equal(body.payment.status, "paid");
  assert.equal(body.slotId, null);
});
