import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, type DocumentData,
} from "firebase/firestore";
import { PROJECT_ID, freshDatabase, paidPlan, plansBuilt } from "./helpers.ts";

// Fees by UPI: the team creates fees and marks them paid; a family reads only their own child's fees and can
// only say "paid" with a UPI reference. Coupons stay secret and are applied by the applyCoupon function.

let env: RulesTestEnvironment;
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");

const TEACHER = "+919811111111";
const OTHER_TEACHER = "+919822222222";
const PARENT = "+919833333333";
const OTHER_PARENT = "+919855555555";

before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT_ID, firestore: { rules, host: fsHost!, port: Number(fsPort) } });
});
after(() => env.cleanup());

beforeEach(async () => {
  await freshDatabase(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const batch = (id: string, over: DocumentData) => setDoc(doc(db, "batches", id), {
      classLevel: "7", board: "CBSE", active: true, schedule: "", ...over,
    });
    await setDoc(doc(db, "teachers/t1"), { name: "Priya Ma'am", nameKey: "priya ma'am", phone: TEACHER, subjects: ["Maths"], active: true });
    await setDoc(doc(db, "teachers/t2"), { name: "Ravi Sir", nameKey: "ravi sir", phone: OTHER_TEACHER, subjects: ["Science"], active: true });
    await batch("b1", { name: "Class 7 Maths A", subject: "Maths", teacherId: "t1", teacherPhone: TEACHER, roster: [{ id: "s1", name: "Aarav" }], studentIds: ["s1"] });
    await batch("b3", { name: "Class 8 Maths B", subject: "Maths", teacherId: "t2", teacherPhone: OTHER_TEACHER, roster: [{ id: "s2", name: "Diya" }], studentIds: ["s2"] });
    await setDoc(doc(db, "fees/plan-s1"), paidPlan("s1"));
    await setDoc(doc(db, "fees/plan-s2"), paidPlan("s2"));
    await setDoc(doc(db, "students/s1"), { name: "Aarav", nameKey: "aarav", parentPhone: PARENT, batchIds: ["b1"], active: true });
    await setDoc(doc(db, "students/s2"), { name: "Diya", nameKey: "diya", parentPhone: OTHER_PARENT, batchIds: ["b3"], active: true });
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT });
    await setDoc(doc(db, "progress/s2"), { parentPhone: OTHER_PARENT });
    await setDoc(doc(db, "batchAccess/b1"), { parentPhones: [PARENT] });
    await setDoc(doc(db, "batchAccess/b3"), { parentPhones: [OTHER_PARENT] });
  });
  await plansBuilt(["s1", "s2"]);
});

