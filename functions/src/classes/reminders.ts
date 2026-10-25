import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { pushToPhones } from "../notify/push.js";

/** Reminders go out this many minutes before a class starts. */
export const REMIND_BEFORE_MIN = 5;

/**
 * Runs every minute: finds classes starting in the next REMIND_BEFORE_MIN (+1) minutes that have not been
 * reminded for their current start time, marks them, and tells the batch's families and its teacher.
 * `remindedFor` holds the start time that was reminded, so a class that is moved later is reminded again,
 * and a run that overlaps another never sends twice (the mark is set in a transaction first).
 */
export async function sendClassReminders(now = Date.now()) {
  const db = getFirestore();
  const soon = await db
    .collection("liveClasses")
    .where("status", "==", "scheduled")
    .where("startAt", ">", Timestamp.fromMillis(now))
    .where("startAt", "<=", Timestamp.fromMillis(now + (REMIND_BEFORE_MIN + 1) * 60_000))
    .get();

  let sent = 0;
  for (const doc of soon.docs) {
    const start: number = doc.get("startAt").toMillis();
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.get("status") !== "scheduled" || fresh.get("startAt").toMillis() !== start) return false;
      if (fresh.get("remindedFor")?.toMillis?.() === start) return false;
      tx.update(doc.ref, { remindedFor: Timestamp.fromMillis(start) });
      return true;
    });
    if (!claimed) continue;

    const batchId = String(doc.get("batchId"));
    const subject = String(doc.get("subject") || doc.get("batchName") || "Class");
    const teacher = String(doc.get("teacherName") || "your teacher");
    const mins = Math.max(1, Math.round((start - now) / 60_000));
    const [access, batch] = await Promise.all([db.doc(`batchAccess/${batchId}`).get(), db.doc(`batches/${batchId}`).get()]);
    const topic = doc.get("topic") ? `: ${doc.get("topic")}` : "";
    try {
      sent += await pushToPhones((access.get("parentPhones") ?? []) as string[], {
        title: `${subject} with ${teacher} starts in ${mins} min`,
        body: `Tap to join${topic}.`,
        link: `/parent?class=${doc.id}`,
        tag: `class-${doc.id}`,
      });
      const teacherPhone = String(batch.get("teacherPhone") ?? "");
      if (teacherPhone)
        sent += await pushToPhones([teacherPhone], {
          title: `${String(doc.get("batchName"))} starts in ${mins} min`,
          body: "Tap to open the class link.",
          link: `/teacher?batch=${batchId}&class=${doc.id}`,
          tag: `class-${doc.id}`,
        });
    } catch (e) {
      logger.error("class reminder failed", { classId: doc.id, error: String(e) });
    }
  }
  return { classes: soon.size, sent };
}
