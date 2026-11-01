// The team's view of scholarship test registrations (created only by the submitScholarship function).
import {
  collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where, writeBatch,
  type QueryDocumentSnapshot, type Timestamp,
} from "firebase/firestore/lite";
import { firebaseApp } from "./app";
import { firebase } from "./session";

export type Registration = {
  regNo: string;
  studentName: string;
  studentClass: string;
  dob: string;
  school: string;
  city: string;
  /** Missing on the first few registrations, made before the form asked for it. */
  pincode?: string;
  parentName: string;
  parentPhoneE164: string;
  photoPath: string;
  keyId?: string;
  status: string;
  fee?: number;
  payment?: { status: PayStatus; utr?: string; submittedAt?: Timestamp; checkedAt?: Timestamp; checkedBy?: string };
  /** Exam roll number, given by the onScholarshipUpdated function a moment after the fee is confirmed. */
  rollNo?: string;
  slotId?: string;
  createdAt?: Timestamp;
};

export type PayStatus = "due" | "submitted" | "paid" | "rejected";
export const payStatus = (r: Registration): PayStatus => r.payment?.status ?? "due";

export type Page = { rows: Registration[]; next: QueryDocumentSnapshot | null };

const db = () => firebase().db;
const PAGE = 100;

/** Newest first, a hundred at a time. */
export async function listRegistrations(after: QueryDocumentSnapshot | null = null): Promise<Page> {
  const base = [orderBy("createdAt", "desc"), limit(PAGE)] as const;
  const q = after
    ? query(collection(db(), "scholarshipRegistrations"), orderBy("createdAt", "desc"), startAfter(after), limit(PAGE))
    : query(collection(db(), "scholarshipRegistrations"), ...base);
  const snap = await getDocs(q);
  return { rows: snap.docs.map((d) => d.data() as Registration), next: snap.docs.length === PAGE ? snap.docs.at(-1)! : null };
}

/** Every registration, for the spreadsheet download (one read per child). */
export async function allRegistrations(): Promise<Registration[]> {
  const rows: Registration[] = [];
  let next: QueryDocumentSnapshot | null = null;
  do {
    const page = await listRegistrations(next);
    rows.push(...page.rows);
    next = page.next;
  } while (next);
  return rows;
}

/** By registration number (SS26-10-00042), exam roll number (261000042) or the parent's 10-digit mobile number. */
export async function findRegistration(search: string): Promise<Registration | null> {
  const digits = search.replace(/\D/g, "");
  if (/^\d{9}$/.test(search.trim())) {
    const snap = await getDocs(query(collection(db(), "scholarshipRegistrations"), where("rollNo", "==", digits), limit(1)));
    return snap.empty ? null : (snap.docs[0]!.data() as Registration);
  }
  if (/^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits)) {
    const phone = `+91${digits.slice(-10)}`;
    const snap = await getDocs(query(collection(db(), "scholarshipRegistrations"), where("parentPhoneE164", "==", phone), limit(1)));
    return snap.empty ? null : (snap.docs[0]!.data() as Registration);
  }
  const snap = await getDoc(doc(db(), "scholarshipRegistrations", search.trim().toUpperCase()));
  return snap.exists() ? (snap.data() as Registration) : null;
}

/** The team confirms the ₹99 fee reached the bank account (paid), or marks it not received so the family can send it again. */
export async function checkPayment(r: Registration, status: "paid" | "rejected", uid: string): Promise<void> {
  const payment = { ...(r.payment ?? {}), status, checkedAt: serverTimestamp(), checkedBy: uid };
  await updateDoc(doc(db(), "scholarshipRegistrations", r.regNo), { payment, updatedAt: serverTimestamp() });
}

/** One registration read again, e.g. to pick up the roll number the function adds after a confirm. */
export async function readRegistration(regNo: string): Promise<Registration | null> {
  const snap = await getDoc(doc(db(), "scholarshipRegistrations", regNo));
  return snap.exists() ? (snap.data() as Registration) : null;
}

