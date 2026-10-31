// Sends a scholarship test registration (with a small JPEG of the student's photo) to the submitScholarship
// Cloud Function. Same transport as the demo form in lead.ts: App Check header, idempotency key, retries.
import { warmUpLeadForm } from "./lead";

export type ScholarshipFields = {
  studentName: string; studentClass: string; dob: string; school: string; city: string; parentName: string; phone: string; photo: string;
};
export type ScholarshipResult =
  | { ok: true; regNo: string; existing: boolean }
  | { ok: false; reason: "invalid" | "rate_limited" | "network"; fields?: string[] | undefined };

const LEAD_ENDPOINT = import.meta.env["VITE_LEAD_ENDPOINT"] as string | undefined;
// Production sets VITE_LEAD_ENDPOINT to the submitLead function's address; this function sits next to it.
const ENDPOINT = (import.meta.env["VITE_SCHOLARSHIP_ENDPOINT"] as string | undefined)
  ?? (LEAD_ENDPOINT?.endsWith("/submitLead") ? LEAD_ENDPOINT.replace(/submitLead$/, "submitScholarship") : "/api/scholarship");
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

/** POSTs one registration; network errors and 5xx are retried with the same idempotency key, so a retry never registers twice. */
export async function submitScholarship(
  fields: ScholarshipFields,
  meta: { idempotencyKey: string; startedAt: number; noticeVersion: string; website: string },
): Promise<ScholarshipResult> {
  warmUpLeadForm();
  let token: string | null = null;
  try {
    token = await (await import("./appCheck")).getAppCheckToken();
  } catch {
    // The server decides whether a token is required.
  }
  const body = JSON.stringify({ ...fields, ...meta, consent: true, source: visitSource() });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Firebase-AppCheck"] = token;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(ENDPOINT, { method: "POST", headers, body });
      if (response.ok) {
        const data = (await response.json()) as { regNo?: string; existing?: boolean };
        return { ok: true, regNo: data.regNo ?? "", existing: Boolean(data.existing) };
      }
      if (response.status === 429) return { ok: false, reason: "rate_limited" };
      if (response.status < 500) {
        const data = (await response.json().catch(() => ({}))) as { fields?: string[] };
        return { ok: false, reason: "invalid", fields: data.fields };
      }
    } catch {
      // Network error: retry.
    }
    if (attempt < ATTEMPTS - 1) await new Promise((resolve) => setTimeout(resolve, Math.random() * 400 * 2 ** attempt));
  }
  return { ok: false, reason: "network" };
}
