import type { FirestoreEvent, Change, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { rollNumber } from "./schema.js";

/**
 * When the team confirms a registration's ₹99 fee in /admin, the child gets an exam roll number
 * (260900042: year, class, running number per class). Given once only: a later change keeps it.
 * The page shows it the next time the family opens it or taps "Check status".
 */
export async function handleScholarshipUpdated(
  event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { regNo: string }>,
): Promise<void> {
  const after = event.data?.after;
  if (!after || after.get("payment.status") !== "paid" || after.get("rollNo")) return;
  const db = getFirestore();
  const studentClass = String(after.get("studentClass"));
  const rollNo = await db.runTransaction(async (tx) => {
    const counterRef = db.doc(`counters/scholarship-roll-${studentClass}`);
    const [reg, counter] = await tx.getAll(after.ref, counterRef);
    if (!reg!.exists || reg!.get("rollNo") || reg!.get("payment.status") !== "paid") return null;
    const n = ((counter!.get("count") as number | undefined) ?? 0) + 1;
    const value = rollNumber(studentClass, n);
    const now = Timestamp.now();
    tx.set(counterRef, { count: n, updatedAt: now }, { merge: true });
    tx.update(after.ref, { rollNo: value, rollAssignedAt: now });
    return value;
  });
  if (rollNo) logger.info("scholarship_roll_assigned", { regNo: event.params.regNo, rollNo });
}
