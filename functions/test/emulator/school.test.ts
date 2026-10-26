import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
  type DocumentSnapshot, type Firestore,
} from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { PROJECT_ID, waitFor, freshDatabase, paidPlan, plansBuilt } from "./helpers.ts";
import { keyOf } from "../../src/school/keys.ts";

let env: RulesTestEnvironment;
const rules = readFileSync(new URL("../../../firestore.rules", import.meta.url), "utf8");
const storageRules = readFileSync(new URL("../../../storage.rules", import.meta.url), "utf8");
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const [stHost, stPort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199").split(":");

const TEACHER = "+919811111111";
const OTHER_TEACHER = "+919822222222";
const PARENT = "+919833333333";

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: fsHost!, port: Number(fsPort) },
    storage: { rules: storageRules, host: stHost!, port: Number(stPort) },
  });
});
after(() => env.cleanup());

// Seeded already consistent with what the triggers derive, so they find nothing to change mid-test.
beforeEach(async () => {
  await freshDatabase(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const t1 = { name: "Priya Ma'am", nameKey: "priya ma'am", phone: TEACHER, subjects: ["Maths"], active: true };
    const t2 = { name: "Ravi Sir", nameKey: "ravi sir", phone: OTHER_TEACHER, subjects: ["Science"], active: true };
    const s1 = {
      name: "Aarav", nameKey: "aarav", classLevel: "7", board: "CBSE", parentName: "Anita", parentPhone: PARENT,
      batchIds: ["b1"], whatsappOptIn: true, active: true,
    };
    await setDoc(doc(db, "uniqueKeys", keyOf("teachers", t1)!), { kind: "teachers", id: "t1" });
    await setDoc(doc(db, "uniqueKeys", keyOf("teachers", t2)!), { kind: "teachers", id: "t2" });
    await setDoc(doc(db, "uniqueKeys", keyOf("students", s1)!), { kind: "students", id: "s1" });
    await setDoc(doc(db, "teachers/t1"), t1);
    await setDoc(doc(db, "teachers/t2"), t2);
    await setDoc(doc(db, "fees/plan-s1"), paidPlan("s1"));
    await setDoc(doc(db, "students/s1"), s1);
    await setDoc(doc(db, "batches/b1"), {
      name: "Class 7 Maths A", classLevel: "7", board: "CBSE", subject: "Maths", teacherId: "t1", schedule: "Mon Wed 5pm",
      active: true, teacherPhone: TEACHER, teacherName: "Priya Ma'am", roster: [{ id: "s1", name: "Aarav" }], studentIds: ["s1"],
    });
    await setDoc(doc(db, "progress/s1"), { parentPhone: PARENT, student: { id: "s1", name: "Aarav" }, attendance: [], tests: [], notes: [] });
    await setDoc(doc(db, "batchAccess/b1"), { parentPhones: [PARENT] });
    await setDoc(doc(db, "leads/l1"), { parentName: "Test", status: "new" });
  });
  await plansBuilt(["s1"]);
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

const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** What /admin does: the record and its unique key in one write (src/lib/firebase/school.ts saveRecord). */
function withKey(db: Firestore, kind: "teachers" | "students", id: string, fields: Record<string, unknown>) {
  const batch = writeBatch(db);
  batch.set(doc(db, kind, id), { ...fields, nameKey: nameKey(String(fields["name"])), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, "uniqueKeys", keyOf(kind, fields)!), { kind, id });
  return batch.commit();
}

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
  await assertSucceeds(getDoc(doc(teacher(), "sessions/b1_2026-10-20")));
  await assertFails(getDoc(doc(otherTeacher(), "sessions/b1_2026-10-20")));
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
  await assertSucceeds(withKey(db, "teachers", "t3", { name: "Neha", phone: "+919855555555", subjects: ["English"], active: true }));
  await assertFails(withKey(db, "teachers", "t4", { name: "Bad", phone: "98555", subjects: [], active: true }));
  await assertSucceeds(withKey(db, "students", "s2", {
    name: "Diya", classLevel: "8", board: "ICSE", parentName: "Meera", parentPhone: "+919866666666",
    batchIds: [], whatsappOptIn: false, active: true,
  }));
  await assertFails(withKey(db, "students", "s3", {
    name: "X", classLevel: "12", board: "CBSE", parentName: "Y", parentPhone: "+919866666666",
    batchIds: [], whatsappOptIn: false, active: true,
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

test("the team list: the team adds and removes addresses, never themselves, and nobody else sees it", async () => {
  const db = admin();
  const entry = { addedBy: "owner@example.com", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, "team/helper@gmail.com"), entry));
  await assertSucceeds(getDocs(collection(db, "team")));
  await assertFails(setDoc(doc(db, "team/Helper@Gmail.com"), entry));
  await assertFails(setDoc(doc(db, "team/not-an-address"), entry));
  await assertFails(setDoc(doc(db, "team/someone@gmail.com"), { addedBy: "someone-else@example.com", createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, "team/someone@gmail.com"), { ...entry, role: "owner" }));
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "team/owner@example.com"), { addedBy: "x" }));
  await assertFails(deleteDoc(doc(db, "team/owner@example.com")));
  await assertSucceeds(deleteDoc(doc(db, "team/helper@gmail.com")));
  for (const other of [teacher(), parent(), stranger()]) {
    await assertFails(getDocs(collection(other, "team")));
    await assertFails(setDoc(doc(other, "team/me@gmail.com"), entry));
  }
});