/** Registrations per class, from the counters the function keeps (no matter how many there are, two reads). */
export async function registrationCounts(): Promise<Record<"9" | "10", number>> {
  const [nine, ten] = await Promise.all(["9", "10"].map((c) => getDoc(doc(db(), "counters", `scholarship-class-${c}`))));
  return { "9": (nine!.get("count") as number | undefined) ?? 0, "10": (ten!.get("count") as number | undefined) ?? 0 };
}

/** Removes a registration and its duplicate-check key, so the same child can register again. Numbers are not reused. */
export async function deleteRegistration(r: Registration): Promise<void> {
  const batch = writeBatch(db());
  batch.delete(doc(db(), "scholarshipRegistrations", r.regNo));
  if (r.keyId) batch.delete(doc(db(), "scholarshipKeys", r.keyId));
  await batch.commit();
}

export async function photoUrl(path: string): Promise<string> {
  const { getStorage, ref, getDownloadURL, connectStorageEmulator } = await import("firebase/storage");
  const bucket = getStorage(firebaseApp());
  if (import.meta.env["VITE_USE_EMULATORS"] === "1") connectStorageEmulator(bucket, "127.0.0.1", 9199);
  return getDownloadURL(ref(bucket, path));
}

const CSV_COLUMNS: [string, (r: Registration) => string][] = [
  ["Registration no.", (r) => r.regNo],
  ["Roll no.", (r) => r.rollNo ?? ""],
  ["Exam hour", (r) => r.slotId ?? ""],
  ["Student", (r) => r.studentName],
  ["Class", (r) => r.studentClass],
  ["Date of birth", (r) => r.dob],
  ["School", (r) => r.school],
  ["City", (r) => r.city],
  ["PIN code", (r) => r.pincode ?? ""],
  ["Parent", (r) => r.parentName],
  ["Phone", (r) => r.parentPhoneE164],
  ["Fee", (r) => payStatus(r)],
  ["UPI reference", (r) => r.payment?.utr ?? ""],
  ["Registered", (r) => r.createdAt?.toDate().toISOString() ?? ""],
];

