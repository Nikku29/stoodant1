import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, type DocumentData } from "firebase/firestore";
import { PROJECT_ID, freshDatabase, istToday, paidPlan, waitFor } from "./helpers.ts";
import { addDays, addMonths } from "../../src/billing/period.ts";

// Monthly plans: a family picks how many months, pays by UPI and sends the reference; classes open while the
// payment is checked and stay open until the paid-until date. Only families with an open plan are let into
// their child's batches (batchAccess), which is what study material, notices and live classes check.

let env: RulesTestEnvironment;
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

const PARENT = "+919833333333";
const NEW_PARENT = "+919844444444";
const OTHER_PARENT = "+919855555555";

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules, host: fsHost!, port: Number(fsPort) } });
});
after(() => env.cleanup());

const student = (name: string, parentPhone: string, over: DocumentData = {}) => ({
  name, nameKey: name.toLowerCase(), classLevel: "7", board: "CBSE", parentName: "Anita", parentPhone,
  batchIds: ["b1"], whatsappOptIn: true, active: true, ...over,
});

beforeEach(async () => {
  await freshDatabase(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "batches/b1"), {
      name: "Class 7 Maths A", classLevel: "7", board: "CBSE", subject: "Maths", teacherId: "t1", schedule: "", active: true,
      roster: [], studentIds: [],
    });
    await setDoc(doc(db, "settings/payments"), { upiId: "stoodant@okaxis", payeeName: "Stoodant", note: "", planOff: { "3": 10 } });
    await setDoc(doc(db, "fees/plan-s1"), paidPlan("s1"));
    // s1 has paid; s3 is new (fee set, nothing paid yet).
    await setDoc(doc(db, "students/s1"), student("Aarav", PARENT, { monthlyFee: 3000 }));
    await setDoc(doc(db, "students/s3"), student("Kabir", NEW_PARENT, { monthlyFee: 3000 }));
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT, student: { id: "s1", batches: [{ id: "b1", name: "Class 7 Maths A", subject: "Maths" }], subjects: ["Maths"] } });
    await setDoc(doc(db, "progress/s3"), { parentPhone: NEW_PARENT, student: { id: "s3", batches: [{ id: "b1", name: "Class 7 Maths A", subject: "Maths" }], subjects: ["Maths"] } });
  });
  // The triggers build both plans and the batch's roster.
  await waitFor(async () => ((await peek("billing/s1"))?.open === true && (await peek("billing/s3")) ? true : undefined), 15_000);
});

const as = (uid: string, phone: string) => env.authenticatedContext(uid, { phone_number: phone }).firestore();
const team = () => env.authenticatedContext("owner", { admin: true }).firestore();
async function peek(path: string) {
  let data: DocumentData | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), path))).data();
  });
  return data;
}
function token(uid: string, claims: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT_ID}`, aud: PROJECT_ID, sub: uid, user_id: uid,
    iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: "phone", identities: {} }, ...claims,
  })}.`;
}
async function call(name: string, data: unknown, claims: Record<string, unknown>) {
  const res = await fetch(`http://${functionsHost}/${PROJECT_ID}/asia-south1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(String(claims.uid ?? "u"), claims)}` },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as { result?: Record<string, unknown>; error?: { status: string; message: string } };
}
const phones = async () => ((await peek("batchAccess/b1"))?.parentPhones ?? []) as string[];

