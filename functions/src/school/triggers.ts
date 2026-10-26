import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type { Change, DocumentSnapshot, FirestoreEvent } from "firebase-functions/v2/firestore";
import { syncKeys } from "./keys.js";
import { rebuildProgress } from "./progress.js";
import { refreshRoster } from "./roster.js";
import { rebuildBilling } from "../billing/billing.js";

// Teachers and the admin write the raw records; these triggers keep the derived fields that rules and
// dashboards rely on: each batch's roster and teacher phone, and each child's `progress` page.

type Written = FirestoreEvent<Change<DocumentSnapshot> | undefined>;

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
const keys = (value: unknown): string[] =>
  value && typeof value === "object" ? Object.keys(value as Record<string, unknown>) : [];
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** True when the only change is the `nameKey` a function filled in: nothing else needs doing. */
function onlyNameKey(before: FirebaseFirestore.DocumentData | undefined, after: FirebaseFirestore.DocumentData | undefined) {
  if (!before || !after) return false;
  const changedKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of changedKeys) {
    if (key === "nameKey") continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) return false;
  }
  return true;
}

async function rebuildAll(studentIds: Iterable<string>) {
  const db = getFirestore();
  for (const id of new Set(studentIds)) await rebuildProgress(db, id);
}

export async function handleStudentWritten(event: Written) {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (onlyNameKey(before, after)) return;
  const db = getFirestore();
  const studentId = event.params.studentId as string;
  // Keys follow the record as it is now: a late event must not take a key from a newer record.
  const current = (await db.doc(`students/${studentId}`).get()).data();
  await syncKeys(db, "students", studentId, before, current);
  const batchIds = new Set([...ids(before?.batchIds), ...ids(after?.batchIds)]);
  const rosterChanged =
    !before || !after || before.name !== after.name || before.active !== after.active ||
    before.parentPhone !== after.parentPhone ||
    !sameList(ids(before.batchIds), ids(after.batchIds));
  // The plan first: the roster lets in only families whose classes are open.
  await rebuildBilling(db, studentId);
  if (rosterChanged) for (const id of batchIds) await refreshRoster(id);
  await rebuildProgress(db, studentId);
}

export async function handleTeacherWritten(event: Written) {
  const db = getFirestore();
  if (onlyNameKey(event.data?.before.data(), event.data?.after.data())) return;
  // Read the record as it is now, not as the event saw it: events can arrive out of order, and an old
  // one must not undo a newer change.
  const teacherId = event.params.teacherId as string;
  const after = (await db.doc(`teachers/${teacherId}`).get()).data();
  await syncKeys(db, "teachers", teacherId, event.data?.before.data(), after);
  const batches = await db.collection("batches").where("teacherId", "==", teacherId).get();
  // A removed or paused teacher loses access at once: their batches stop matching their phone. A deleted
  // teacher's batches are left with no teacher (''), so they never point at a record that is gone.
  const teacherPhone = after && after.active !== false ? String(after.phone ?? "") : "";
  const teacherName = String(after?.name ?? "");
  for (const batch of batches.docs) {
    if (!after) {
      await batch.ref.update({ teacherId: "", teacherPhone: "", teacherName: "", updatedAt: FieldValue.serverTimestamp() });
      continue;
    }
    if (batch.get("teacherPhone") === teacherPhone && batch.get("teacherName") === teacherName) continue;
    await batch.ref.update({ teacherPhone, teacherName, updatedAt: FieldValue.serverTimestamp() });
  }
}

export async function handleBatchWritten(event: Written) {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const batchId = event.params.batchId as string;
  const db = getFirestore();

  if (after) {
    const teacher = after.teacherId ? await db.doc(`teachers/${after.teacherId}`).get() : undefined;
    const t = teacher?.data();
    const teacherPhone = t && t.active !== false ? String(t.phone ?? "") : "";
    const teacherName = String(t?.name ?? "");
    if (after.teacherPhone !== teacherPhone || after.teacherName !== teacherName) {
      // The update below fires this trigger again; the second run finds nothing to change.
      await event.data!.after.ref.update({ teacherPhone, teacherName, updatedAt: FieldValue.serverTimestamp() });
      return;
    }
  }
  if (!before || !after) await refreshRoster(batchId);
  // A deleted batch leaves every child's list; each child's own trigger then rebuilds their page.
  if (!after && !(await db.doc(`batches/${batchId}`).get()).exists) {
    const listed = await db.collection("students").where("batchIds", "array-contains", batchId).get();
    for (const student of listed.docs) await student.ref.update({ batchIds: FieldValue.arrayRemove(batchId) });
  }
  // Name and subject appear on each child's page; a deleted batch drops out of it.
  if (!after || before?.name !== after.name || before?.subject !== after.subject || before?.active !== after.active) {
    await rebuildAll([...ids(before?.studentIds), ...ids(after?.studentIds)]);
  }
}

/** Sessions hold an `attendance` map and assessments a `scores` map, both keyed by student id. */
export function handleSheetWritten(field: "attendance" | "scores") {
  return async (event: Written) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    let students = [...keys(before?.[field]), ...keys(after?.[field])];
    // A cancelled class shows on every child's page, marked or not.
    if (before?.status === "cancelled" || after?.status === "cancelled") {
      const batch = await getFirestore().doc(`batches/${after?.batchId ?? before?.batchId}`).get();
      students = [...students, ...ids(batch.get("studentIds"))];
    }
    await rebuildAll(students);
  };
}

export async function handleNoteWritten(event: Written) {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  await rebuildAll([before?.studentId, after?.studentId].filter((id): id is string => typeof id === "string"));
}

export function logged<E extends Written>(name: string, handler: (event: E) => Promise<void>) {
  return async (event: E) => {
    try {
      await handler(event);
    } catch (error) {
      // The document was deleted while we worked on it; its own delete event brings things up to date.
      if ((error as { code?: unknown }).code === 5) return;
      logger.error(`${name} failed`, { params: event.params, error: String(error) });
      throw error;
    }
  };
}