test("study material: the batch's teacher shares it, the batch's parents read it, nobody else", async () => {
  const link = (db: Firestore, id: string, extra: Record<string, unknown> = {}) =>
    setDoc(doc(db, `materials/${id}`), {
      batchId: "b1", title: "Fractions PYQs 2025", kind: "pyq", link: "https://drive.google.com/file/d/x",
      teacherName: "Priya Ma'am", createdBy: "ut1", createdAt: serverTimestamp(), ...extra,
    });
  await assertSucceeds(link(teacher(), "m1"));
  await assertSucceeds(setDoc(doc(teacher(), "materials/m2"), {
    batchId: "b1", title: "Chapter 3 notes", kind: "notes", teacherName: "Priya Ma'am", createdBy: "ut1", createdAt: serverTimestamp(),
    file: { path: "materials/b1/m2/notes.pdf", name: "notes.pdf", size: 1200, type: "application/pdf" },
  }));
  await assertFails(link(teacher(), "m3", { kind: "video" }));
  await assertFails(link(teacher(), "m4", { link: "http://insecure.example.com" }));
  await assertFails(link(teacher(), "m5", { file: { path: "materials/b1/m5/a.pdf", name: "a.pdf", size: 10, type: "application/pdf" } }));
  await assertFails(link(teacher(), "m6", { createdBy: "someone-else" }));
  await assertFails(link(otherTeacher(), "m7", { createdBy: "ut2" }));
  await assertFails(link(parent(), "m8", { createdBy: "up1" }));
  await assertSucceeds(getDocs(query(collection(parent(), "materials"), where("batchId", "==", "b1"))));
  await assertSucceeds(getDoc(doc(parent(), "materials/m1")));
  for (const other of [otherTeacher(), stranger()]) await assertFails(getDoc(doc(other, "materials/m1")));
  await assertFails(deleteDoc(doc(parent(), "materials/m1")));
  await assertSucceeds(deleteDoc(doc(teacher(), "materials/m1")));
  await assertFails(getDoc(doc(parent(), "batchAccess/b1")));

  const store = (uid: string, phone_number: string) => env.authenticatedContext(uid, { phone_number }).storage();
  const pdf = { contentType: "application/pdf" };
  await assertSucceeds(uploadBytes(ref(store("ut1", TEACHER), "materials/b1/m2/notes.pdf"), new Uint8Array([1, 2]), pdf));
  await assertFails(uploadBytes(ref(store("ut1", TEACHER), "materials/b1/m2/run.exe"), new Uint8Array([1]), { contentType: "application/octet-stream" }));
  await assertFails(uploadBytes(ref(store("ut2", OTHER_TEACHER), "materials/b1/m9/x.pdf"), new Uint8Array([1]), pdf));
  await assertFails(uploadBytes(ref(store("up1", PARENT), "materials/b1/m9/x.pdf"), new Uint8Array([1]), pdf));
  await assertSucceeds(getBytes(ref(store("up1", PARENT), "materials/b1/m2/notes.pdf")));
  await assertFails(getBytes(ref(store("ux", "+919844444444"), "materials/b1/m2/notes.pdf")));
});

