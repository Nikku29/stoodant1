import type { FirestoreEvent, Change, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { PHONE_HASH_PEPPER } from "../config.js";
import { rollNumber } from "./schema.js";
import { lockedPaper } from "./exam/locked.js";

/**
 * When the team confirms a registration's ₹99 fee in /admin, the child gets an exam roll number
 * (260900042: year, class, running number per class). Given once only: a later change keeps it.
 * The page shows it the next time the family opens it or taps "Check status".
 * The child's exam paper is made at the same moment (once the question bank is uploaded), so the page can
 * download it, locked, well before the exam.
 */
export async function handleScholarshipUpdated(
  event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { regNo: string }>,
): Promise<void> {
  const after = event.data?.after;
  if (!after || after.get("payment.status") !== "paid") return;
  // Already numbered and its paper made: nothing to do (most updates, such as booking an hour).
  if (after.get("rollNo") && event.data?.before.get("rollNo")) return;
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
  const roll = rollNo ?? (after.get("rollNo") as string | undefined);
  const pepper = PHONE_HASH_PEPPER.value();
  if (!roll || !pepper) return;
  try {
    await lockedPaper(pepper, roll, studentClass, false);
  } catch (error) {
    // No bank uploaded yet: the paper is made on the first download instead.
    logger.info("scholarship_paper_later", { rollNo: roll, reason: String(error).slice(0, 120) });
  }
}