test("only the family and the team read a child's plan; nobody writes it", async () => {
  const s1 = await peek("billing/s1");
  assert.equal(s1?.status, "active");
  assert.equal(s1?.paidUntil, addDays(addMonths(istToday(), 1), -1));
  await assertSucceeds(getDoc(doc(as("up1", PARENT), "billing/s1")));
  await assertFails(getDoc(doc(as("up2", OTHER_PARENT), "billing/s1")));
  await assertSucceeds(getDoc(doc(team(), "billing/s1")));
  await assertFails(setDoc(doc(as("up1", PARENT), "billing/s1"), { open: true }));
  await assertFails(setDoc(doc(team(), "billing/s1"), { open: true }));
  // The team sets a monthly fee (whole rupees); the 3/6/12-month discounts take only those keys.
  await assertFails(updateDoc(doc(team(), "students/s3"), { monthlyFee: 2999.5, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(team(), "settings/payments"), {
    upiId: "stoodant@okaxis", payeeName: "Stoodant", note: "", planOff: { "2": 10 }, updatedBy: "owner", updatedAt: serverTimestamp(),
  }));
});

test("a new family is kept out until they pay; checking opens classes, the team's OK sets the dates", async () => {
  assert.deepEqual(await phones(), [PARENT]);
  assert.equal((await peek("billing/s3"))?.status, "new");
  assert.equal((await peek("billing/s3"))?.open, false);

  // Someone else's child, and a plan length that isn't offered, are refused.
  const kabir = { uid: "up3", phone_number: NEW_PARENT };
  assert.equal((await call("startPayment", { studentId: "s1", months: 1 }, kabir)).error?.status, "PERMISSION_DENIED");
  assert.equal((await call("startPayment", { studentId: "s3", months: 2 }, kabir)).error?.status, "INVALID_ARGUMENT");

  const first = await call("startPayment", { studentId: "s3", months: 1 }, kabir);
  const feeId = String(first.result?.feeId);
  assert.equal((await peek(`fees/${feeId}`))?.amount, 3000);
  // Choosing 3 months changes the same payment, with the team's 10% off for paying ahead.
  const three = await call("startPayment", { studentId: "s3", months: 3 }, kabir);
  assert.equal(three.result?.feeId, feeId);
  const fee = await peek(`fees/${feeId}`);
  assert.deepEqual([fee?.months, fee?.listAmount, fee?.planPercent, fee?.payable], [3, 9000, 10, 8100]);
  assert.equal(fee?.classLevel, "7");
  assert.deepEqual(fee?.subjects, ["Maths"]);

  // The family says it's paid, from the number they logged in with.
  const family = as("up3", NEW_PARENT);
  const sent = { status: "submitted", utr: "412345678901", submittedBy: "up3", submittedAt: serverTimestamp() };
  await assertFails(updateDoc(doc(family, `fees/${feeId}`), { ...sent, submittedPhone: OTHER_PARENT }));
  await assertSucceeds(updateDoc(doc(family, `fees/${feeId}`), { ...sent, submittedPhone: NEW_PARENT }));
  await waitFor(async () => ((await peek("billing/s3"))?.status === "checking" ? true : undefined));
  await waitFor(async () => ((await phones()).includes(NEW_PARENT) ? true : undefined));
  // Another payment can't be started while this one is checked.
  assert.equal((await call("startPayment", { studentId: "s3", months: 1 }, kabir)).error?.status, "FAILED_PRECONDITION");

  await assertSucceeds(updateDoc(doc(team(), `fees/${feeId}`), { status: "paid", note: "", paidAt: serverTimestamp(), paidBy: "owner" }));
  const plan = await waitFor(async () => {
    const b = await peek("billing/s3");
    return b?.status === "active" ? b : undefined;
  });
  assert.equal(plan.paidUntil, addDays(addMonths(istToday(), 3), -1));
  assert.equal((await peek(`fees/${feeId}`))?.periodTo, plan.paidUntil);
});

test("a payment that isn't found closes classes again; the team can record cash or free months", async () => {
  const kabir = { uid: "up3", phone_number: NEW_PARENT };
  const feeId = String((await call("startPayment", { studentId: "s3", months: 1 }, kabir)).result?.feeId);
  await assertSucceeds(updateDoc(doc(as("up3", NEW_PARENT), `fees/${feeId}`), {
    status: "submitted", utr: "412345678901", submittedBy: "up3", submittedAt: serverTimestamp(),
  }));
  await waitFor(async () => ((await phones()).includes(NEW_PARENT) ? true : undefined));
  await assertSucceeds(updateDoc(doc(team(), `fees/${feeId}`), { status: "due", note: "Not found" }));
  await waitFor(async () => ((await phones()).includes(NEW_PARENT) ? undefined : true));
  assert.equal((await peek("billing/s3"))?.status, "new");

  // Only the team records payments made another way.
  const cash = { studentId: "s3", months: 2, amount: 6000, payDay: istToday(), method: "cash", note: "Paid at the centre" };
  assert.equal((await call("recordPayment", cash, { uid: "up3", phone_number: NEW_PARENT })).error?.status, "PERMISSION_DENIED");
  assert.equal((await call("recordPayment", { ...cash, payDay: addDays(istToday(), 1) }, { uid: "owner", admin: true })).error?.status, "INVALID_ARGUMENT");
  assert.ok((await call("recordPayment", cash, { uid: "owner", admin: true })).result?.feeId);
  const plan = await waitFor(async () => {
    const b = await peek("billing/s3");
    return b?.open === true ? b : undefined;
  });
  assert.equal(plan.paidUntil, addDays(addMonths(istToday(), 2), -1));
  await waitFor(async () => ((await phones()).includes(NEW_PARENT) ? true : undefined));
});

test("a family can't start paying before the team sets the monthly fee", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "students/s3"), { monthlyFee: 0 });
  });
  const r = await call("startPayment", { studentId: "s3", months: 1 }, { uid: "up3", phone_number: NEW_PARENT });
  assert.equal(r.error?.status, "FAILED_PRECONDITION");
  assert.match(String(r.error?.message), /isn't set up/);
});
