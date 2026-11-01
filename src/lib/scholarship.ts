// Sends a scholarship test registration (with a small JPEG of the student's photo) to the submitScholarship
// Cloud Function, and the UPI reference for the test fee to scholarshipPayment. Same transport as the demo
// form in lead.ts: App Check header, idempotency key, retries.
import { warmUpLeadForm } from "./lead";

export type ScholarshipFields = {
  studentName: string; studentClass: string; dob: string; school: string; city: string; pincode: string; parentName: string; phone: string; photo: string;
};
export type PayStatus = "due" | "submitted" | "paid" | "rejected";
/** What the page shows after registering. Kept in this browser so the slip is still there on the next visit. */
export type Registered = {
  regNo: string;
  existing: boolean;
  studentName: string;
  studentClass: string;
  payment: { amount: number; status: PayStatus; token: string; upi: { upiId: string; payeeName: string } | null };
  /** The exam roll number: only once the team has confirmed the fee. */
  rollNo?: string;
  /** The booked exam hour, e.g. "2026-11-10T17" (picked once the fee is confirmed). */
  slotId?: string | null;
};
export type ScholarshipResult =
  | ({ ok: true } & Registered)
  | { ok: false; reason: "invalid" | "rate_limited" | "network" | "phone_taken"; fields?: string[] | undefined };

const LEAD_ENDPOINT = import.meta.env["VITE_LEAD_ENDPOINT"] as string | undefined;
// Production sets VITE_LEAD_ENDPOINT to the submitLead function's address; these functions sit next to it.
const endpoint = (fn: string, local: string) =>
  LEAD_ENDPOINT?.endsWith("/submitLead") ? LEAD_ENDPOINT.replace(/submitLead$/, fn) : local;
const ENDPOINT = (import.meta.env["VITE_SCHOLARSHIP_ENDPOINT"] as string | undefined) ?? endpoint("submitScholarship", "/api/scholarship");
const PAY_ENDPOINT = endpoint("scholarshipPayment", "/api/scholarship-payment");
export const SLOT_ENDPOINT = endpoint("scholarshipSlot", "/api/scholarship-slot");
export const EXAM_ENDPOINT = endpoint("scholarshipExam", "/api/scholarship-exam");
const ATTEMPTS = 3;
const PHOTO_SIDE = 480;
const PHOTO_MAX_BYTES = 120 * 1024;

/** Resizes the chosen photo to a JPEG of at most 480px a side and about 120 KB. Returns base64 (no prefix) and a preview URL. */
export async function preparePhoto(file: File): Promise<{ base64: string; preview: string }> {
  const source = await decode(file);
  const scale = Math.min(1, PHOTO_SIDE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  source.close();
  let quality = 0.85;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > PHOTO_MAX_BYTES && quality > 0.4) blob = await toJpeg(canvas, (quality -= 0.15));
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), preview: dataUrl };
}

async function decode(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Older browsers, and formats only <img> can read (such as HEIC on iPhone).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("jpeg"))), "image/jpeg", quality));
}

function visitSource() {
  const params = new URLSearchParams(location.search);
  const tag = (name: string) => params.get(name)?.slice(0, 100) || undefined;
  return { path: location.pathname, utmSource: tag("utm_source"), utmMedium: tag("utm_medium"), utmCampaign: tag("utm_campaign") };
}

async function headers(): Promise<Record<string, string>> {
  warmUpLeadForm();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await (await import("./appCheck")).getAppCheckToken();
    if (token) h["X-Firebase-AppCheck"] = token;
  } catch {
    // The server decides whether a token is required.
  }
  return h;
}

/** POSTs with retries on network errors and 5xx. Every request here is safe to repeat. */
export async function post(url: string, body: string): Promise<{ status: number; data: Record<string, unknown> } | null> {
  const h = await headers();
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { method: "POST", headers: h, body });
      if (response.status < 500) return { status: response.status, data: (await response.json().catch(() => ({}))) as Record<string, unknown> };
    } catch {
      // Network error: retry.
    }
    if (attempt < ATTEMPTS - 1) await new Promise((resolve) => setTimeout(resolve, Math.random() * 400 * 2 ** attempt));
  }
  return null;
}

/** POSTs one registration; a retry uses the same idempotency key, so it never registers twice. */
export async function submitScholarship(
  fields: ScholarshipFields,
  meta: { idempotencyKey: string; startedAt: number; noticeVersion: string; website: string },
): Promise<ScholarshipResult> {
  const answer = await post(ENDPOINT, JSON.stringify({ ...fields, ...meta, consent: true, source: visitSource() }));
  if (!answer) return { ok: false, reason: "network" };
  const { status, data } = answer;
  if (status === 200) return { ok: true, ...(data as unknown as Registered) };
  if (status === 429) return { ok: false, reason: "rate_limited" };
  if (status === 409) return { ok: false, reason: "phone_taken", fields: ["phone"] };
  return { ok: false, reason: "invalid", fields: data["fields"] as string[] | undefined };
}

