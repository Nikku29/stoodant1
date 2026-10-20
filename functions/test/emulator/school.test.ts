import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, type DocumentSnapshot, type Firestore,
} from "firebase/firestore";
import { PROJECT_ID, waitFor } from "./helpers.ts";

let env: RulesTestEnvironment;
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");

const TEACHER = "+919811111111";
const OTHER_TEACHER = "+919822222222";
const PARENT = "+919833333333";

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: fsHost!, port: Number(fsPort) },
  });
});
after(() => env.cleanup());

// Seeded already consistent with what the triggers derive, so they find nothing to change mid-test.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "teachers/t1"), { name: "Priya Ma'am", phone: TEACHER, subjects: ["Maths"], active: true });
    await setDoc(doc(db, "teachers/t2"), { name: "Ravi Sir", phone: OTHER_TEACHER, subjects: ["Science"], active: true });
    await setDoc(doc(db, "students/s1"), {
      name: "Aarav", classLevel: "7", board: "CBSE", parentName: "Anita", parentPhone: PARENT,
      batchIds: ["b1"], whatsappOptIn: true, active: true,
    });
    await setDoc(doc(db, "batches/b1"), {
      name: "Class 7 Maths A", classLevel: "7", board: "CBSE", subject: "Maths", teacherId: "t1", schedule: "Mon Wed 5pm",
      active: true, teacherPhone: TEACHER, teacherName: "Priya Ma'am", roster: [{ id: "s1", name: "Aarav" }], studentIds: ["s1"],
    });
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT, student: { id: "s1", name: "Aarav" }, attendance: [], tests: [], notes: [] });
  });
});

/** Reads past the rules (withSecurityRulesDisabled itself resolves to nothing). */
async function peek(path: string) {
  let snap: DocumentSnapshot | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    snap = await getDoc(doc(ctx.firestore(), path));
  });
  return snap!;
}

const phoneUser = (uid: string, phone_number: string) => env.authenticatedContext(uid, { phone_number }).firestore();
const teacher = () => phoneUser("ut1", TEACHER);
const otherTeacher = () => phoneUser("ut2", OTHER_TEACHER);
const parent = () => phoneUser("up1", PARENT);
const admin = () => env.authenticatedContext("owner", { admin: true, email: "owner@example.com" }).firestore();
const stranger = () => phoneUser("ux", "+919844444444");

const session = (db: Firestore, overrides: Record<string, unknown> = {}, uid = "ut1") =>
  setDoc(doc(db, "sessions/b1_2026-10-20"), {
    batchId: "b1", subject: "Maths", date: "2026-10-20", status: "held", attendance: { s1: "present" },
    markedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
  });

test("a teacher sees only their own batches, and never parents' details", async () => {
  await assertSucceeds(getDocs(query(collection(teacher(), "batches"), where("teacherPhone", "==", TEACHER))));
  await assertSucceeds(getDoc(doc(teacher(), "batches/b1")));
  await assertFails(getDoc(doc(otherTeacher(), "batches/b1")));
  await assertFails(getDocs(collection(teacher(), "batches")));
  await assertFails(getDoc(doc(teacher(), "students/s1")));
  await assertFails(getDoc(doc(teacher(), "progress/s1")));
  await assertFails(updateDoc(doc(teacher(), "batches/b1"), { name: "Mine" }));
});

test("a teacher marks attendance for their batch only, with children from its roster", async () => {
  await assertSucceeds(session(teacher()));
  await assertSucceeds(updateDoc(doc(teacher(), "sessions/b1_2026-10-20"), { attendance: { s1: "absent" }, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDocs(query(collection(teacher(), "sessions"), where("batchId", "==", "b1"))));
  await assertFails(session(otherTeacher(), {}, "ut2"));
  await assertFails(session(teacher(), { attendance: { s1: "present", sX: "present" } }));
  await assertFails(session(teacher(), { subject: "Science" }));
  await assertFails(setDoc(doc(teacher(), "sessions/b1_2026-10-21"), {
    batchId: "b1", subject: "Maths", date: "2026-10-20", status: "held", attendance: {}, markedBy: "ut1",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertFails(deleteDoc(doc(teacher(), "sessions/b1_2026-10-20")));
  await assertFails(getDoc(doc(otherTeacher(), "sessions/b1_2026-10-20")));
});

test("a teacher can't edit a class record after two days", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "sessions/b1_2026-10-01"), {
      batchId: "b1", subject: "Maths", date: "2026-10-01", status: "held", attendance: { s1: "present" },
      markedBy: "ut1", createdAt: new Date(Date.now() - 3 * 86_400_000), updatedAt: new Date(),
    });
  });
  await assertFails(updateDoc(doc(teacher(), "sessions/b1_2026-10-01"), { attendance: { s1: "absent" }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(admin(), "sessions/b1_2026-10-01"), { attendance: { s1: "absent" }, markedBy: "owner", updatedAt: serverTimestamp() }));
});

test("a teacher enters marks and notes with checked shapes", async () => {
  const marks = { batchId: "b1", subject: "Maths", title: "Fractions quiz", date: "2026-10-20", max: 20, scores: { s1: 17 }, enteredBy: "ut1", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(teacher(), "assessments/a1"), marks));
  await assertFails(setDoc(doc(teacher(), "assessments/a2"), { ...marks, max: 0 }));
  await assertFails(setDoc(doc(teacher(), "assessments/a3"), { ...marks, scores: {} }));
  await assertFails(setDoc(doc(otherTeacher(), "assessments/a4"), { ...marks, enteredBy: "ut2" }));
  const note = { batchId: "b1", studentId: "s1", subject: "Maths", lines: ["Asks good questions"], teacherName: "Priya Ma'am", date: "2026-10-20", by: "ut1", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(teacher(), "notes/n1"), note));
  await assertFails(setDoc(doc(teacher(), "notes/n2"), { ...note, studentId: "sX" }));
  await assertFails(setDoc(doc(teacher(), "notes/n3"), { ...note, teacherName: "Someone else" }));
  await assertFails(setDoc(doc(teacher(), "notes/n4"), { ...note, lines: ["a", "b", "c", "d"] }));
});

