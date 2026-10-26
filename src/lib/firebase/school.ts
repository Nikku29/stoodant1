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
  writeBatch,
  type DocumentData,
} from "firebase/firestore/lite";

import type { BatchHistory, ClassDay } from "@/lib/progress/classSummary";
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
  /** Length of one class, for the team's hours report. 60 when not set. */
  durationMinutes?: number;
  /** What each student pays a month for this batch, whole rupees; 0 or missing = not set. */
  monthlyFee?: number;
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
  /** Whole rupees a month; 0 or missing = not set (the family can't pay yet). */
  monthlyFee?: number;
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
/** A Google address that may open /admin. The id is the address itself. */
export type TeamMember = { id: string; addedBy: string; createdAt?: { toDate(): Date } };

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

/** Every class day and test saved for a batch, for the teacher's class overview and recent entries. */
export async function batchHistory(batchId: string): Promise<BatchHistory> {
  const [days, tests] = await Promise.all([
    getDocs(query(collection(db(), "sessions"), where("batchId", "==", batchId))),
    getDocs(query(collection(db(), "assessments"), where("batchId", "==", batchId))),
  ]);
  return {
    days: days.docs.map((d) => {
      const x = d.data();
      return {
        date: x["date"],
        status: x["status"],
        attendance: x["attendance"] ?? {},
      } as ClassDay;
    }),
    tests: tests.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        title: x["title"],
        date: x["date"],
        max: x["max"],
        scores: x["scores"] ?? {},
        createdAt: x["createdAt"]?.toMillis?.(),
      };
    }),
  };
}

/** Teachers' notes about children in a batch, for the monthly student report. */
export async function batchNotes(batchId: string) {
  const snap = await getDocs(query(collection(db(), "notes"), where("batchId", "==", batchId)));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      studentId: String(x["studentId"]),
      date: String(x["date"]),
      lines: (x["lines"] ?? []) as string[],
    };
  });
}

/** A teacher can take back a test for two days after saving it, then enter it again. */
export const deleteAssessment = (id: string) => deleteDoc(doc(db(), "assessments", id));

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

export type SessionRow = {
  batchId: string;
  date: string;
  status: "held" | "cancelled";
  present: number;
  marked: number;
};

/** Every class day saved between two dates (inclusive), across all batches, for the team's reports. */
export async function sessionsBetween(from: string, to: string): Promise<SessionRow[]> {
  const snap = await getDocs(
    query(collection(db(), "sessions"), where("date", ">=", from), where("date", "<=", to)),
  );
  return snap.docs.map((d) => {
    const x = d.data();
    const marks = Object.values((x["attendance"] ?? {}) as Record<string, string>);
    return {
      batchId: String(x["batchId"]),
      date: String(x["date"]),
      status: x["status"] === "cancelled" ? "cancelled" : "held",
      present: marks.filter((m) => m !== "absent").length,
      marked: marks.length,
    };
  });
}

/** Every child's progress page, for the team's student list. */
export async function allProgress(): Promise<Progress[]> {
  return rows<Progress>(await getDocs(collection(db(), "progress")));
}

/** Deletes a demo request and its team notes. The consent record stays (consentLog). */
export async function deleteLead(id: string) {
  const notes = await getDocs(collection(db(), "leads", id, "notes"));
  await Promise.all(notes.docs.map((n) => deleteDoc(n.ref)));
  await deleteDoc(doc(db(), "leads", id));
}

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
  team: async () =>
    rows<TeamMember>(await getDocs(collection(db(), "team"))).sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  leads: async () =>
    rows<Lead>(
      await getDocs(query(collection(db(), "leads"), orderBy("createdAt", "desc"), limit(100))),
    ),
};

type Editable = "teachers" | "students" | "batches";

/** The fields the team edits. Anything else on a loaded record (id, rosters, nameKey) is never sent back. */
const EDITABLE: Record<Editable, string[]> = {
  teachers: ["name", "phone", "subjects", "active"],
  students: ["name", "classLevel", "board", "parentName", "parentPhone", "batchIds", "whatsappOptIn", "active", "monthlyFee"],
  batches: ["name", "classLevel", "board", "subject", "teacherId", "schedule", "durationMinutes", "monthlyFee", "active"],
};

