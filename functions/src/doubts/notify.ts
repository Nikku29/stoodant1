import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { Change, FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { pushToPhones } from "../notify/push.js";

// Doubts (doubts/{id}): a family asks from the app (the rules check it is their child, in that batch). Here
// the batch's name, subject and teacher are filled in from the batch itself, and the teacher gets a push.
// When the teacher answers, the family gets a push that opens their doubts.

const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function questionPush(d: FirebaseFirestore.DocumentData, batch: FirebaseFirestore.DocumentData) {
  const who = first(String(d.studentName ?? "")) || "A student";
  return {
    title: `New doubt from ${who} · ${String(batch.subject || batch.name || "your batch")}`,
    body: clip(String(d.question ?? ""), 140),
  };
}

export function answerPush(d: FirebaseFirestore.DocumentData) {
  const teacher = String(d.teacherName || "The teacher");
  const child = first(String(d.studentName ?? ""));
  return {
    title: `${teacher} answered ${child ? `${child}'s` : "your"} doubt`,
    body: clip(String(d.answer ?? ""), 140),
  };
}

export async function handleDoubtCreated(event: FirestoreEvent<QueryDocumentSnapshot | undefined, { doubtId: string }>) {
  const snap = event.data;
  if (!snap) return;
  const d = snap.data();
  const db = getFirestore();
  const [batchSnap, studentSnap] = await Promise.all([
    db.doc(`batches/${d.batchId}`).get(),
    db.doc(`students/${d.studentId}`).get(),
  ]);
  const batch = batchSnap.data() ?? {};
  await snap.ref.update({
    batchName: String(batch.name ?? ""),
    subject: String(batch.subject ?? ""),
    teacherName: String(batch.teacherName ?? ""),
    // The child's name as the team saved it, not as typed in the browser.
    studentName: String(studentSnap.get("name") ?? d.studentName ?? ""),
  });
  const teacherPhone = String(batch.teacherPhone ?? "");
  if (!teacherPhone) return;
  try {
    await pushToPhones(
      [teacherPhone],
      {
        ...questionPush(d, batch),
        link: `/teacher?batch=${encodeURIComponent(String(d.batchId))}&doubt=${event.params.doubtId}`,
        tag: `doubt-${event.params.doubtId}`,
      },
      db,
    );
  } catch (e) {
    // The doubt is saved and waits on the teacher's Today screen either way.
    logger.error("doubt push failed", { doubtId: event.params.doubtId, error: String(e) });
  }
}

export async function handleDoubtUpdated(
  event: FirestoreEvent<Change<QueryDocumentSnapshot> | undefined, { doubtId: string }>,
) {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  // Only the first answer: a corrected answer, or the batch details filled in above, send nothing.
  if (!before || !after || before.status === "answered" || after.status !== "answered") return;
  const db = getFirestore();
  try {
    const parentPhone = String((await db.doc(`progress/${after.studentId}`).get()).get("parentPhone") ?? "");
    if (parentPhone)
      await pushToPhones(
        [parentPhone],
        { ...answerPush(after), link: "/parent/help", tag: `doubt-${event.params.doubtId}` },
        db,
      );
  } catch (e) {
    logger.error("answer push failed", { doubtId: event.params.doubtId, error: String(e) });
  }
}