test("the team deletes demo requests and sets a class length; nobody else can", async () => {
  await assertFails(deleteDoc(doc(teacher(), "leads/l1")));
  await assertSucceeds(deleteDoc(doc(admin(), "leads/l1")));
  const batch = { name: "Class 9 Maths", classLevel: "9", board: "CBSE", subject: "Maths", teacherId: "t1", schedule: "Sat 10am", active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(admin(), "batches/b5"), { ...batch, durationMinutes: 90 }));
  await assertFails(setDoc(doc(admin(), "batches/b6"), { ...batch, durationMinutes: 5 }));
  await assertFails(setDoc(doc(admin(), "batches/b7"), { ...batch, durationMinutes: 60.5 }));
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
  // Parents' numbers go to batchAccess (for study material), never onto the batch teachers read; a family
  // is let in once their child's plan is paid.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.deepEqual((await peek("batchAccess/b1")).get("parentPhones"), [PARENT]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "fees/plan-s2"), paidPlan("s2"));
  });
  const phones = await waitFor(async () => {
    const list = (await peek("batchAccess/b1")).get("parentPhones") as string[] | undefined;
    return list?.length === 2 ? list : undefined;
  });
  assert.deepEqual(phones, [PARENT, "+919866666666"]);
  assert.equal((await peek("batches/b1")).get("parentPhones"), undefined);

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

// ---- Data integrity: unique records, references and name keys ----

const child = (overrides: Record<string, unknown> = {}) => ({
  name: "Kabir Singh", classLevel: "6", board: "CBSE", parentName: "Simran", parentPhone: "+919866666666",
  batchIds: [], whatsappOptIn: true, active: true, ...overrides,
});

