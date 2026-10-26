import { after, before, beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, type DocumentData,
} from "firebase/firestore";
import { PROJECT_ID, waitFor, freshDatabase } from "./helpers.ts";

// Doubts: a family asks a teacher of their own child's batch, reads only their child's doubts and can take
// one back until it is answered; the batch's teacher answers. The functions fill in the batch details.

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
const question = (uid: string, over: DocumentData = {}) => ({
  batchId: "b1", studentId: "s1", studentName: "Aarav", question: "Why is 0 divided by 5 zero?",
  status: "open", askedBy: uid, createdAt: serverTimestamp(), ...over,
});
const answer = (uid: string, over: DocumentData = {}) => ({
  answer: "Share 0 sweets among 5 friends: each gets 0.", status: "answered", answeredBy: uid, answeredAt: serverTimestamp(), ...over,
});

test("a family asks only for their own child, only in that child's batch", async () => {
  const parent = as("up1", PARENT);
  await assertSucceeds(setDoc(doc(parent, "doubts/d1"), question("up1")));
  await assertFails(setDoc(doc(parent, "doubts/d2"), question("up1", { studentId: "s2", batchId: "b3" }))); // not their child
  await assertFails(setDoc(doc(parent, "doubts/d3"), question("up1", { batchId: "b3" }))); // Aarav isn't in b3
  await assertFails(setDoc(doc(parent, "doubts/d4"), question("up1", { question: "" })));
  await assertFails(setDoc(doc(parent, "doubts/d5"), question("up1", { question: "x".repeat(601) })));
  await assertFails(setDoc(doc(parent, "doubts/d6"), question("up1", { status: "answered" })));
  await assertFails(setDoc(doc(parent, "doubts/d7"), question("up1", { teacherName: "made up" })));
  await assertFails(setDoc(doc(parent, "doubts/d8"), question("up1", { askedBy: "someone-else" })));
  await assertFails(setDoc(doc(as("ut1", TEACHER), "doubts/d9"), question("ut1")));
});

test("only the family and the batch's teacher read it", async () => {
  await assertSucceeds(setDoc(doc(as("up1", PARENT), "doubts/d1"), question("up1")));
  await assertSucceeds(getDocs(query(collection(as("up1", PARENT), "doubts"), where("studentId", "==", "s1"))));
  await assertSucceeds(getDocs(query(collection(as("ut1", TEACHER), "doubts"), where("batchId", "==", "b1"))));
  await assertFails(getDoc(doc(as("up2", OTHER_PARENT), "doubts/d1")));
  await assertFails(getDocs(query(collection(as("up2", OTHER_PARENT), "doubts"), where("studentId", "==", "s1"))));
  await assertFails(getDocs(query(collection(as("up1", PARENT), "doubts"), where("batchId", "==", "b1")))); // other children's
  await assertFails(getDocs(query(collection(as("ut2", OTHER_TEACHER), "doubts"), where("batchId", "==", "b1"))));
});

test("the batch's teacher answers; the family can't change the answer", async () => {
  await assertSucceeds(setDoc(doc(as("up1", PARENT), "doubts/d1"), question("up1")));
  await assertFails(updateDoc(doc(as("ut2", OTHER_TEACHER), "doubts/d1"), answer("ut2")));
  await assertFails(updateDoc(doc(as("up1", PARENT), "doubts/d1"), answer("up1")));
  await assertFails(updateDoc(doc(as("ut1", TEACHER), "doubts/d1"), answer("ut1", { answer: "" })));
  await assertFails(updateDoc(doc(as("ut1", TEACHER), "doubts/d1"), answer("ut1", { question: "changed" })));
  await assertSucceeds(updateDoc(doc(as("ut1", TEACHER), "doubts/d1"), answer("ut1")));
  // Answered: the family can no longer take it back.
  await assertFails(deleteDoc(doc(as("up1", PARENT), "doubts/d1")));
});

test("a family takes back an unanswered doubt; others can't", async () => {
  await assertSucceeds(setDoc(doc(as("up1", PARENT), "doubts/d1"), question("up1")));
  await assertFails(deleteDoc(doc(as("up2", OTHER_PARENT), "doubts/d1")));
  await assertFails(deleteDoc(doc(as("ut1", TEACHER), "doubts/d1")));
  await assertSucceeds(deleteDoc(doc(as("up1", PARENT), "doubts/d1")));
});

test("the batch's name, subject and teacher are filled in from the batch", async () => {
  await assertSucceeds(setDoc(doc(as("up1", PARENT), "doubts/d1"), question("up1", { studentName: "aarav typed" })));
  const filled = await waitFor(async () => {
    let data: DocumentData | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      data = (await getDoc(doc(ctx.firestore(), "doubts/d1"))).data();
    });
    return data?.batchName ? data : undefined;
  });
  assert.equal(filled.batchName, "Class 7 Maths A");
  assert.equal(filled.subject, "Maths");
  assert.equal(filled.studentName, "Aarav");
});
