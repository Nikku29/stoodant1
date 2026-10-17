import { z } from "zod";

/** Must match SITE_CONFIG.form.classes and SITE_CONFIG.form.boards in src/config/siteConfig.ts. */
export const CLASSES = ["4", "5", "6", "7", "8", "9", "10"] as const;
export const BOARDS = ["CBSE", "ICSE"] as const;
export const LEAD_STATUSES = ["new", "contacted", "demo_scheduled", "demo_done", "enrolled", "closed"] as const;

/**
 * Indian mobile number to E.164 (+91XXXXXXXXXX). Accepts 10 digits starting 6-9, optionally prefixed
 * with +91, 91 or 0, with spaces, dashes or brackets. Returns null for anything else.
 */
export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0") ? digits.slice(1)
    : digits;
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}

const utm = z.string().trim().max(100).regex(/^[\w.\-+ ]*$/).optional();

export const leadRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  parentName: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{M} .'-]+$/u),
  studentClass: z.enum(CLASSES),
  board: z.enum(BOARDS),
  phone: z.string().max(20).transform((value, ctx) => {
    const e164 = normaliseIndianMobile(value);
    if (!e164) ctx.addIssue({ code: "custom", message: "phone" });
    return e164 ?? "";
  }),
  consent: z.literal(true),
  noticeVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Epoch ms when the form was shown; used for the minimum time-to-submit check. */
  startedAt: z.number().int().positive(),
  /** Honeypot: must be empty. Bots that fill every field get a fake success. */
  website: z.string().max(200).optional().default(""),
  source: z.object({
    path: z.string().max(200).regex(/^\/[\w\-/.]*$/).default("/"),
    utmSource: utm,
    utmMedium: utm,
    utmCampaign: utm,
  }).strict().default({ path: "/" }),
}).strict();

export type LeadRequest = z.infer<typeof leadRequestSchema>;

/** Names of the fields that failed validation, never their values (they contain personal data). */
export function invalidFields(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => String(issue.path[0] ?? "body")))];
}