test("one teacher per mobile number; the number's key moves with it", async () => {
  const db = admin();
  // Ravi already has OTHER_TEACHER.
  await assertFails(withKey(db, "teachers", "t3", { name: "Copy", phone: OTHER_TEACHER, subjects: [], active: true }));
  // A teacher without the key in the same write is refused, so nobody can skip the check.
  await assertFails(setDoc(doc(db, "teachers/t3"), {
    name: "Neha", nameKey: "neha", phone: "+919855555555", subjects: [], active: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  // Changing a number takes the new key and gives up the old one in one write.
  const move = writeBatch(db);
  move.update(doc(db, "teachers/t2"), { phone: "+919855555555", updatedAt: serverTimestamp() });
  move.set(doc(db, "uniqueKeys", keyOf("teachers", { phone: "+919855555555" })!), { kind: "teachers", id: "t2" });
  move.delete(doc(db, "uniqueKeys", keyOf("teachers", { phone: OTHER_TEACHER })!));
  await assertSucceeds(move.commit());
  // Now the old number is free again.
  await assertSucceeds(withKey(db, "teachers", "t3", { name: "Neha", phone: OTHER_TEACHER, subjects: [], active: true }));
  // Renaming keeps the number, so no key is needed; the name key must still match.
  await assertSucceeds(updateDoc(doc(db, "teachers/t1"), { name: "Priya  Sharma", nameKey: "priya sharma", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, "teachers/t1"), { name: "Priya", nameKey: "PRIYA", updatedAt: serverTimestamp() }));
});

test("two children may share a name, but the same child can't be entered twice", async () => {
  const db = admin();
  await assertSucceeds(withKey(db, "students", "s2", child()));
  // Same name, different family: a different child with its own id.
  await assertSucceeds(withKey(db, "students", "s3", child({ parentPhone: "+919877777777" })));
  // Same family, same name (case and spaces don't matter): a duplicate.
  await assertFails(withKey(db, "students", "s4", child({ name: "  kabir   SINGH " })));
  // A sibling with another name is fine.
  await assertSucceeds(withKey(db, "students", "s5", child({ name: "Meher Singh" })));
  // Renaming a child onto a sibling's name is refused too.
  const clash = writeBatch(db);
  clash.update(doc(db, "students/s5"), { name: "Kabir Singh", nameKey: "kabir singh", updatedAt: serverTimestamp() });
  clash.set(doc(db, "uniqueKeys", keyOf("students", child())!), { kind: "students", id: "s5" });
  await assertFails(clash.commit());
  // Each batch at most once on a child.
  await assertFails(updateDoc(doc(db, "students/s1"), { batchIds: ["b1", "b1"], updatedAt: serverTimestamp() }));
  // createdAt is set once.
  await assertFails(updateDoc(doc(db, "students/s1"), { createdAt: new Date(0), updatedAt: serverTimestamp() }));
});

test("unique keys: only the team reads them, and a key in use can't be removed", async () => {
  const key = keyOf("students", { name: "Aarav", parentPhone: PARENT })!;
  await assertSucceeds(getDoc(doc(admin(), "uniqueKeys", key)));
  for (const other of [teacher(), parent(), stranger()]) await assertFails(getDoc(doc(other, "uniqueKeys", key)));
  await assertFails(deleteDoc(doc(admin(), "uniqueKeys", key)));
  // A key that doesn't match its record is refused.
  await assertFails(setDoc(doc(admin(), "uniqueKeys/abc"), { kind: "students", id: "s1" }));
  // Deleting the record and its key together works.
  const db = admin();
  const gone = writeBatch(db);
  gone.delete(doc(db, "students/s1"));
  gone.delete(doc(db, "uniqueKeys", key));
  await assertSucceeds(gone.commit());
});

test("a batch points at a teacher who exists, or at nobody yet", async () => {
  const db = admin();
  const batch = { name: "Class 9 Maths", classLevel: "9", board: "CBSE", subject: "Maths", schedule: "", active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db, "batches/b2"), { ...batch, teacherId: "t1" }));
  await assertSucceeds(setDoc(doc(db, "batches/b3"), { ...batch, teacherId: "" }));
  await assertFails(setDoc(doc(db, "batches/b4"), { ...batch, teacherId: "nobody" }));
});

test("deletes don't leave records pointing at nothing, and old records get their keys", async () => {
  // Deleting a batch takes it off every child's list.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), "batches/b1"));
  });
  await waitFor(async () => (((await peek("students/s1")).get("batchIds") as string[]).length === 0 ? true : undefined));

  // Deleting a teacher leaves their batches with no teacher, and frees their number.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "batches/b5"), {
      name: "Class 8 Science", classLevel: "8", board: "CBSE", subject: "Science", teacherId: "t2", schedule: "",
      active: true, teacherPhone: OTHER_TEACHER, teacherName: "Ravi Sir", roster: [], studentIds: [],
    });
    await deleteDoc(doc(db, "teachers/t2"));
  });
  await waitFor(async () => ((await peek("batches/b5")).get("teacherId") === "" ? true : undefined));
  await waitFor(async () => ((await peek(`uniqueKeys/${keyOf("teachers", { phone: OTHER_TEACHER })}`)).exists() ? undefined : true));

  // A record made before keys existed gets its name key and unique key from the trigger.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "students/old"), child({ name: "Old  Record" }));
  });
  await waitFor(async () => ((await peek("students/old")).get("nameKey") === "old record" ? true : undefined));
  const key = await waitFor(async () => {
    const snap = await peek(`uniqueKeys/${keyOf("students", child({ name: "Old  Record" }))}`);
    return snap.exists() ? snap.data() : undefined;
  });
  assert.deepEqual(key, { kind: "students", id: "old" });
});