const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";
const as = (uid: string, phone: string) => env.authenticatedContext(uid, { phone_number: phone }).firestore();
const team = () => env.authenticatedContext("owner", { admin: true }).firestore();
const fee = (over: DocumentData = {}) => ({
  studentId: "s1", studentName: "Aarav", batchId: "b1", title: "November fees", amount: 3000, discount: 0, payable: 3000,
  due: "2026-11-05", status: "due", createdBy: "owner", createdAt: serverTimestamp(), ...over,
});
const paid = (uid: string, over: DocumentData = {}) => ({
  status: "submitted", utr: "412345678901", submittedBy: uid, submittedAt: serverTimestamp(), ...over,
});
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
async function applyCoupon(data: unknown, who: { uid: string; phone: string }) {
  const res = await fetch(`http://${functionsHost}/${PROJECT_ID}/asia-south1/applyCoupon`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(who.uid, { phone_number: who.phone })}` },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as { result?: Record<string, unknown>; error?: { status: string; message: string } };
}

test("only the team creates fees, with a sensible amount", async () => {
  await assertSucceeds(setDoc(doc(team(), "fees/f1"), fee()));
  await assertFails(setDoc(doc(as("up1", PARENT), "fees/f2"), fee({ createdBy: "up1" })));
  await assertFails(setDoc(doc(team(), "fees/f3"), fee({ amount: 0, payable: 0 })));
  await assertFails(setDoc(doc(team(), "fees/f4"), fee({ amount: 2500.5, payable: 2500.5 })));
  await assertFails(setDoc(doc(team(), "fees/f5"), fee({ discount: 500, payable: 2500 })));
  await assertFails(setDoc(doc(team(), "fees/f6"), fee({ status: "paid" })));
  await assertFails(setDoc(doc(team(), "fees/f7"), fee({ studentId: "nobody" })));
});

test("a family sees only their own child's fees", async () => {
  await assertSucceeds(setDoc(doc(team(), "fees/f1"), fee()));
  await assertSucceeds(getDocs(query(collection(as("up1", PARENT), "fees"), where("studentId", "==", "s1"))));
  await assertFails(getDocs(query(collection(as("up2", OTHER_PARENT), "fees"), where("studentId", "==", "s1"))));
  await assertFails(getDoc(doc(as("ut1", TEACHER), "fees/f1")));
});

test("a family only says it's paid, with a UPI reference; the team confirms", async () => {
  await assertSucceeds(setDoc(doc(team(), "fees/f1"), fee()));
  const parent = as("up1", PARENT);
  await assertFails(updateDoc(doc(parent, "fees/f1"), paid("up1", { utr: "12 34" })));
  await assertFails(updateDoc(doc(parent, "fees/f1"), paid("up1", { status: "paid" })));
  await assertFails(updateDoc(doc(parent, "fees/f1"), { payable: 1 }));
  await assertFails(updateDoc(doc(as("up2", OTHER_PARENT), "fees/f1"), paid("up2")));
  await assertSucceeds(updateDoc(doc(parent, "fees/f1"), paid("up1")));
  await assertFails(updateDoc(doc(parent, "fees/f1"), paid("up1", { utr: "999999999999" }))); // already sent
  await assertFails(updateDoc(doc(team(), "fees/f1"), { status: "paid", paidAt: serverTimestamp(), paidBy: "owner", amount: 1 }));
  await assertSucceeds(updateDoc(doc(team(), "fees/f1"), { status: "paid", paidAt: serverTimestamp(), paidBy: "owner" }));
  await assertFails(deleteDoc(doc(team(), "fees/f1"))); // a paid fee stays on record
});

test("coupons are the team's; the UPI details are readable once signed in", async () => {
  const coupon = { percent: 10, maxUses: 0, expires: "", active: true, uses: 0, createdBy: "owner", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(team(), "coupons/DIWALI10"), coupon));
  await assertFails(setDoc(doc(team(), "coupons/diwali"), coupon)); // capitals and digits only
  await assertFails(setDoc(doc(team(), "coupons/HALF"), { ...coupon, percent: 150 }));
  await assertFails(getDoc(doc(as("up1", PARENT), "coupons/DIWALI10")));
  await assertFails(updateDoc(doc(team(), "coupons/DIWALI10"), { uses: 5 }));
  const pay = { upiId: "stoodant@okicici", payeeName: "Stoodant", note: "", updatedBy: "owner", updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(team(), "settings/payments"), pay));
  await assertFails(setDoc(doc(team(), "settings/payments"), { ...pay, upiId: "not a upi id" }));
  await assertSucceeds(getDoc(doc(as("up1", PARENT), "settings/payments")));
  await assertFails(setDoc(doc(as("up1", PARENT), "settings/payments"), { ...pay, updatedBy: "up1" }));
});

test("applyCoupon lowers the family's fee and counts the use; wrong, expired and other families' fail", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "fees/f1"), fee());
    await setDoc(doc(db, "coupons/SAVE10"), { percent: 10, maxUses: 0, uses: 0, expires: "", active: true });
    await setDoc(doc(db, "coupons/HALF"), { percent: 50, maxUses: 1, uses: 0, expires: "", active: true });
    await setDoc(doc(db, "coupons/OLD"), { percent: 20, maxUses: 0, uses: 0, expires: "2020-01-01", active: true });
  });
  const parent = { uid: "up1", phone: PARENT };
  const ok = await applyCoupon({ feeId: "f1", code: "save10" }, parent);
  assert.deepEqual(ok.result, { payable: 2700, discount: 300, percent: 10, code: "SAVE10" });
  assert.equal((await peek("fees/f1"))?.payable, 2700);
  assert.equal((await peek("coupons/SAVE10"))?.uses, 1);

  assert.match(String((await applyCoupon({ feeId: "f1", code: "NOPE1" }, parent)).result?.error), /isn't valid/);
  assert.match(String((await applyCoupon({ feeId: "f1", code: "OLD" }, parent)).result?.error), /expired/);
  assert.equal((await applyCoupon({ feeId: "f1", code: "SAVE10" }, { uid: "up2", phone: OTHER_PARENT })).error?.status, "PERMISSION_DENIED");

  // Swapping codes gives the first one's use back; "" takes the coupon off.
  assert.equal((await applyCoupon({ feeId: "f1", code: "HALF" }, parent)).result?.payable, 1500);
  assert.equal((await peek("coupons/SAVE10"))?.uses, 0);
  assert.equal((await peek("coupons/HALF"))?.uses, 1);
  assert.equal((await applyCoupon({ feeId: "f1", code: "" }, parent)).result?.payable, 3000);
  assert.equal((await peek("coupons/HALF"))?.uses, 0);
});
