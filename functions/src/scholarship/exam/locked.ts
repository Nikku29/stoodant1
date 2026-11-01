import { Timestamp, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { keyedHash } from "../../lib/hash.js";
import { loadBankVersioned, lockQuestions, makePaper, paperKey, showPaper, type PaperItem, type ShownQuestion } from "./paper.js";

/**
 * examPapers/{rollNo}: one student's paper, made once (when the team confirms the fee, or on the first download)
 * and kept. Holds the questions in this student's order, the answer key for marking, and the same questions
 * locked with the student's key for downloading ahead of the exam. Read only by Cloud Functions.
 */
export type LockedPaper = {
  rollNo: string;
  studentClass: string;
  /** Which bank upload it was made from. */
  version: string;
  paper: PaperItem[];
  questions: ShownQuestion[];
  iv: string;
  data: string;
  createdAt: Timestamp;
};

/**
 * This student's paper, made now if there isn't one. With `refresh`, a paper made from an older bank upload is
 * made again from the new one (only before the exam has started: an attempt keeps the paper it began with).
 * Null when the bank has no questions for the class yet.
 */
export async function lockedPaper(pepper: string, rollNo: string, studentClass: string, refresh: boolean): Promise<LockedPaper | null> {
  const ref = getFirestore().doc(`examPapers/${rollNo}`);
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data() as LockedPaper) : null;
  if (existing && !refresh) return existing;
  const { byClass, version } = await loadBankVersioned();
  if (existing && existing.version === version) return existing;
  const bank = byClass.get(studentClass) ?? [];
  const paper = makePaper(bank, keyedHash(pepper, `scholarship-paper:${rollNo}`));
  if (paper.length < 4) return existing;
  const questions = showPaper(paper, bank);
  const doc: LockedPaper = {
    rollNo, studentClass, version, paper, questions, ...lockQuestions(questions, paperKey(pepper, rollNo)), createdAt: Timestamp.now(),
  };
  await ref.set(doc);
  return doc;
}

/** What the browser downloads ahead of the exam: the locked questions only. */
export const download = (p: LockedPaper | DocumentData) => ({ version: p["version"] as string, iv: p["iv"] as string, data: p["data"] as string });
