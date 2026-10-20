import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, getBytes, uploadBytes } from "firebase/storage";
import { PROJECT_ID } from "./helpers.ts";

let env: RulesTestEnvironment;
const rules = (file: string) => readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const [stHost, stPort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199").split(":");

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: rules("firestore.rules"), host: fsHost!, port: Number(fsPort) },
    storage: { rules: rules("storage.rules"), host: stHost!, port: Number(stPort) },
  });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "leads/l1"), { status: "new", parentName: "A", parentPhoneE164: "+919876543210", consent: { by: "parent" } });
    await setDoc(doc(ctx.firestore(), "consentLog/c1"), { subjectId: "l1" });
    await setDoc(doc(ctx.firestore(), "leadDedupe/h1"), { leadId: "l1" });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const user = () => env.authenticatedContext("u1").firestore();
const admin = () => env.authenticatedContext("owner", { admin: true }).firestore();

test("visitors and ordinary signed-in users can neither read nor write anything", async () => {
  for (const db of [anon(), user()]) {
    await assertFails(getDoc(doc(db, "leads/l1")));
    await assertFails(setDoc(doc(db, "leads/new"), { status: "new" }));
    await assertFails(getDoc(doc(db, "consentLog/c1")));
    await assertFails(getDoc(doc(db, "leadDedupe/h1")));
    await assertFails(setDoc(doc(db, "anything/x"), { a: 1 }));
  }
});

test("admin can read leads, move only the status, and delete them", async () => {
  const db = admin();
  await assertSucceeds(getDoc(doc(db, "leads/l1")));
  await assertSucceeds(updateDoc(doc(db, "leads/l1"), { status: "contacted", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "leads/l1"), { status: "hacked", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "leads/l1"), { parentPhoneE164: "+910000000000", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "leads/l1"), { status: "contacted", consent: {}, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "leads/l2"), { status: "new" }));
  // Spam and duplicates can be deleted; the consent record stays in consentLog.
  await assertSucceeds(deleteDoc(doc(db, "leads/l1")));
});

test("admin can add notes as themselves; consent log is read-only", async () => {
  const db = admin();
  await assertSucceeds(addDoc(collection(db, "leads/l1/notes"), { text: "Called, demo Tuesday", by: "owner", createdAt: serverTimestamp() }));
  await assertFails(addDoc(collection(db, "leads/l1/notes"), { text: "x", by: "someone-else", createdAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(db, "consentLog/c1")));
  await assertFails(setDoc(doc(db, "consentLog/c2"), { subjectId: "l1" }));
  await assertFails(getDoc(doc(db, "leadDedupe/h1")));
});

test("storage: public variants readable, originals admin-only with size and type limits", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), "public/teachers/t1/400.webp"), new Uint8Array([1]));
    await uploadBytes(ref(ctx.storage(), "private/consent/f1.pdf"), new Uint8Array([1]));
  });
  const anonStorage = env.unauthenticatedContext().storage();
  const adminStorage = env.authenticatedContext("owner", { admin: true }).storage();
  await assertSucceeds(getBytes(ref(anonStorage, "public/teachers/t1/400.webp")));
  await assertFails(getBytes(ref(anonStorage, "private/consent/f1.pdf")));
  await assertFails(uploadBytes(ref(anonStorage, "public/teachers/t1/x.webp"), new Uint8Array([1])));
  await assertSucceeds(getBytes(ref(adminStorage, "private/consent/f1.pdf")));
  await assertSucceeds(uploadBytes(ref(adminStorage, "originals/teachers/t1/a.jpg"), new Uint8Array([1]), { contentType: "image/jpeg" }));
  await assertFails(uploadBytes(ref(adminStorage, "originals/teachers/t1/a.exe"), new Uint8Array([1]), { contentType: "application/octet-stream" }));
  await assertFails(uploadBytes(ref(adminStorage, "originals/students/s1/a.jpg"), new Uint8Array([1]), { contentType: "image/jpeg" }));
});