test("a paused batch closes to its teacher", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "batches/b1"), { active: false });
  });
  await assertFails(session(teacher()));
});

test("a parent reads only their own child's progress page", async () => {
  await assertSucceeds(getDocs(query(collection(parent(), "progress"), where("parentPhone", "==", PARENT))));
  await assertSucceeds(getDoc(doc(parent(), "progress/s1")));
  await assertFails(getDoc(doc(stranger(), "progress/s1")));
  await assertFails(getDocs(collection(parent(), "progress")));
  await assertFails(setDoc(doc(parent(), "progress/s1"), { parentPhone: PARENT }));
  await assertFails(getDoc(doc(parent(), "students/s1")));
  await assertFails(getDoc(doc(parent(), "batches/b1")));
  await assertFails(getDocs(query(collection(parent(), "sessions"), where("batchId", "==", "b1"))));
});

test("the team sets up students, teachers and batches, but not the fields functions keep", async () => {
  const db = admin();
  await assertSucceeds(setDoc(doc(db, "teachers/t3"), { name: "Neha", phone: "+919855555555", subjects: ["English"], active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "teachers/t4"), { name: "Bad", phone: "98555", subjects: [], active: true, updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(db, "students/s2"), {
    name: "Diya", classLevel: "8", board: "ICSE", parentName: "Meera", parentPhone: "+919866666666",
    batchIds: [], whatsappOptIn: false, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(db, "students/s3"), {
    name: "X", classLevel: "12", board: "CBSE", parentName: "Y", parentPhone: "+919866666666",
    batchIds: [], whatsappOptIn: false, active: true, updatedAt: serverTimestamp(),
  }));
  const batch = { name: "Class 8 Science", classLevel: "8", board: "ICSE", subject: "Science", teacherId: "t2", schedule: "Tue 6pm", active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, "batches/b2"), batch));
  await assertFails(setDoc(doc(db, "batches/b3"), { ...batch, teacherPhone: TEACHER }));
  await assertFails(updateDoc(doc(db, "batches/b1"), { roster: [], updatedAt: serverTimestamp() }));
  for (const other of [teacher(), parent(), stranger()]) {
    await assertFails(setDoc(doc(other, "students/s9"), { name: "x" }));
    await assertFails(getDocs(collection(other, "students")));
  }
});

// ---- Triggers (functions emulator) ----

test("progress pages and rosters follow what teachers and the team enter", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "students/s2"), {
      name: "Diya", classLevel: "7", board: "CBSE", parentName: "Meera", parentPhone: "+919866666666",
      batchIds: ["b1"], whatsappOptIn: false, active: true,
    });
  });
  const roster = await waitFor(async () => {
    const ids = (await peek("batches/b1")).get("studentIds") as string[] | undefined;
    return ids?.length === 2 ? ids : undefined;
  });
  assert.deepEqual(roster, ["s1", "s2"]);

  await assertSucceeds(session(teacher(), { attendance: { s1: "present", s2: "absent" } }));
  await assertSucceeds(setDoc(doc(teacher(), "assessments/a1"), {
    batchId: "b1", subject: "Maths", title: "Fractions quiz", date: "2026-10-20", max: 20, scores: { s1: 17, s2: null },
    enteredBy: "ut1", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  const page = await waitFor(async () => {
    const snap = await getDoc(doc(parent(), "progress/s1"));
    const data = snap.data();
    return data?.tests?.length === 1 && data?.attendance?.length === 1 ? data : undefined;
  }, 15_000);
  assert.equal(page.student.batch, "Class 7 Maths A");
  assert.deepEqual(page.student.subjects, ["Maths"]);
  assert.deepEqual(page.attendance, [{ date: "2026-10-20", subject: "Maths", status: "present" }]);
  assert.deepEqual(page.tests, [{ date: "2026-10-20", subject: "Maths", title: "Fractions quiz", score: 17, max: 20 }]);

  // Moving a teacher's number moves their access with it.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "teachers/t1"), { phone: "+919877777777" });
  });
  await waitFor(async () => {
    return (await peek("batches/b1")).get("teacherPhone") === "+919877777777" ? true : undefined;
  });
  await assertFails(getDoc(doc(teacher(), "batches/b1")));

  // A child who leaves loses their page.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), "students/s2"));
  });
  await waitFor(async () => {
    return (await peek("progress/s2")).exists() ? undefined : true;
  });
});
