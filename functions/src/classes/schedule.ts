import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp, getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { pushToPhones } from "../notify/push.js";
import {
  MAX_MINUTES, MIN_MINUTES, checkStarts, meetingLink, overlaps, when, type Slot,
} from "./rules.js";

// Live classes (liveClasses/{id}). Only these functions write them: a teacher schedules, moves or cancels
// classes of their own batches; the team can do it for any batch. Families of the batch are told straight
// away, and reminded 5 minutes before the start (reminders.ts). Rules let the batch's teacher, its
// families and the team read them; parents record a tap on Join under joins/{studentId}.

type Batch = FirebaseFirestore.DocumentData & { id: string };
export type Clash = { at: string; with: string; who: "teacher" | "student"; name: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function batchFor(db: Firestore, request: CallableRequest, batchId: unknown): Promise<Batch> {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Please log in again.");
  if (typeof batchId !== "string" || !batchId || batchId.includes("/"))
    throw new HttpsError("invalid-argument", "Pick a batch.");
  const snap = await db.doc(`batches/${batchId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "This batch no longer exists.");
  const batch: Batch = { ...snap.data()!, id: snap.id };
  const admin = auth.token.admin === true;
  const teacher =
    typeof auth.token.phone_number === "string" &&
    auth.token.phone_number === batch.teacherPhone &&
    batch.active !== false;
  if (!admin && !teacher) throw new HttpsError("permission-denied", "Only this batch's teacher can do that.");
  return batch;
}

function minutes(value: unknown, fallback: number) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < MIN_MINUTES || n > MAX_MINUTES)
    throw new HttpsError("invalid-argument", `A class lasts between ${MIN_MINUTES} and ${MAX_MINUTES} minutes.`);
  return n;
}

function link(value: unknown) {
  const url = meetingLink(value);
  if (!url) throw new HttpsError("invalid-argument", "Paste a Zoom or Google Meet link (it starts with https://).");
  return url;
}

/** Other classes at the same time for this teacher, or for any child of the batch in their other batches. */
async function clashes(db: Firestore, batch: Batch, slots: Slot[], ignore: Set<string>): Promise<Clash[]> {
  if (!slots.length) return [];
  const from = Timestamp.fromMillis(Math.min(...slots.map((s) => s.start)) - MAX_MINUTES * 60_000);
  const to = Timestamp.fromMillis(Math.max(...slots.map((s) => s.end)));
  const window = (q: FirebaseFirestore.Query) =>
    q.where("status", "==", "scheduled").where("startAt", ">=", from).where("startAt", "<", to).get();

  const found: Clash[] = [];
  const check = (docs: FirebaseFirestore.QueryDocumentSnapshot[], who: Clash["who"], name: (d: FirebaseFirestore.DocumentData) => string) => {
    for (const doc of docs) {
      if (ignore.has(doc.id)) continue;
      const other = { start: doc.get("startAt").toMillis(), end: doc.get("endAt").toMillis() };
      if (slots.some((s) => overlaps(s, other)))
        found.push({ at: when(other.start), with: String(doc.get("batchName") ?? ""), who, name: name(doc.data()) });
    }
  };

  if (batch.teacherId) {
    const teacherClasses = await window(db.collection("liveClasses").where("teacherId", "==", batch.teacherId));
    check(teacherClasses.docs.filter((d) => d.get("batchId") !== batch.id), "teacher", (d) => String(d.teacherName ?? "The teacher"));
  }
  // Children in this batch who also sit in other batches.
  const students = await db.collection("students").where("batchIds", "array-contains", batch.id).get();
  const otherBatches = new Map<string, string[]>();
  for (const s of students.docs) {
    if (s.get("active") === false) continue;
    for (const id of (s.get("batchIds") ?? []) as string[])
      if (id !== batch.id) otherBatches.set(id, [...(otherBatches.get(id) ?? []), String(s.get("name") ?? "")]);
  }
  const ids = [...otherBatches.keys()];
  for (let i = 0; i < ids.length; i += 30) {
    const part = await window(db.collection("liveClasses").where("batchId", "in", ids.slice(i, i + 30)));
    for (const doc of part.docs) check([doc], "student", () => (otherBatches.get(doc.get("batchId")) ?? []).join(", "));
  }
  return found;
}

async function familyPhones(db: Firestore, batchId: string): Promise<string[]> {
  return ((await db.doc(`batchAccess/${batchId}`).get()).get("parentPhones") ?? []) as string[];
}

async function tellFamilies(db: Firestore, batchId: string, title: string, body: string, tag: string) {
  try {
    await pushToPhones(await familyPhones(db, batchId), { title, body, link: "/parent", tag });
  } catch (e) {
    // The class is saved either way; a failed notification must not undo it.
    logger.error("class notification failed", { batchId, error: String(e) });
  }
}

const subjectOf = (batch: FirebaseFirestore.DocumentData) => String(batch.subject || batch.name || "Class");

/**
 * Schedules one class, or the same class on several dates (a weekly series the app builds from the days
 * picked). Returns the clashes found instead of saving, unless `force` is set.
 */
export async function handleScheduleClasses(request: CallableRequest) {
  const db = getFirestore();
  const data = (request.data ?? {}) as Record<string, unknown>;
  const batch = await batchFor(db, request, data.batchId);
  const starts = checkStarts(data.starts, Date.now());
  if (typeof starts === "string") throw new HttpsError("invalid-argument", starts);
  const duration = minutes(data.durationMinutes, Number(batch.durationMinutes) || 60);
  const joinUrl = link(data.joinUrl);
  const topic = str(data.topic, 120);
  const slots = starts.map((start) => ({ start, end: start + duration * 60_000 }));

  const found = await clashes(db, batch, slots, new Set());
  if (found.length && data.force !== true) return { saved: false, clashes: found.slice(0, 10) };

  const seriesId = starts.length > 1 ? randomUUID() : null;
  const write = db.batch();
  const ids: string[] = [];
  for (const slot of slots) {
    const ref = db.collection("liveClasses").doc();
    ids.push(ref.id);
    write.create(ref, {
      batchId: batch.id,
      batchName: String(batch.name ?? ""),
      subject: String(batch.subject ?? ""),
      classLevel: String(batch.classLevel ?? ""),
      teacherId: String(batch.teacherId ?? ""),
      teacherName: String(batch.teacherName ?? ""),
      topic,
      joinUrl,
      startAt: Timestamp.fromMillis(slot.start),
      endAt: Timestamp.fromMillis(slot.end),
      durationMinutes: duration,
      status: "scheduled",
      seriesId,
      createdBy: request.auth!.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await write.commit();

  const first = when(slots[0]!.start);
  const body =
    slots.length === 1
      ? `${first}${topic ? `: ${topic}` : ""}. You'll get a reminder 5 minutes before.`
      : `${slots.length} classes from ${first}. You'll get a reminder 5 minutes before each.`;
  await tellFamilies(db, batch.id, `New ${subjectOf(batch)} class${slots.length > 1 ? "es" : ""}`, body, `new-${ids[0]}`);
  return { saved: true, ids, clashes: found.slice(0, 10) };
}

/**
 * Move, cancel or edit a class. `following: true` applies a cancel or a link/topic change to this class
 * and the later ones in its weekly series.
 */
export async function handleChangeClass(request: CallableRequest) {
  const db = getFirestore();
  const data = (request.data ?? {}) as Record<string, unknown>;
  if (typeof data.classId !== "string" || !data.classId || data.classId.includes("/"))
    throw new HttpsError("invalid-argument", "Pick a class.");
  const ref = db.doc(`liveClasses/${data.classId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "This class no longer exists.");
  const current = snap.data()!;
  const batch = await batchFor(db, request, current.batchId);
  const startMs: number = current.startAt.toMillis();
  if (current.status !== "scheduled") throw new HttpsError("failed-precondition", "This class was cancelled.");
  if (current.endAt.toMillis() < Date.now()) throw new HttpsError("failed-precondition", "This class is already over.");

  const targets = async () => {
    if (data.following !== true || !current.seriesId) return [snap];
    const series = await db.collection("liveClasses").where("seriesId", "==", current.seriesId).get();
    return series.docs.filter((d) => d.get("startAt").toMillis() >= startMs && d.get("status") === "scheduled");
  };
  const stamp = { updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth!.uid };
  const subject = subjectOf(batch);

  if (data.action === "cancel") {
    const docs = await targets();
    const write = db.batch();
    for (const d of docs) write.update(d.ref, { status: "cancelled", ...stamp });
    await write.commit();
    const body = docs.length > 1 ? `Classes from ${when(startMs)} onwards are cancelled.` : `The class on ${when(startMs)} is cancelled.`;
    await tellFamilies(db, batch.id, `${subject} class cancelled`, body, `class-${snap.id}`);
    return { saved: true, changed: docs.length };
  }

  if (data.action === "move") {
    const starts = checkStarts([data.startAt], Date.now());
    if (typeof starts === "string") throw new HttpsError("invalid-argument", starts);
    const duration = minutes(data.durationMinutes, current.durationMinutes);
    const slot = { start: starts[0]!, end: starts[0]! + duration * 60_000 };
    const found = await clashes(db, batch, [slot], new Set([snap.id]));
    if (found.length && data.force !== true) return { saved: false, clashes: found.slice(0, 10) };
    await ref.update({
      startAt: Timestamp.fromMillis(slot.start),
      endAt: Timestamp.fromMillis(slot.end),
      durationMinutes: duration,
      ...stamp,
    });
    if (slot.start !== startMs)
      await tellFamilies(db, batch.id, `${subject} class moved`, `Now on ${when(slot.start)} (was ${when(startMs)}).`, `class-${snap.id}`);
    return { saved: true, changed: 1, clashes: found.slice(0, 10) };
  }

  if (data.action === "edit") {
    const update: Record<string, unknown> = { ...stamp };
    if (data.joinUrl !== undefined) update.joinUrl = link(data.joinUrl);
    if (data.topic !== undefined) update.topic = str(data.topic, 120);
    const docs = await targets();
    const write = db.batch();
    for (const d of docs) write.update(d.ref, update);
    await write.commit();
    return { saved: true, changed: docs.length };
  }

  throw new HttpsError("invalid-argument", "Unknown change.");
}
