import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ORIGIN, PROJECT_ID, clearFirestore } from "./helpers.ts";

const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` }, "scholarship-test");
const db = getFirestore(app);
after(() => deleteApp(app));
beforeEach(clearFirestore);

const BASE = `http://${process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001"}/${PROJECT_ID}/asia-south1`;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 9)]).toString("base64");
let phones = 0;
/** Each registration needs its own mobile number unless a test says otherwise. */
const nextPhone = () => `98765${String(43210 + phones++).padStart(5, "0")}`;
const body = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(), studentName: "Aarav Sharma", studentClass: "10", dob: "2011-08-05",
  school: "Kendriya Vidyalaya No. 1", city: "Jaipur", pincode: "302001", parentName: "Neha Sharma", phone: nextPhone(),
  photo: jpeg, consent: true, noticeVersion: "2026-11-01", startedAt: Date.now() - 10_000, website: "",
  source: { path: "/scholarship" }, ...overrides,
});
const send = (fn: string, b: unknown) =>
  fetch(`${BASE}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify(b) });
const post = (b: unknown) => send("submitScholarship", b);
const count = async (c: string) => (await db.collection(c).count().get()).data().count;
type Answer = {
  ok: boolean; regNo: string; existing: boolean; studentName: string; studentClass: string;
  payment: { amount: number; status: string; token: string; upi: { upiId: string; payeeName: string } | null };
};

test("a registration gets a number per class, its photo, PIN code, the fee and a consent record", async () => {
  await db.doc("settings/payments").set({ upiId: "stoodant@okaxis", payeeName: "Stoodant" });
  const response = await post(body());
  assert.equal(response.status, 200);
  const json = (await response.json()) as Answer;
  assert.equal(json.regNo, "SS26-10-00001");
  assert.equal(json.existing, false);
  assert.equal(json.studentName, "Aarav Sharma");
  assert.equal(json.payment.amount, 99);
  assert.equal(json.payment.status, "due");
  assert.match(json.payment.token, /^[a-f0-9]{64}$/);
  assert.deepEqual(json.payment.upi, { upiId: "stoodant@okaxis", payeeName: "Stoodant" });
  const reg = await db.doc("scholarshipRegistrations/SS26-10-00001").get();
  assert.equal(reg.get("dob"), "2011-08-05");
  assert.equal(reg.get("pincode"), "302001");
  assert.equal(reg.get("fee"), 99);
  assert.equal(reg.get("payment.status"), "due");
  const [exists] = await getStorage(app).bucket().file(reg.get("photoPath")).exists();
  assert.ok(exists);
  assert.equal(await count("consentLog"), 1);

  const nine = (await (await post(body({ studentName: "Riya Sharma", studentClass: "9" }))).json()) as Answer;
  assert.equal(nine.regNo, "SS26-09-00001");
  const second = (await (await post(body({ studentName: "Kabir Sharma" }))).json()) as Answer;
  assert.equal(second.regNo, "SS26-10-00002");
});

test("one mobile number, one student: same date of birth gets the registration back, another is refused", async () => {
  const phone = nextPhone();
  const first = body({ phone });
  await post(first);
  const retry = (await (await post(first)).json()) as Answer;
  assert.equal(retry.existing, false);
  const back = (await (await post(body({ phone, studentName: "Aarav S" }))).json()) as Answer;
  assert.equal(back.regNo, "SS26-10-00001");
  assert.equal(back.existing, true);
  assert.equal(back.payment.upi, null);

  const sibling = await post(body({ phone, studentName: "Riya Sharma", studentClass: "9", dob: "2012-03-01" }));
  assert.equal(sibling.status, 409);
  assert.deepEqual(await sibling.json(), { error: "phone_taken", fields: ["phone"] });
  assert.equal(await count("scholarshipRegistrations"), 1);
});

test("the fee: a UPI reference marks it submitted, once per reference, and only with the right token", async () => {
  const a = (await (await post(body())).json()) as Answer;
  const b = (await (await post(body({ studentName: "Kabir Sharma" }))).json()) as Answer;

  const wrong = await send("scholarshipPayment", { regNo: a.regNo, token: b.payment.token, utr: "412345678901" });
  assert.equal(wrong.status, 403);

  const paid = await send("scholarshipPayment", { regNo: a.regNo, token: a.payment.token, utr: "412345678901" });
  assert.equal(paid.status, 200);
  assert.deepEqual(await paid.json(), { ok: true, status: "submitted" });
  const reg = await db.doc(`scholarshipRegistrations/${a.regNo}`).get();
  assert.equal(reg.get("payment.status"), "submitted");
  assert.equal(reg.get("payment.utr"), "412345678901");

  const reused = await send("scholarshipPayment", { regNo: b.regNo, token: b.payment.token, utr: "412345678901" });
  assert.equal(reused.status, 409);
  assert.deepEqual(await reused.json(), { error: "utr_used", fields: ["utr"] });

  // The same family sending its reference again (say, a corrected one) is fine.
  const again = await send("scholarshipPayment", { regNo: a.regNo, token: a.payment.token, utr: "412345678902" });
  assert.equal(again.status, 200);

  await db.doc(`scholarshipRegistrations/${a.regNo}`).update({ "payment.status": "paid" });
  const afterPaid = await send("scholarshipPayment", { regNo: a.regNo, token: a.payment.token, utr: "999999999999" });
  assert.deepEqual(await afterPaid.json(), { ok: true, status: "paid" });
});

test("bad photos and bad fields are refused with field names only", async () => {
  const png = Buffer.from("\x89PNG\r\n\x1a\n" + "x".repeat(200)).toString("base64");
  const response = await post(body({ photo: png, studentClass: "8" }));
  assert.equal(response.status, 400);
  assert.deepEqual(((await response.json()) as { fields: string[] }).fields, ["studentClass"]);
  const photoOnly = await post(body({ photo: png }));
  assert.deepEqual(((await photoOnly.json()) as { fields: string[] }).fields, ["photo"]);
  const pin = await post(body({ pincode: "12345", city: "Sector 9" }));
  assert.deepEqual(((await pin.json()) as { fields: string[] }).fields.sort(), ["city", "pincode"]);
  assert.equal(await count("scholarshipRegistrations"), 0);
});