/** "  Aarav   Sharma " and "aarav sharma" are the same name (firestore.rules normName). */
export const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The value that must not repeat: one teacher per mobile number, one child per parent's number + name.
 * Hashed the same way as firestore.rules (teacherKey, studentKey); the hash is the `uniqueKeys` id.
 */
async function uniqueKey(kind: "teachers" | "students", f: Record<string, unknown>) {
  const text =
    kind === "teachers"
      ? `teacher|${String(f["phone"])}`
      : `student|${String(f["parentPhone"])}|${nameKey(String(f["name"]))}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Thrown when the number (teacher) or parent's number + name (student) is already on another record. */
export class DuplicateRecord extends Error {
  constructor(readonly kind: "teachers" | "students") {
    super("duplicate");
  }
}

/**
 * Creates (no id) or updates a record. Fields the Cloud Functions keep are never sent. Teachers and
 * students also move their unique key in the same write, so a duplicate is refused as a whole.
 */
export async function saveRecord(
  kind: Editable,
  id: string | null,
  input: Record<string, unknown>,
) {
  const fields = Object.fromEntries(
    Object.entries(input).filter(([key, value]) => EDITABLE[kind].includes(key) && value !== undefined),
  );
  if (kind === "batches") {
    if (id) await updateDoc(doc(db(), kind, id), { ...fields, updatedAt: serverTimestamp() });
    else await addDoc(collection(db(), kind), { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return;
  }
  const ref = id ? doc(db(), kind, id) : doc(collection(db(), kind));
  const record = { ...fields, nameKey: nameKey(String(fields["name"] ?? "")) };
  const key = await uniqueKey(kind, record);
  const before = id ? await getDoc(ref) : null;
  const oldKey = before?.exists() ? await uniqueKey(kind, before.data()) : null;
  const holder = await getDoc(doc(db(), "uniqueKeys", key));
  if (holder.exists() && holder.get("id") !== ref.id) throw new DuplicateRecord(kind);

  const batch = writeBatch(db());
  if (id) batch.update(ref, { ...record, updatedAt: serverTimestamp() });
  else batch.set(ref, { ...record, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (oldKey !== key) {
    if (!holder.exists()) batch.set(doc(db(), "uniqueKeys", key), { kind, id: ref.id });
    if (oldKey && (await getDoc(doc(db(), "uniqueKeys", oldKey))).get("id") === ref.id)
      batch.delete(doc(db(), "uniqueKeys", oldKey));
  }
  await batch.commit();
}

/** Deletes a record, and for teachers and students the unique key it holds, in one write. */
export async function deleteRecord(kind: Editable, id: string) {
  const ref = doc(db(), kind, id);
  if (kind === "batches") return deleteDoc(ref);
  const snap = await getDoc(ref);
  const batch = writeBatch(db());
  batch.delete(ref);
  if (snap.exists()) {
    const keyRef = doc(db(), "uniqueKeys", await uniqueKey(kind, snap.data()));
    if ((await getDoc(keyRef)).get("id") === id) batch.delete(keyRef);
  }
  await batch.commit();
}

export const setLeadStatus = (id: string, status: string) =>
  updateDoc(doc(db(), "leads", id), { status, updatedAt: serverTimestamp() });

export const addLeadNote = (id: string, text: string, uid: string) =>
  addDoc(collection(db(), "leads", id, "notes"), { text, by: uid, createdAt: serverTimestamp() });

/** Gives a Google address access to /admin. They sign in with "Continue with Google" on /login. */
export const addTeamMember = (email: string, by: string) =>
  setDoc(doc(db(), "team", email.trim().toLowerCase()), {
    addedBy: by,
    createdAt: serverTimestamp(),
  });

/** Takes access away; a Cloud Function signs them out everywhere. */
export const removeTeamMember = (email: string) => deleteDoc(doc(db(), "team", email));
