import { z } from "zod";
import { normaliseIndianMobile } from "../lead/schema.js";

/** Must match SITE_CONFIG.scholarship.classes in src/config/siteConfig.ts. */
export const SCHOLARSHIP_CLASSES = ["9", "10"] as const;
/** Registration numbers start with this, e.g. SS26-09-00042. Change it for the next year's test. */
export const REG_PREFIX = "SS26";
/** The resized photo is about 20-60 KB; anything much bigger was not made by our form. */
export const MAX_PHOTO_BYTES = 150 * 1024;
/** The test fee in rupees. Must match SCHOLARSHIP_CONFIG.fee in src/config/scholarshipConfig.ts. */
export const SCHOLARSHIP_FEE = 99;
/** UPI reference numbers (UTR): 12 digits on most apps, letters and digits on a few. */
export const UTR_PATTERN = /^[A-Za-z0-9]{6,30}$/;
export const REG_NO_PATTERN = /^SS\d{2}-\d{2}-\d{5}$/;

/** Letters only: people's names and city names. */
const letters = /^[\p{L}\p{M} .'-]+$/u;
const name = z.string().trim().min(2).max(80).regex(letters);
const school = z.string().trim().min(2).max(120).regex(/^[\p{L}\p{M}\p{N} .,'&()/-]+$/u);
const utm = z.string().trim().max(100).regex(/^[\w.\-+ ]*$/).optional();

/** A real calendar date for a child in Class 9 or 10 (roughly 11 to 19 years old). */
export function isPlausibleDob(value: string, now = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return false;
  const age = now.getUTCFullYear() - y;
  return age >= 11 && age <= 19;
}

/** An Indian mobile number in any usual spelling, stored as +91XXXXXXXXXX. */
const indianMobile = z.string().max(20).transform((value, ctx) => {
  const e164 = normaliseIndianMobile(value);
  if (!e164) ctx.addIssue({ code: "custom", message: "phone" });
  return e164 ?? "";
});

export const scholarshipRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  studentName: name,
  studentClass: z.enum(SCHOLARSHIP_CLASSES),
  dob: z.string().refine((value) => isPlausibleDob(value), "dob"),
  school,
  city: z.string().trim().min(2).max(60).regex(letters),
  /** Indian PIN code: six digits, never starting with 0. */
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  parentName: name,
  phone: indianMobile,
  /** JPEG, base64 without the data: prefix. Checked again after decoding. */
  photo: z.string().min(100).max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  consent: z.literal(true),
  noticeVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.number().int().positive(),
  website: z.string().max(200).optional().default(""),
  source: z.object({
    path: z.string().max(200).regex(/^\/[\w\-/.]*$/).default("/"),
    utmSource: utm,
    utmMedium: utm,
    utmCampaign: utm,
  }).strict().default({ path: "/" }),
}).strict();

export type ScholarshipRequest = z.infer<typeof scholarshipRequestSchema>;

/** The decoded photo, or null when it isn't a JPEG of a sensible size. */
export function decodePhoto(base64: string): Buffer | null {
  const bytes = Buffer.from(base64, "base64");
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return isJpeg && bytes.length <= MAX_PHOTO_BYTES ? bytes : null;
}

/** One mobile number registers one student: the key is the number alone. */
export function duplicateKey(phone: string): string {
  return `scholarship-phone:${phone}`;
}

/** Logging in on /scholarship (another phone, cleared browser): the parent's mobile number and the child's date of birth. */
export const loginSchema = z.object({
  phone: indianMobile,
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export const paymentSchema = z.object({
  regNo: z.string().regex(REG_NO_PATTERN),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  /** Left out to only ask for the status (and the roll number once the fee is confirmed). */
  utr: z.string().trim().regex(UTR_PATTERN).transform((v) => v.toUpperCase()).optional(),
}).strict();

/** Exam roll number, given once the fee is confirmed: 26 (year), the class as two digits, then a running number. 9 digits, easy to type. */
export function rollNumber(studentClass: string, n: number): string {
  return `${REG_PREFIX.slice(-2)}${studentClass.padStart(2, "0")}${String(n).padStart(5, "0")}`;
}

/** SS26-09-00042: the year's prefix, the class, then a running number per class. */
export function registrationNumber(studentClass: string, n: number): string {
  return `${REG_PREFIX}-${studentClass.padStart(2, "0")}-${String(n).padStart(5, "0")}`;
}
