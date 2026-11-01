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

/** By registration number (SS26-10-00042) or the parent's 10-digit mobile number. */
export async function findRegistration(search: string): Promise<Registration | null> {
  const digits = search.replace(/\D/g, "");
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