/** Spreadsheet text. Cells starting with = + - @ are prefixed so Excel never runs them as formulas. */
export function registrationsCsv(rows: Registration[]): string {
  const cell = (v: string) => {
    const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return [CSV_COLUMNS.map(([h]) => h), ...rows.map((r) => CSV_COLUMNS.map(([, get]) => get(r)))].map((line) => line.map(cell).join(",")).join("\n");
}

// ---------- The exam (10 and 11 Nov): slot limits, question bank, results ----------

export type ExamSettings = { capacity: number; bankUploadedAt?: Timestamp; bankCounts?: Record<string, number> };
export async function examSettings(): Promise<ExamSettings> {
  const snap = await getDoc(doc(db(), "settings", "scholarshipExam"));
  return { capacity: 600, ...(snap.exists() ? (snap.data() as Partial<ExamSettings>) : {}) } as ExamSettings;
}
export async function saveExamSettings(next: ExamSettings, uid: string): Promise<void> {
  const { setDoc } = await import("firebase/firestore/lite");
  await setDoc(doc(db(), "settings", "scholarshipExam"), { ...next, updatedBy: uid, updatedAt: serverTimestamp() });
}

/** How many families booked each hour. */
export async function slotCounts(ids: string[]): Promise<Record<string, number>> {
  const snaps = await Promise.all(ids.map((id) => getDoc(doc(db(), "counters", `scholarship-slot-${id}`))));
  return Object.fromEntries(ids.map((id, i) => [id, (snaps[i]!.get("count") as number | undefined) ?? 0]));
}

type BankItem = { id: string; class: string; subject: string; level: string; text: string; options: string[]; answer: number };
/** Checks a question bank file and counts the different questions per class and subject (what the exam can use). */
export function checkBank(raw: unknown): { ok: boolean; counts: Record<string, number>; problems: string[] } {
  const problems: string[] = [];
  const counts: Record<string, number> = {};
  if (!Array.isArray(raw)) return { ok: false, counts, problems: ["The file is not a list of questions."] };
  const seen = new Set<string>();
  for (const q of raw as BankItem[]) {
    const valid = q && typeof q.id === "string" && typeof q.text === "string" && Array.isArray(q.options) && q.options.length === 4
      && new Set(q.options).size === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3
      && ["maths", "science", "reasoning", "english"].includes(q.subject) && ["easy", "medium", "hard"].includes(q.level);
    if (!valid) { problems.push(`Skipped: ${String(q?.id ?? "?")}`); continue; }
    const key = `${q.class}|${q.subject}|${q.text}|${[...q.options].sort().join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[`${q.class}-${q.subject}`] = (counts[`${q.class}-${q.subject}`] ?? 0) + 1;
  }
  return { ok: Object.keys(counts).length > 0, counts, problems };
}
export async function uploadBank(file: File): Promise<void> {
  const sdk = await import("firebase/storage");
  const b = sdk.getStorage(firebaseApp());
  if (import.meta.env["VITE_USE_EMULATORS"] === "1") sdk.connectStorageEmulator(b, "127.0.0.1", 9199);
  await sdk.uploadBytes(sdk.ref(b, "private/exam/bank.json"), file, { contentType: "application/json" });
}

export type Attempt = {
  rollNo: string; regNo: string; studentName: string; studentClass: string; slotId: string; status: string; strikes: number;
  startedAt?: Timestamp; submittedAt?: Timestamp; timeTakenMs?: number;
  /** Camera photos taken during the test, and whether the camera was refused. */
  photos?: number; cameraOff?: boolean;
  score?: { marks: number; correct: number; wrong: number; unanswered: number; bySubject: Record<string, { correct: number; wrong: number }> };
};
/** The camera photos of one student's test, oldest first, as links the team can open. */
export async function examPhotos(rollNo: string): Promise<string[]> {
  const { getStorage, ref, listAll, getDownloadURL, connectStorageEmulator } = await import("firebase/storage");
  const bucket = getStorage(firebaseApp());
  if (import.meta.env["VITE_USE_EMULATORS"] === "1") connectStorageEmulator(bucket, "127.0.0.1", 9199);
  const list = await listAll(ref(bucket, `private/exam-photos/${rollNo}`));
  const items = [...list.items].sort((a, b) => a.name.localeCompare(b.name));
  return Promise.all(items.map((i) => getDownloadURL(i)));
}
/** Every paper of one class, best first: more marks, then less time taken. */
export async function classResults(studentClass: string): Promise<Attempt[]> {
  const snap = await getDocs(query(collection(db(), "examAttempts"), where("studentClass", "==", studentClass)));
  return snap.docs.map((d) => d.data() as Attempt).sort((a, b) =>
    (b.score?.marks ?? -1) - (a.score?.marks ?? -1) || (a.timeTakenMs ?? Infinity) - (b.timeTakenMs ?? Infinity));
}
export function resultsCsv(rows: Attempt[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const head = ["Rank", "Roll no.", "Registration no.", "Student", "Class", "Hour", "Status", "Marks", "Correct", "Wrong", "Unanswered", "Maths", "Science", "Reasoning", "English", "Minutes", "Warnings", "Photos", "Camera"];
  const lines = rows.map((r, i) => [
    String(i + 1), r.rollNo, r.regNo, r.studentName, r.studentClass, r.slotId, r.status, String(r.score?.marks ?? ""),
    String(r.score?.correct ?? ""), String(r.score?.wrong ?? ""), String(r.score?.unanswered ?? ""),
    ...["maths", "science", "reasoning", "english"].map((s) => String(r.score?.bySubject[s]?.correct ?? "")),
    r.timeTakenMs ? (r.timeTakenMs / 60000).toFixed(1) : "", String(r.strikes ?? 0),
    String(r.photos ?? 0), r.cameraOff ? "Off" : "On",
  ]);
  return [head, ...lines].map((l) => l.map(cell).join(",")).join("\n");
}
