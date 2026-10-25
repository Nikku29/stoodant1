// Live classes for the app: the teacher schedules through the scheduleClasses / changeClass functions,
// families read their children's batches and record a Join tap. Every read asks for one batch at a time
// (batchId ==), which is what firestore.rules can check.
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore/lite";

import { firebase } from "./session";

export type LiveClass = {
  id: string;
  batchId: string;
  batchName: string;
  subject: string;
  teacherName: string;
  topic: string;
  joinUrl: string;
  /** Milliseconds since 1970. */
  startAt: number;
  endAt: number;
  durationMinutes: number;
  status: "scheduled" | "cancelled";
  seriesId: string | null;
};
export type Clash = { at: string; with: string; who: "teacher" | "student"; name: string };
export type SaveResult = { saved: boolean; clashes?: Clash[]; changed?: number };

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : Number(v) || 0);

function toClass(id: string, d: Record<string, unknown>): LiveClass {
  return {
    id,
    batchId: String(d["batchId"] ?? ""),
    batchName: String(d["batchName"] ?? ""),
    subject: String(d["subject"] ?? ""),
    teacherName: String(d["teacherName"] ?? ""),
    topic: String(d["topic"] ?? ""),
    joinUrl: String(d["joinUrl"] ?? ""),
    startAt: ms(d["startAt"]),
    endAt: ms(d["endAt"]),
    durationMinutes: Number(d["durationMinutes"] ?? 60),
    status: d["status"] === "cancelled" ? "cancelled" : "scheduled",
    seriesId: typeof d["seriesId"] === "string" ? d["seriesId"] : null,
  };
}

/** Classes of these batches that end after `from` (default: 3 hours ago), soonest first. */
export async function classesFor(batchIds: string[], from = Date.now() - 3 * 3_600_000): Promise<LiveClass[]> {
  const { db } = firebase();
  const lists = await Promise.all(
    [...new Set(batchIds)].map((batchId) =>
      getDocs(
        query(
          collection(db, "liveClasses"),
          where("batchId", "==", batchId),
          where("startAt", ">=", Timestamp.fromMillis(from - 4 * 3_600_000)),
          orderBy("startAt"),
          limit(60),
        ),
      ),
    ),
  );
  return lists
    .flatMap((snap) => snap.docs.map((d) => toClass(d.id, d.data())))
    .filter((c) => c.endAt >= from)
    .sort((a, b) => a.startAt - b.startAt);
}

/** The link used last time for this batch, so the teacher pastes it only once. */
export async function lastLink(batchId: string): Promise<string> {
  const { db } = firebase();
  const snap = await getDocs(
    query(collection(db, "liveClasses"), where("batchId", "==", batchId), orderBy("startAt", "desc"), limit(1)),
  );
  return String(snap.docs[0]?.get("joinUrl") ?? "");
}

export type NewClasses = {
  batchId: string;
  /** ISO times with the India offset, e.g. 2026-10-28T17:00:00+05:30. */
  starts: string[];
  durationMinutes: number;
  joinUrl: string;
  topic: string;
  force?: boolean;
};
export const scheduleClasses = (input: NewClasses) => firebase().call<SaveResult>("scheduleClasses", input);

export type ClassChange =
  | { classId: string; action: "cancel"; following?: boolean }
  | { classId: string; action: "move"; startAt: string; durationMinutes?: number; force?: boolean }
  | { classId: string; action: "edit"; joinUrl?: string; topic?: string; following?: boolean };
export const changeClass = (input: ClassChange) => firebase().call<SaveResult>("changeClass", input);

/** Records that a child joined (the parent tapped Join). Never blocks opening the class. */
export async function markJoined(classId: string, studentId: string, uid: string) {
  await setDoc(doc(firebase().db, "liveClasses", classId, "joins", studentId), {
    at: serverTimestamp(),
    by: uid,
  });
}

/** Children who tapped Join in any of these classes. */
export async function joinedIn(classIds: string[]): Promise<Set<string>> {
  const { db } = firebase();
  const lists = await Promise.all(classIds.map((id) => getDocs(collection(db, "liveClasses", id, "joins"))));
  return new Set(lists.flatMap((snap) => snap.docs.map((d) => d.id)));
}
