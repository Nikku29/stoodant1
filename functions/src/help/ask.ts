import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { alertTeam } from "../notify/team.js";

// "Need help?" from a parent or teacher in the app. askForHelp checks who is asking and saves
// helpRequests/{id}; onHelpRequested then alerts the team. The team sees and closes them on /admin.

export const HELP_TOPICS = {
  class: "Live class or Join",
  login: "Logging in",
  fees: "Fees or payment",
  other: "Something else",
} as const;
export type HelpTopic = keyof typeof HELP_TOPICS;

const MAX_MESSAGE = 600;
/** Requests one person can send per hour; enough for a real problem, not enough to flood the team. */
export const MAX_PER_HOUR = 3;

export async function handleAskForHelp(request: CallableRequest): Promise<{ saved: true }> {
  const auth = request.auth;
  const phone = typeof auth?.token.phone_number === "string" ? auth.token.phone_number : "";
  if (!auth || !phone) throw new HttpsError("unauthenticated", "Please log in again.");
  const data = (request.data ?? {}) as Record<string, unknown>;
  const topic = String(data.topic) as HelpTopic;
  if (!(topic in HELP_TOPICS)) throw new HttpsError("invalid-argument", "Pick what the help is about.");
  const message = typeof data.message === "string" ? data.message.trim().slice(0, MAX_MESSAGE) : "";
  if (message.length < 3) throw new HttpsError("invalid-argument", "Please write a line about the problem.");

  const db = getFirestore();
  const recent = await db
    .collection("helpRequests")
    .where("uid", "==", auth.uid)
    .where("createdAt", ">=", Timestamp.fromMillis(Date.now() - 3_600_000))
    .count()
    .get();
  if (recent.data().count >= MAX_PER_HOUR)
    throw new HttpsError("resource-exhausted", "We already have your messages. The team will call you soon.");

  const [teacher, children] = await Promise.all([
    db.collection("teachers").where("phone", "==", phone).limit(1).get(),
    db.collection("progress").where("parentPhone", "==", phone).limit(5).get(),
  ]);
  const role = teacher.empty ? (children.empty ? "unknown" : "parent") : "teacher";
  const name = teacher.empty
    ? children.docs.map((d) => String(d.get("student.name") ?? "")).filter(Boolean).join(", ")
    : String(teacher.docs[0]!.get("name") ?? "");

  await db.collection("helpRequests").add({
    uid: auth.uid,
    phone,
    role,
    // A parent is named by their children ("Aarav's parent"), a teacher by their own name.
    name: name.slice(0, 120),
    topic,
    message,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { saved: true };
}

export async function handleHelpRequested(event: FirestoreEvent<QueryDocumentSnapshot | undefined, { requestId: string }>) {
  const snap = event.data;
  if (!snap) return;
  const d = snap.data();
  const id = event.params.requestId;
  const who = d.role === "teacher" ? `Teacher ${d.name}` : d.name ? `Parent of ${d.name}` : "A parent";
  const topic = HELP_TOPICS[d.topic as HelpTopic] ?? "Help";
  const alerts = await alertTeam({
    key: `help-${id}`,
    subject: `Help needed: ${topic} (${who})`,
    lines: [`From: ${who}`, `Phone: ${d.phone}`, `About: ${topic}`, "", String(d.message), "", "Open: https://app.stoodant.com/admin?tab=help"],
    push: { title: `Help needed: ${topic}`, body: `${who}: ${String(d.message).slice(0, 120)}`, link: "/admin?tab=help", tag: `help-${id}` },
  });
  await snap.ref.update({ alerts: { ...alerts, at: FieldValue.serverTimestamp() } }).catch((error: { code?: unknown }) => {
    if (error.code !== 5) throw error;
  });
  logger.info("help_alerts", { id, ...alerts });
}
