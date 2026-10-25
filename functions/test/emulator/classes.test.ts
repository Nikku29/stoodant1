import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, where, type DocumentData,
} from "firebase/firestore";
import { initializeApp as initAdmin, getApps } from "firebase-admin/app";
import { PROJECT_ID } from "./helpers.ts";
import { sendClassReminders } from "../../lib/classes/reminders.js";

// Live classes: scheduling through the functions (who may, links, clashes, series), what the rules let
// each person read, the Join tap, and the 5-minute reminder job.

let env: RulesTestEnvironment;
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

const TEACHER = "+919811111111";
const OTHER_TEACHER = "+919822222222";
const PARENT = "+919833333333";
const OTHER_PARENT = "+919855555555";
const HOUR = 3_600_000;

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules, host: fsHost!, port: Number(fsPort) } });
  if (!getApps().length) initAdmin({ projectId: PROJECT_ID });
});
after(() => env.cleanup());

beforeEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const batch = (id: string, over: DocumentData) => setDoc(doc(db, "batches", id), {
      classLevel: "7", board: "CBSE", active: true, durationMinutes: 60, schedule: "", ...over,
    });
    // Teacher records too: the batch trigger copies each batch's teacherPhone from them.
    await setDoc(doc(db, "teachers/t1"), { name: "Priya Ma'am", nameKey: "priya ma'am", phone: TEACHER, subjects: ["Maths"], active: true });
    await setDoc(doc(db, "teachers/t2"), { name: "Ravi Sir", nameKey: "ravi sir", phone: OTHER_TEACHER, subjects: ["Science"], active: true });
    await batch("b1", { name: "Class 7 Maths A", subject: "Maths", teacherId: "t1", teacherPhone: TEACHER, teacherName: "Priya Ma'am", roster: [{ id: "s1", name: "Aarav" }], studentIds: ["s1"] });
    await batch("b2", { name: "Class 7 Science A", subject: "Science", teacherId: "t2", teacherPhone: OTHER_TEACHER, teacherName: "Ravi Sir", roster: [{ id: "s1", name: "Aarav" }], studentIds: ["s1"] });
    await batch("b3", { name: "Class 8 Maths B", subject: "Maths", teacherId: "t1", teacherPhone: TEACHER, teacherName: "Priya Ma'am", roster: [{ id: "s2", name: "Diya" }], studentIds: ["s2"] });
    await setDoc(doc(db, "students/s1"), { name: "Aarav", nameKey: "aarav", parentPhone: PARENT, batchIds: ["b1", "b2"], active: true });
    await setDoc(doc(db, "students/s2"), { name: "Diya", nameKey: "diya", parentPhone: OTHER_PARENT, batchIds: ["b3"], active: true });
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT });
    await setDoc(doc(db, "progress/s2"), { parentPhone: OTHER_PARENT });
    await setDoc(doc(db, "batchAccess/b1"), { parentPhones: [PARENT] });
    await setDoc(doc(db, "batchAccess/b2"), { parentPhones: [PARENT] });
    await setDoc(doc(db, "batchAccess/b3"), { parentPhones: [OTHER_PARENT] });
  });
});

/** An unsigned ID token, which the emulators accept, for calling the functions as someone. */
function token(uid: string, claims: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT_ID}`, aud: PROJECT_ID, sub: uid, user_id: uid,
    iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "phone", identities: {} }, ...claims,
  })}.`;
}

async function call(name: string, data: unknown, who?: { uid: string; claims: Record<string, unknown> }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (who) headers["Authorization"] = `Bearer ${token(who.uid, who.claims)}`;
  const res = await fetch(`http://${functionsHost}/${PROJECT_ID}/asia-south1/${name}`, {
    method: "POST", headers, body: JSON.stringify({ data }),
  });
  const body = (await res.json()) as { result?: Record<string, unknown>; error?: { status: string; message: string } };
  return body;
}

const asTeacher = { uid: "ut1", claims: { phone_number: TEACHER } };
const asOtherTeacher = { uid: "ut2", claims: { phone_number: OTHER_TEACHER } };
const asTeam = { uid: "owner", claims: { admin: true, email: "owner@example.com", email_verified: true } };
const LINK = "https://us06web.zoom.us/j/81234567890?pwd=abc";
const at = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

async function classesOf(batchId: string) {
  let docs: DocumentData[] = [];
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDocs(query(collection(ctx.firestore(), "liveClasses"), where("batchId", "==", batchId)));
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  return docs.sort((a, b) => a["startAt"].toMillis() - b["startAt"].toMillis());
}

