// Homework and notices: a teacher posts to one batch, the families of that batch get a push (the
// onNoticeCreated function) and see it on their Home screen. For homework, a parent ticks "Done" for their
// child, and the teacher sees how many children are done. Every read asks for one batch (batchId ==), which
// is what firestore.rules can check.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore/lite";

import { firebase } from "./session";

export type NoticeKind = "homework" | "notice";
export type Notice = {
  id: string;
  batchId: string;
  batchName: string;
  subject: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** Homework only: the day it is due, YYYY-MM-DD. */
  due: string | null;
  teacherName: string;
  /** Milliseconds since 1970. */
  createdAt: number;
};
export type NewNotice = { kind: NoticeKind; title: string; body: string; due: string | null };

const db = () => firebase().db;
const ms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : 0);

function toNotice(id: string, d: Record<string, unknown>): Notice {
  return {
    id,
    batchId: String(d["batchId"] ?? ""),
    batchName: String(d["batchName"] ?? ""),
    subject: String(d["subject"] ?? ""),
    kind: d["kind"] === "homework" ? "homework" : "notice",
    title: String(d["title"] ?? ""),
    body: String(d["body"] ?? ""),
    due: typeof d["due"] === "string" ? d["due"] : null,
    teacherName: String(d["teacherName"] ?? ""),
    createdAt: ms(d["createdAt"]),
  };
}

/** Newest first. */
export const byNewest = (a: Notice, b: Notice) => b.createdAt - a.createdAt;

export async function noticesFor(batchIds: string[]): Promise<Notice[]> {
  const lists = await Promise.all(
    [...new Set(batchIds)].map((id) =>
      getDocs(query(collection(db(), "notices"), where("batchId", "==", id))),
    ),
  );
  return lists.flatMap((snap) => snap.docs.map((d) => toNotice(d.id, d.data()))).sort(byNewest);
}

export async function addNotice(
  batch: { id: string; name: string; subject?: string | undefined },
  input: NewNotice,
  who: { uid: string; name: string },
) {
  const entry: Record<string, unknown> = {
    batchId: batch.id,
    batchName: batch.name.slice(0, 80),
    subject: (batch.subject ?? "").slice(0, 40),
    kind: input.kind,
    title: input.title,
    body: input.body,
    teacherName: who.name.slice(0, 80),
    createdBy: who.uid,
    createdAt: serverTimestamp(),
  };
  if (input.kind === "homework" && input.due) entry["due"] = input.due;
  await setDoc(doc(collection(db(), "notices")), entry);
}

export const removeNotice = (id: string) => deleteDoc(doc(db(), "notices", id));

/** How many children ticked Done, for the teacher's list. */
export async function doneCount(noticeId: string): Promise<number> {
  return (await getDocs(collection(db(), "notices", noticeId, "done"))).size;
}

/** Whether this child's homework is ticked, for the parent's list. */
export async function isDone(noticeId: string, studentId: string): Promise<boolean> {
  return (await getDoc(doc(db(), "notices", noticeId, "done", studentId))).exists();
}

export async function setDone(noticeId: string, studentId: string, uid: string, done: boolean) {
  const ref = doc(db(), "notices", noticeId, "done", studentId);
  if (done) await setDoc(ref, { at: serverTimestamp(), by: uid });
  else await deleteDoc(ref);
}
