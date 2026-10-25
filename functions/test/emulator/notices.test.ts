import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, type DocumentData,
} from "firebase/firestore";
import { PROJECT_ID, freshDatabase } from "./helpers.ts";

// Homework and notices: the batch's teacher posts, the batch's families read, a parent ticks Done only for
// their own child, and the teacher counts who is done.

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
    await setDoc(doc(db, "students/s1"), { name: "Aarav", nameKey: "aarav", parentPhone: PARENT, batchIds: ["b1"], active: true });
    await setDoc(doc(db, "students/s2"), { name: "Diya", nameKey: "diya", parentPhone: OTHER_PARENT, batchIds: ["b3"], active: true });
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT });
    await setDoc(doc(db, "progress/s2"), { parentPhone: OTHER_PARENT });
    await setDoc(doc(db, "batchAccess/b1"), { parentPhones: [PARENT] });
    await setDoc(doc(db, "batchAccess/b3"), { parentPhones: [OTHER_PARENT] });
  });
});

const as = (uid: string, phone: string) => env.authenticatedContext(uid, { phone_number: phone }).firestore();
const homework = (uid: string, over: DocumentData = {}) => ({
  batchId: "b1", batchName: "Class 7 Maths A", subject: "Maths", kind: "homework", title: "Ex 5.2, Q1 to Q10",
  body: "Show working.", due: "2026-10-27", teacherName: "Priya Ma'am", createdBy: uid, createdAt: serverTimestamp(), ...over,
});

test("only the batch's teacher (or the team) posts, with a valid notice", async () => {
  const teacher = as("ut1", TEACHER);
  await assertSucceeds(setDoc(doc(teacher, "notices/n1"), homework("ut1")));
  const { due: _due, ...notice } = homework("ut1", { kind: "notice", title: "No class on Friday", body: "" });
  await assertSucceeds(setDoc(doc(teacher, "notices/n2"), notice));
  await assertFails(setDoc(doc(teacher, "notices/n2b"), { ...notice, due: "2026-10-27" })); // a notice has no due date
  await assertFails(setDoc(doc(as("ut2", OTHER_TEACHER), "notices/n3"), homework("ut2")));
  await assertFails(setDoc(doc(as("up1", PARENT), "notices/n4"), homework("up1")));
  await assertFails(setDoc(doc(teacher, "notices/n5"), homework("ut1", { title: "" })));
  await assertFails(setDoc(doc(teacher, "notices/n6"), homework("ut1", { due: "next week" })));
  await assertFails(setDoc(doc(teacher, "notices/n7"), homework("ut1", { createdBy: "someone-else" })));
  await assertFails(setDoc(doc(teacher, "notices/n8"), homework("ut1", { extra: true })));
  await assertFails(setDoc(doc(teacher, "notices/n9"), homework("ut1", { body: "x".repeat(601) })));
  const team = env.authenticatedContext("owner", { admin: true }).firestore();
  await assertSucceeds(setDoc(doc(team, "notices/n10"), homework("owner")));
});

test("the batch's families read it; other families and teachers don't; the teacher deletes it", async () => {
  await assertSucceeds(setDoc(doc(as("ut1", TEACHER), "notices/n1"), homework("ut1")));
  const parent = as("up1", PARENT);
  await assertSucceeds(getDoc(doc(parent, "notices/n1")));
  await assertSucceeds(getDocs(query(collection(parent, "notices"), where("batchId", "==", "b1"))));
  await assertFails(getDoc(doc(as("up2", OTHER_PARENT), "notices/n1")));
  await assertFails(getDocs(query(collection(as("up2", OTHER_PARENT), "notices"), where("batchId", "==", "b1"))));
  await assertFails(getDoc(doc(as("ut2", OTHER_TEACHER), "notices/n1")));
  await assertFails(deleteDoc(doc(parent, "notices/n1")));
  await assertFails(setDoc(doc(as("ut1", TEACHER), "notices/n1"), { title: "changed" }, { merge: true }));
  await assertSucceeds(deleteDoc(doc(as("ut1", TEACHER), "notices/n1")));
});

test("a parent ticks Done only for their own child; the teacher counts who is done", async () => {
  await assertSucceeds(setDoc(doc(as("ut1", TEACHER), "notices/n1"), homework("ut1")));
  const parent = as("up1", PARENT);
  const tick = (db: typeof parent, student: string, uid: string) =>
    setDoc(doc(db, `notices/n1/done/${student}`), { at: serverTimestamp(), by: uid });
  await assertSucceeds(tick(parent, "s1", "up1"));
  await assertSucceeds(getDoc(doc(parent, "notices/n1/done/s1")));
  await assertFails(tick(as("up2", OTHER_PARENT), "s1", "up2"));
  await assertFails(tick(as("up2", OTHER_PARENT), "s2", "up2")); // Diya is not in this batch
  await assertFails(getDocs(collection(parent, "notices/n1/done")));
  await assertSucceeds(getDocs(collection(as("ut1", TEACHER), "notices/n1/done")));
  await assertSucceeds(deleteDoc(doc(parent, "notices/n1/done/s1")));
});

test("a notice (not homework) can't be ticked", async () => {
  const teacher = as("ut1", TEACHER);
  const { due: _due, ...notice } = homework("ut1", { kind: "notice", title: "No class on Friday" });
  await assertSucceeds(setDoc(doc(teacher, "notices/n2"), notice));
  await assertFails(setDoc(doc(as("up1", PARENT), "notices/n2/done/s1"), { at: serverTimestamp(), by: "up1" }));
});
