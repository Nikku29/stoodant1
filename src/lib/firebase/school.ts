// Reads and writes for the signed-in pages. Every query here is shaped to match firestore.rules: a teacher
// asks for batches by their own number, a parent for progress pages by theirs.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore/lite";

import type { StudentRecords } from "@/lib/progress/insights";
import { firebase } from "./session";

export type RosterEntry = { id: string; name: string };
export type Batch = {
  id: string;
  name: string;
  classLevel: string;
  board: "CBSE" | "ICSE";
  subject: string;
  teacherId: string;
  teacherName?: string;
  schedule: string;
  active: boolean;
  roster?: RosterEntry[];
  studentIds?: string[];
};
export type Teacher = {
  id: string;
  name: string;
  phone: string;
  subjects: string[];
  active: boolean;
};
export type Student = {
  id: string;
  name: string;
  classLevel: string;
  board: "CBSE" | "ICSE";
  parentName: string;
  parentPhone: string;
  batchIds: string[];
  whatsappOptIn: boolean;
  active: boolean;
};
export type Lead = {
  id: string;
  parentName: string;
  studentClass: string;
  board: string;
  parentPhoneE164: string;
  status: string;
  createdAt?: { toDate(): Date };
};
export type Progress = StudentRecords & { parentPhone: string };

const db = () => firebase().db;
const rows = <T>(snap: { docs: { id: string; data(): DocumentData }[] }) =>
  snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);

/** India date, YYYY-MM-DD, for the day a class or test happened. */
export function istDay(offsetDays = 0): string {
  const d = new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ---- Teachers and parents ----

export async function myBatches(phone: string): Promise<Batch[]> {
  const snap = await getDocs(
    query(collection(db(), "batches"), where("teacherPhone", "==", phone)),
  );
  return rows<Batch>(snap)
    .filter((b) => b.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function myChildren(phone: string): Promise<Progress[]> {
  const snap = await getDocs(
    query(collection(db(), "progress"), where("parentPhone", "==", phone)),
  );
  return rows<Progress>(snap).sort((a, b) => a.student.name.localeCompare(b.student.name));
}

export async function progressOf(studentId: string): Promise<Progress | null> {
  const snap = await getDoc(doc(db(), "progress", studentId));
  return snap.exists() ? (snap.data() as Progress) : null;
}

/** The teacher record for a signed-in number, if the team has added one and it is active. */
export async function myTeacherRecord(phone: string): Promise<Teacher | null> {
  const snap = await getDocs(query(collection(db(), "teachers"), where("phone", "==", phone)));
  return rows<Teacher>(snap).find((t) => t.active !== false) ?? null;
}

/**
 * Where a phone number may go after log-in. A teacher counts as soon as the team adds them, even before
 * they are linked to a batch, so they never see "number not found".
 */
export async function rolesFor(phone: string): Promise<{ teacher: boolean; parent: boolean }> {
  const [teacher, batches, children] = await Promise.all([
    myTeacherRecord(phone).catch(() => null),
    myBatches(phone).catch(() => []),
    myChildren(phone).catch(() => []),
  ]);
  return { teacher: Boolean(teacher) || batches.length > 0, parent: children.length > 0 };
}

export type Mark = "present" | "late" | "absent";

export async function loadSession(batchId: string, date: string) {
  const snap = await getDoc(doc(db(), "sessions", `${batchId}_${date}`));
  return snap.exists()
    ? (snap.data() as { status: "held" | "cancelled"; attendance: Record<string, Mark> })
    : null;
}

export async function saveSession(
  batch: Batch,
  date: string,
  status: "held" | "cancelled",
  attendance: Record<string, Mark>,
  uid: string,
) {
  const ref = doc(db(), "sessions", `${batch.id}_${date}`);
  const fields = {
    subject: batch.subject,
    status,
    attendance,
    markedBy: uid,
    updatedAt: serverTimestamp(),
  };
  const existing = await getDoc(ref);
  if (existing.exists()) await updateDoc(ref, fields);
  else await setDoc(ref, { ...fields, batchId: batch.id, date, createdAt: serverTimestamp() });
}

export async function saveAssessment(
  batch: Batch,
  test: { title: string; date: string; max: number; scores: Record<string, number | null> },
  uid: string,
) {
  await addDoc(collection(db(), "assessments"), {
    ...test,
    batchId: batch.id,
    subject: batch.subject,
    enteredBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveNotes(
  batch: Batch,
  date: string,
  notes: Record<string, string[]>,
  uid: string,
) {
  await Promise.all(
    Object.entries(notes)
      .filter(([, lines]) => lines.length)
      .map(([studentId, lines]) =>
        addDoc(collection(db(), "notes"), {
          batchId: batch.id,
          studentId,
          subject: batch.subject,
          lines: lines.slice(0, 3),
          teacherName: batch.teacherName ?? "",
          date,
          by: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
  );
}

// ---- The Stoodant team ----

export const listAll = {
  teachers: async () =>
    rows<Teacher>(await getDocs(collection(db(), "teachers"))).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  students: async () =>
    rows<Student>(await getDocs(collection(db(), "students"))).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  batches: async () =>
    rows<Batch>(await getDocs(collection(db(), "batches"))).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  leads: async () =>
    rows<Lead>(
      await getDocs(query(collection(db(), "leads"), orderBy("createdAt", "desc"), limit(100))),
    ),
};

type Editable = "teachers" | "students" | "batches";

/** Creates (no id) or updates a record. Fields the Cloud Functions keep are never sent. */
export async function saveRecord(
  kind: Editable,
  id: string | null,
  fields: Record<string, unknown>,
) {
  if (id) await updateDoc(doc(db(), kind, id), { ...fields, updatedAt: serverTimestamp() });
  else
    await addDoc(collection(db(), kind), {
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
}

export const deleteRecord = (kind: Editable, id: string) => deleteDoc(doc(db(), kind, id));

export const setLeadStatus = (id: string, status: string) =>
  updateDoc(doc(db(), "leads", id), { status, updatedAt: serverTimestamp() });

export const addLeadNote = (id: string, text: string, uid: string) =>
  addDoc(collection(db(), "leads", id, "notes"), { text, by: uid, createdAt: serverTimestamp() });
