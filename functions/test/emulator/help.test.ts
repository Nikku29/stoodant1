import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { PROJECT_ID, waitFor, freshDatabase } from "./helpers.ts";

// "Need help?": who may ask, what is saved, the per-hour limit, the team alert, and who may read it.

let env: RulesTestEnvironment;
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

const TEACHER = "+919811111111";
const PARENT = "+919833333333";

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules, host: fsHost!, port: Number(fsPort) } });
});
after(() => env.cleanup());

beforeEach(async () => {
  await freshDatabase(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "teachers/t1"), { name: "Priya Ma'am", nameKey: "priya ma'am", phone: TEACHER, subjects: ["Maths"], active: true });
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT, student: { name: "Aarav" } });
  });
});

function token(uid: string, claims: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT_ID}`, aud: PROJECT_ID, sub: uid, user_id: uid,
    iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "phone", identities: {} }, ...claims,
  })}.`;
}

async function ask(data: unknown, who?: { uid: string; claims: Record<string, unknown> }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (who) headers["Authorization"] = `Bearer ${token(who.uid, who.claims)}`;
  const res = await fetch(`http://${functionsHost}/${PROJECT_ID}/asia-south1/askForHelp`, {
    method: "POST", headers, body: JSON.stringify({ data }),
  });
  return (await res.json()) as { result?: Record<string, unknown>; error?: { status: string; message: string } };
}

const asParent = { uid: "up1", claims: { phone_number: PARENT } };
const asTeacher = { uid: "ut1", claims: { phone_number: TEACHER } };

async function requests() {
  let list: Record<string, unknown>[] = [];
  await env.withSecurityRulesDisabled(async (ctx) => {
    list = (await getDocs(collection(ctx.firestore(), "helpRequests"))).docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  return list;
}

test("needs a phone log-in, a topic and a message", async () => {
  assert.equal((await ask({ topic: "class", message: "Join does not open" })).error?.status, "UNAUTHENTICATED");
  assert.equal((await ask({ topic: "nope", message: "Join does not open" }, asParent)).error?.status, "INVALID_ARGUMENT");
  assert.equal((await ask({ topic: "class", message: " " }, asParent)).error?.status, "INVALID_ARGUMENT");
  assert.equal((await requests()).length, 0);
});

test("a parent's request is saved with the child's name, and the team is alerted", async () => {
  const res = await ask({ topic: "class", message: "Join button does not open Zoom", role: "teacher" }, asParent);
  assert.deepEqual(res.result, { saved: true });
  const [saved] = await requests();
  assert.equal(saved!.role, "parent");
  assert.equal(saved!.name, "Aarav");
  assert.equal(saved!.phone, PARENT);
  assert.equal(saved!.status, "open");
  // No email key or team phones in the emulator: every channel reports skipped, none failed.
  const alerts = await waitFor(async () => {
    const [r] = await requests();
    return r?.alerts as Record<string, unknown> | undefined;
  });
  assert.equal(alerts.email, "skipped");
  assert.equal(alerts.push, "skipped");
  assert.equal(alerts.whatsapp, "skipped");
});

test("a teacher is named, and one person can send at most 3 an hour", async () => {
  for (let i = 0; i < 3; i++)
    assert.deepEqual((await ask({ topic: "other", message: `Problem ${i}` }, asTeacher)).result, { saved: true });
  const fourth = await ask({ topic: "other", message: "Problem 4" }, asTeacher);
  assert.equal(fourth.error?.status, "RESOURCE_EXHAUSTED");
  const saved = await requests();
  assert.equal(saved.length, 3);
  assert.ok(saved.every((r) => r.role === "teacher" && r.name === "Priya Ma'am"));
});

test("only the team reads requests, and may only mark them done", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "helpRequests/h1"), {
      uid: "up1", phone: PARENT, role: "parent", name: "Aarav", topic: "class", message: "Help", status: "open", createdAt: serverTimestamp(),
    });
  });
  const parent = env.authenticatedContext("up1", { phone_number: PARENT }).firestore();
  await assertFails(getDoc(doc(parent, "helpRequests/h1")));
  await assertFails(setDoc(doc(parent, "helpRequests/h2"), { message: "x" }));
  const team = env.authenticatedContext("owner", { admin: true }).firestore();
  await assertSucceeds(getDoc(doc(team, "helpRequests/h1")));
  await assertFails(updateDoc(doc(team, "helpRequests/h1"), { message: "changed" }));
  await assertSucceeds(updateDoc(doc(team, "helpRequests/h1"), { status: "done", closedBy: "owner", closedAt: serverTimestamp() }));
});