test("a teacher schedules a weekly series for their own batch; others cannot", async () => {
  const starts = [at(24 * HOUR), at(8 * 24 * HOUR), at(15 * 24 * HOUR)];
  const ok = await call("scheduleClasses", { batchId: "b1", starts, joinUrl: LINK, topic: "Fractions" }, asTeacher);
  assert.equal(ok.result?.["saved"], true, JSON.stringify(ok));
  const saved = await classesOf("b1");
  assert.equal(saved.length, 3);
  assert.equal(saved[0]!["teacherName"], "Priya Ma'am");
  assert.equal(saved[0]!["durationMinutes"], 60);
  assert.ok(saved[0]!["seriesId"] && saved.every((c) => c["seriesId"] === saved[0]!["seriesId"]));

  assert.equal((await call("scheduleClasses", { batchId: "b1", starts, joinUrl: LINK }, asOtherTeacher)).error?.status, "PERMISSION_DENIED");
  assert.equal((await call("scheduleClasses", { batchId: "b1", starts, joinUrl: LINK })).error?.status, "UNAUTHENTICATED");
  assert.equal((await call("scheduleClasses", { batchId: "b1", starts, joinUrl: "https://evil.com/j/1" }, asTeacher)).error?.status, "INVALID_ARGUMENT");
  assert.equal((await call("scheduleClasses", { batchId: "b1", starts: [at(-HOUR)], joinUrl: LINK }, asTeacher)).error?.status, "INVALID_ARGUMENT");
  // The team can schedule for any batch.
  assert.equal((await call("scheduleClasses", { batchId: "b2", starts: [at(30 * HOUR)], joinUrl: LINK }, asTeam)).result?.["saved"], true);
});

test("clashes for the teacher or a child are shown first, and saved only when confirmed", async () => {
  await call("scheduleClasses", { batchId: "b1", starts: [at(48 * HOUR)], joinUrl: LINK }, asTeacher);
  // Same teacher, other batch, overlapping time.
  const teacherClash = await call("scheduleClasses", { batchId: "b3", starts: [at(48 * HOUR + 30 * 60_000)], joinUrl: LINK }, asTeacher);
  assert.equal(teacherClash.result?.["saved"], false);
  assert.equal((teacherClash.result?.["clashes"] as { who: string }[])[0]?.who, "teacher");
  // Aarav is in b1 and b2: a Science class at the same time clashes for him.
  const childClash = await call("scheduleClasses", { batchId: "b2", starts: [at(48 * HOUR)], joinUrl: LINK }, asOtherTeacher);
  const clash = (childClash.result?.["clashes"] as { who: string; name: string }[])[0];
  assert.deepEqual([clash?.who, clash?.name], ["student", "Aarav"]);
  const forced = await call("scheduleClasses", { batchId: "b2", starts: [at(48 * HOUR)], joinUrl: LINK, force: true }, asOtherTeacher);
  assert.equal(forced.result?.["saved"], true);
});

test("move, cancel this and following, and edit the link", async () => {
  await call("scheduleClasses", { batchId: "b1", starts: [at(24 * HOUR), at(8 * 24 * HOUR), at(15 * 24 * HOUR)], joinUrl: LINK }, asTeacher);
  const [first, second] = await classesOf("b1");
  const moved = await call("changeClass", { classId: first!["id"], action: "move", startAt: at(26 * HOUR) }, asTeacher);
  assert.equal(moved.result?.["saved"], true, JSON.stringify(moved));
  assert.equal(
    (await call("changeClass", { classId: first!["id"], action: "cancel" }, asOtherTeacher)).error?.status,
    "PERMISSION_DENIED",
  );
  const cancelled = await call("changeClass", { classId: second!["id"], action: "cancel", following: true }, asTeacher);
  assert.equal(cancelled.result?.["changed"], 2);
  const after = await classesOf("b1");
  assert.deepEqual(after.map((c) => c["status"]), ["scheduled", "cancelled", "cancelled"]);
  const meet = "https://meet.google.com/abc-defg-hij";
  await call("changeClass", { classId: first!["id"], action: "edit", joinUrl: meet }, asTeacher);
  assert.equal((await classesOf("b1"))[0]!["joinUrl"], meet);
});

