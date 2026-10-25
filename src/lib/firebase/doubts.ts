// Doubts: a family asks one of the child's teachers a question from the app; the teacher answers it there.
// Each side gets a push (the onDoubtCreated and onDoubtAnswered functions). The functions also fill in the
// batch's name, subject and teacher, so those can't be made up from the browser. Every read asks for one
// child (studentId ==) or one batch (batchId ==), which is what firestore.rules can check.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore/lite";

import { firebase } from "./session";

export type Doubt = {
  id: string;
  batchId: string;
  batchName: string;
  subject: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  question: string;
  status: "open" | "answered";
  answer: string;
  /** Milliseconds since 1970. */
  createdAt: number;
  answeredAt: number;
};

const db = () => firebase().db;
const ms = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function toDoubt(id: string, d: Record<string, unknown>): Doubt {
  return {
    id,
    batchId: str(d["batchId"]),
    batchName: str(d["batchName"]),
    subject: str(d["subject"]),
    teacherName: str(d["teacherName"]),
    studentId: str(d["studentId"]),
    studentName: str(d["studentName"]),
    question: str(d["question"]),
    status: d["status"] === "answered" ? "answered" : "open",
    answer: str(d["answer"]),
    // Just written: the server's time isn't back yet, so it counts as now.
    createdAt: ms(d["createdAt"]) || Date.now(),
    answeredAt: ms(d["answeredAt"]),
  };
}

const newestFirst = (a: Doubt, b: Doubt) => b.createdAt - a.createdAt;

/** One child's doubts, for the family. */
export async function doubtsOfChild(studentId: string): Promise<Doubt[]> {
  const snap = await getDocs(query(collection(db(), "doubts"), where("studentId", "==", studentId)));
  return snap.docs.map((d) => toDoubt(d.id, d.data())).sort(newestFirst);
}

/** One batch's doubts, for its teacher. */
export async function doubtsOfBatch(batchId: string): Promise<Doubt[]> {
  const snap = await getDocs(query(collection(db(), "doubts"), where("batchId", "==", batchId)));
  return snap.docs.map((d) => toDoubt(d.id, d.data())).sort(newestFirst);
}

export async function askDoubt(input: {
  batchId: string;
  studentId: string;
  studentName: string;
  question: string;
  uid: string;
}) {
  await setDoc(doc(collection(db(), "doubts")), {
    batchId: input.batchId,
    studentId: input.studentId,
    studentName: input.studentName.slice(0, 80),
    question: input.question,
    status: "open",
    askedBy: input.uid,
    createdAt: serverTimestamp(),
  });
}

/** A family takes back a question nobody has answered yet. */
export const withdrawDoubt = (id: string) => deleteDoc(doc(db(), "doubts", id));

export async function answerDoubt(id: string, answer: string, uid: string) {
  await updateDoc(doc(db(), "doubts", id), {
    answer,
    status: "answered",
    answeredBy: uid,
    answeredAt: serverTimestamp(),
  });
}
