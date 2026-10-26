import { FieldValue, getFirestore } from "firebase-admin/firestore";

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Recomputes a batch's roster from the students who list it, so teachers never read parents' details.
 * The parents' numbers go to `batchAccess/{batchId}` instead, which only the rules read (study material,
 * notices, live classes). Only families whose plan is open are let in (billing/{studentId}.open), so a
 * paused plan also stops class reminders and material until it is renewed.
 */
export async function refreshRoster(batchId: string) {
  const db = getFirestore();
  const batchRef = db.doc(`batches/${batchId}`);
  const accessRef = db.doc(`batchAccess/${batchId}`);
  const [batch, students] = await Promise.all([
    batchRef.get(),
    db.collection("students").where("batchIds", "array-contains", batchId).get(),
  ]);
  if (!batch.exists) {
    await accessRef.delete();
    return;
  }
  const enrolled = students.docs.filter((s) => s.get("active") !== false);
  const plans = enrolled.length ? await db.getAll(...enrolled.map((s) => db.doc(`billing/${s.id}`))) : [];
  const open = new Set(plans.filter((p) => p.get("open") === true).map((p) => p.id));
  const parentPhones = [
    ...new Set(enrolled.filter((s) => open.has(s.id)).map((s) => String(s.get("parentPhone") ?? "")).filter(Boolean)),
  ].sort();
  const access = await accessRef.get();
  if (!sameList(ids(access.get("parentPhones")), parentPhones)) await accessRef.set({ parentPhones });
  // Two children can share a name; the id keeps their order the same on every rebuild.
  const roster = enrolled
    .map((s) => ({ id: s.id, name: String(s.get("name") ?? "") }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const studentIds = roster.map((s) => s.id);
  const current = batch.data()!;
  const sameRoster =
    sameList(ids(current.studentIds), studentIds) &&
    sameList((current.roster ?? []).map((s: { name?: string }) => s.name ?? ""), roster.map((s) => s.name));
  if (!sameRoster) await batchRef.update({ roster, studentIds, updatedAt: FieldValue.serverTimestamp() });
}