test("families of the batch and its teacher can read a class; nobody writes it from the browser", async () => {
  await call("scheduleClasses", { batchId: "b1", starts: [at(24 * HOUR)], joinUrl: LINK }, asTeacher);
  const [cls] = await classesOf("b1");
  const path = `liveClasses/${cls!["id"]}`;
  const parent = env.authenticatedContext("up1", { phone_number: PARENT }).firestore();
  const otherParent = env.authenticatedContext("up2", { phone_number: OTHER_PARENT }).firestore();
  const teacher = env.authenticatedContext("ut1", { phone_number: TEACHER }).firestore();
  const otherTeacher = env.authenticatedContext("ut2", { phone_number: OTHER_TEACHER }).firestore();
  await assertSucceeds(getDoc(doc(parent, path)));
  await assertSucceeds(getDocs(query(collection(parent, "liveClasses"), where("batchId", "==", "b1"))));
  await assertSucceeds(getDoc(doc(teacher, path)));
  await assertFails(getDoc(doc(otherParent, path)));
  await assertFails(getDoc(doc(otherTeacher, path)));
  await assertFails(getDocs(query(collection(otherParent, "liveClasses"), where("batchId", "==", "b1"))));
  await assertFails(setDoc(doc(teacher, path), { status: "cancelled" }, { merge: true }));
  await assertFails(setDoc(doc(teacher, "liveClasses/new"), { batchId: "b1" }));
});

test("a parent's Join tap is recorded only for their own child, while the class is on", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const base = { batchId: "b1", status: "scheduled", durationMinutes: 60 };
    await setDoc(doc(db, "liveClasses/now"), { ...base, startAt: Timestamp.fromMillis(Date.now() - 60_000), endAt: Timestamp.fromMillis(Date.now() + HOUR) });
    await setDoc(doc(db, "liveClasses/later"), { ...base, startAt: Timestamp.fromMillis(Date.now() + 5 * HOUR), endAt: Timestamp.fromMillis(Date.now() + 6 * HOUR) });
  });
  const parent = env.authenticatedContext("up1", { phone_number: PARENT }).firestore();
  const otherParent = env.authenticatedContext("up2", { phone_number: OTHER_PARENT }).firestore();
  const tap = (db: typeof parent, cls: string, student: string, uid: string) =>
    setDoc(doc(db, `liveClasses/${cls}/joins/${student}`), { at: serverTimestamp(), by: uid });
  await assertSucceeds(tap(parent, "now", "s1", "up1"));
  await assertFails(tap(parent, "later", "s1", "up1"));
  await assertFails(tap(otherParent, "now", "s1", "up2"));
  await assertFails(tap(otherParent, "now", "s2", "up2")); // Diya is not in this batch
  const teacher = env.authenticatedContext("ut1", { phone_number: TEACHER }).firestore();
  await assertSucceeds(getDocs(collection(teacher, "liveClasses/now/joins")));
  await assertFails(getDocs(collection(parent, "liveClasses/now/joins")));
});

test("the reminder job marks each class once for its start time, and again if it is moved", async () => {
  const start = Date.now() + 4 * 60_000;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const base = { batchId: "b1", subject: "Maths", batchName: "Class 7 Maths A", teacherName: "Priya Ma'am", durationMinutes: 60 };
    await setDoc(doc(db, "liveClasses/soon"), { ...base, status: "scheduled", startAt: Timestamp.fromMillis(start), endAt: Timestamp.fromMillis(start + HOUR) });
    await setDoc(doc(db, "liveClasses/off"), { ...base, status: "cancelled", startAt: Timestamp.fromMillis(start), endAt: Timestamp.fromMillis(start + HOUR) });
    await setDoc(doc(db, "liveClasses/far"), { ...base, status: "scheduled", startAt: Timestamp.fromMillis(start + HOUR), endAt: Timestamp.fromMillis(start + 2 * HOUR) });
  });
  const marked = async (id: string) => {
    let value: unknown;
    await env.withSecurityRulesDisabled(async (ctx) => {
      value = (await getDoc(doc(ctx.firestore(), `liveClasses/${id}`))).get("remindedFor");
    });
    return (value as Timestamp | undefined)?.toMillis();
  };
  assert.equal((await sendClassReminders()).classes, 1);
  assert.equal(await marked("soon"), start);
  assert.equal(await marked("off"), undefined);
  assert.equal(await marked("far"), undefined);
  // A second run finds the class but does not remind again.
  await sendClassReminders();
  assert.equal(await marked("soon"), start);
  // Moved by two minutes: reminded again for the new time.
  const moved = start + 2 * 60_000;
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "liveClasses/soon"), { startAt: Timestamp.fromMillis(moved) }, { merge: true });
  });
  await sendClassReminders();
  assert.equal(await marked("soon"), moved);
});
