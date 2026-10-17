import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PROJECT_ID, clearFirestore, leadBody, postLead, waitFor } from "./helpers.ts";

const app = initializeApp({ projectId: PROJECT_ID }, "submit-lead-test");
const db = getFirestore(app);
after(() => deleteApp(app));
beforeEach(clearFirestore);

const count = async (collection: string) => (await db.collection(collection).count().get()).data().count;

test("a valid request creates one lead, a dedupe entry and a consent record", async () => {
  const body = leadBody({ phone: "+91 98765 43210" });
  const response = await postLead(body);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.deepEqual(JSON.parse(text), { ok: true });
  assert.ok(!text.includes("98765"), "response must not echo personal data");

  const lead = await db.doc(`leads/${body.idempotencyKey}`).get();
  assert.ok(lead.exists);
  assert.equal(lead.get("parentPhoneE164"), "+919876543210");
  assert.equal(lead.get("status"), "new");
  assert.equal(lead.get("consent.noticeVersion"), "2026-10-17");
  assert.equal(lead.get("studentName"), undefined);
  const days = (lead.get("retainUntil").toMillis() - lead.get("createdAt").toMillis()) / 86_400_000;
  assert.equal(Math.round(days), 90);
  assert.equal(await count("consentLog"), 1);
  assert.equal(await count("leadDedupe"), 1);
});

test("retrying with the same idempotency key does not create a second lead", async () => {
  const body = leadBody();
  assert.equal((await postLead(body)).status, 200);
  assert.equal((await postLead(body)).status, 200);
  assert.equal(await count("leads"), 1);
  assert.equal((await db.doc(`leads/${body.idempotencyKey}`).get()).get("submitCount"), 1);
});

test("the same phone within 24 hours is merged into the first lead", async () => {
  const first = leadBody({ phone: "9123456789" });
  await postLead(first);
  assert.equal((await postLead(leadBody({ phone: "09123456789", parentName: "A Sharma" }))).status, 200);
  assert.equal(await count("leads"), 1);
  assert.equal((await db.doc(`leads/${first.idempotencyKey}`).get()).get("submitCount"), 2);
  assert.equal(await count("consentLog"), 2);
});

test("honeypot and too-fast submits look successful but store nothing", async () => {
  assert.equal((await postLead(leadBody({ website: "http://spam.example" }))).status, 200);
  assert.equal((await postLead(leadBody({ startedAt: Date.now() - 500 }))).status, 200);
  assert.equal(await count("leads"), 0);
});

test("invalid input returns field names only", async () => {
  const response = await postLead(leadBody({ phone: "12345", studentClass: "12" }));
  assert.equal(response.status, 400);
  const json = await response.json() as { fields: string[] };
  assert.deepEqual(json.fields.sort(), ["phone", "studentClass"]);
  assert.equal(await count("leads"), 0);
});

test("wrong method, unknown origin and missing origin are refused", async () => {
  assert.equal((await postLead(undefined, { method: "GET" })).status, 405);
  assert.equal((await postLead(leadBody(), { origin: "https://evil.example" })).status, 403);
  assert.equal((await postLead(leadBody(), { origin: null })).status, 403);
  assert.equal(await count("leads"), 0);
});

test("more than 5 submits in 10 minutes from one address are rate limited", async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await postLead(leadBody({ phone: `98765432${10 + i}` }))).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  assert.equal(await count("leads"), 5);
});

test("a new lead gets its alert outcome recorded (channels off in the emulator)", async () => {
  const body = leadBody({ phone: "9988776655" });
  await postLead(body);
  const alerts = await waitFor(async () => (await db.doc(`leads/${body.idempotencyKey}`).get()).get("alerts"));
  assert.equal(alerts.email, "skipped");
  assert.equal(alerts.whatsapp, "skipped");
});
