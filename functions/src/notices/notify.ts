import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { pushToPhones } from "../notify/push.js";

// Homework and notices (notices/{id}): the batch's teacher posts one from the app (the rules check who and
// what); this tells the families of that batch straight away with a push that opens their Home screen.

const DAY = 86_400_000;

/** "due tomorrow", "due Mon 27 Oct": short enough for a phone notification. */
export function dueText(due: string, today: string): string {
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  const d = new Date(`${due}T00:00:00Z`);
  return `due ${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}`;
}

const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export function noticePush(d: FirebaseFirestore.DocumentData, today = istToday()) {
  const subject = String(d.subject || d.batchName || "Class");
  const homework = d.kind === "homework";
  const title = homework ? `New homework: ${subject}` : `Notice from ${d.teacherName || "your teacher"}`;
  const parts = [String(d.title ?? "")];
  if (homework && typeof d.due === "string") parts.push(dueText(d.due, today));
  return { title, body: parts.join(", ").slice(0, 160) };
}

export async function handleNoticeCreated(event: FirestoreEvent<QueryDocumentSnapshot | undefined, { noticeId: string }>) {
  const snap = event.data;
  if (!snap) return;
  const d = snap.data();
  const db = getFirestore();
  try {
    const phones = ((await db.doc(`batchAccess/${d.batchId}`).get()).get("parentPhones") ?? []) as string[];
    await pushToPhones(phones, { ...noticePush(d), link: "/parent", tag: `notice-${event.params.noticeId}` }, db);
  } catch (e) {
    // The notice is saved and shows on the families' Home screen either way.
    logger.error("notice push failed", { noticeId: event.params.noticeId, error: String(e) });
  }
}
