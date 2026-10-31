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

const URL = `http://${process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001"}/${PROJECT_ID}/asia-south1/submitScholarship`;
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500, 9)]).toString("base64");
const body = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(), studentName: "Aarav Sharma", studentClass: "10", dob: "2011-08-05",
  school: "Kendriya Vidyalaya No. 1", city: "Jaipur", parentName: "Neha Sharma", phone: "9876543210",
  photo: jpeg, consent: true, noticeVersion: "2026-10-31", startedAt: Date.now() - 10_000, website: "",
  source: { path: "/scholarship" }, ...overrides,
});
const post = (b: unknown) => fetch(URL, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify(b) });
const count = async (c: string) => (await db.collection(c).count().get()).data().count;

test("a registration gets a number per class, its photo and a consent record", async () => {
  const response = await post(body());
  assert.equal(response.status, 200);
  const json = (await response.json()) as { regNo: string; existing: boolean };
  assert.deepEqual(json, { ok: true, regNo: "SS26-10-00001", existing: false });
  const reg = await db.doc("scholarshipRegistrations/SS26-10-00001").get();
  assert.equal(reg.get("parentPhoneE164"), "+919876543210");
  assert.equal(reg.get("dob"), "2011-08-05");
  const [exists] = await getStorage(app).bucket().file(reg.get("photoPath")).exists();
  assert.ok(exists);
  assert.equal(await count("consentLog"), 1);

  const nine = (await (await post(body({ studentName: "Riya Sharma", studentClass: "9" }))).json()) as { regNo: string };
  assert.equal(nine.regNo, "SS26-09-00001");
  const second = (await (await post(body({ studentName: "Kabir Sharma" }))).json()) as { regNo: string };
  assert.equal(second.regNo, "SS26-10-00002");
});

test("the same child twice gets the first number back; a retry writes nothing", async () => {
  const first = body();
  await post(first);
  await post(first);
  const again = (await (await post(body({ studentName: "  aarav  SHARMA " }))).json()) as { regNo: string; existing: boolean };
  assert.deepEqual(again, { ok: true, regNo: "SS26-10-00001", existing: true });
  assert.equal(await count("scholarshipRegistrations"), 1);
});

test("bad photos and bad fields are refused with field names only", async () => {
  const png = Buffer.from("\x89PNG\r\n\x1a\n" + "x".repeat(200)).toString("base64");
  const response = await post(body({ photo: png, studentClass: "8" }));
  assert.equal(response.status, 400);
  assert.deepEqual(((await response.json()) as { fields: string[] }).fields, ["studentClass"]);
  const photoOnly = await post(body({ photo: png }));
  assert.deepEqual(((await photoOnly.json()) as { fields: string[] }).fields, ["photo"]);
  assert.equal(await count("scholarshipRegistrations"), 0);
});