type PayAnswer = { status: PayStatus; rollNo?: string };
const payAnswer = (data: Record<string, unknown>): PayAnswer => ({
  status: data["status"] as PayStatus,
  ...(typeof data["rollNo"] === "string" ? { rollNo: data["rollNo"] } : {}),
});

/** Sends the UPI reference after paying the fee. */
export async function sendPayment(regNo: string, token: string, utr: string): Promise<PayAnswer | { error: "utr" | "utr_used" | "network" }> {
  const answer = await post(PAY_ENDPOINT, JSON.stringify({ regNo, token, utr }));
  if (!answer) return { error: "network" };
  if (answer.status === 200) return payAnswer(answer.data);
  if (answer.status === 409) return { error: "utr_used" };
  return { error: answer.status === 400 ? "utr" : "network" };
}

/** Asks whether the team has confirmed the fee yet, and for the roll number once it has. */
export async function paymentStatus(regNo: string, token: string): Promise<PayAnswer | null> {
  const answer = await post(PAY_ENDPOINT, JSON.stringify({ regNo, token }));
  return answer?.status === 200 ? payAnswer(answer.data) : null;
}

/** Logs in on another phone (or after clearing the browser) with the parent's mobile number and the child's date of birth. */
export async function loginScholarship(phone: string, dob: string): Promise<Registered | { error: "login" | "rate_limited" | "network" }> {
  const answer = await post(PAY_ENDPOINT, JSON.stringify({ phone, dob }));
  if (!answer) return { error: "network" };
  if (answer.status === 200) { const { ok: _ok, ...registered } = answer.data; return registered as unknown as Registered; }
  return { error: answer.status === 429 ? "rate_limited" : answer.status === 401 || answer.status === 400 ? "login" : "network" };
}

// ---------- The exam paper, downloaded ahead and locked ----------

/** A paper as kept on the phone: AES-GCM ciphertext (tag at the end) and its IV, base64. The key comes at the exam's start. */
export type StoredPaper = { version: string; iv: string; data: string };
const paperKey = (roll: string) => `stoodant-paper-${roll}`;
export function storedPaper(roll: string): StoredPaper | null {
  try {
    const value = JSON.parse(localStorage.getItem(paperKey(roll)) ?? "null") as StoredPaper | null;
    return value?.version && value.iv && value.data ? value : null;
  } catch {
    return null;
  }
}

/** Downloads the student's locked paper once the fee is confirmed (again only if the team has changed the question bank). */
export async function downloadPaper(done: Registered): Promise<boolean> {
  if (!done.rollNo) return false;
  const answer = await post(EXAM_ENDPOINT, JSON.stringify({ action: "paper", regNo: done.regNo, token: done.payment.token }));
  if (answer?.status !== 200) return false;
  const { version, iv, data } = answer.data as unknown as StoredPaper;
  try {
    localStorage.setItem(paperKey(done.rollNo), JSON.stringify({ version, iv, data }));
    return true;
  } catch {
    return false;
  }
}

/** Opens the downloaded paper with the key the server gives when the exam hour starts. Null if it can't be opened. */
export async function unlockPaper<T>(paper: StoredPaper, keyBase64: string): Promise<T | null> {
  try {
    const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", bytes(keyBase64), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(paper.iv) }, key, bytes(paper.data));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

const SAVED = "stoodant-scholarship";
/** The last registration made in this browser, so the slip and payment step survive a reload. */
export function savedRegistration(): Registered | null {
  try {
    const value = JSON.parse(localStorage.getItem(SAVED) ?? "null") as Registered | null;
    return value?.regNo ? value : null;
  } catch {
    return null;
  }
}
export function saveRegistration(value: Registered | null) {
  try {
    if (value) localStorage.setItem(SAVED, JSON.stringify(value));
    else localStorage.removeItem(SAVED);
  } catch {
    // Private mode: the page still works, it just won't remember.
  }
}

/** UPI payment link (NPCI's linking spec): opens the parent's UPI app with payee and amount filled in. */
export function upiPayLink(upi: { upiId: string; payeeName: string }, amount: number, regNo: string): string {
  const q = new URLSearchParams({ pa: upi.upiId, pn: upi.payeeName, am: amount.toFixed(2), cu: "INR", tn: `Scholarship test ${regNo}` });
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

/** Typing filters: names and city keep letters, spaces and . ' -; phone and PIN keep digits. */
export const onlyLetters = (v: string) => v.replace(/[^\p{L}\p{M} .'-]/gu, "");
export const onlyDigits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

/** Birth years a Class 9 or 10 student can have this year (11 to 19 years old), the same rule the server uses. */
export function dobRange(now = new Date()): { min: string; max: string } {
  const y = now.getFullYear();
  return { min: `${y - 19}-01-01`, max: `${y - 11}-12-31` };
}
export const isPlausibleDob = (v: string, now = new Date()) => {
  const { min, max } = dobRange(now);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && v >= min && v <= max;
};

// The exam days, hours and screen text travel with this file, so they share its download (no extra chunk).
export { SCHOLARSHIP_EXAM, slotDay, slotHours, slotId, slotLabel, slotStart } from "@/config/scholarshipExam";
