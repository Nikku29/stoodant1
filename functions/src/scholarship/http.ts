import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { logger } from "firebase-functions";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import { ALLOWED_ORIGINS, APP_CHECK_ENFORCED, PHONE_HASH_PEPPER } from "../config.js";
import { keyedHash } from "../lib/hash.js";
import { isAllowedOrigin } from "../lib/origin.js";
import { SCHOLARSHIP_FEE } from "./schema.js";

/**
 * What every scholarship endpoint checks first: CORS, POST only, our own site, body size, App Check.
 * Returns false when it has already answered the request.
 */
export async function passesGate(req: Request, res: Response, maxBytes: number, log: string): Promise<boolean> {
  const origin = req.get("origin");
  const allowedOrigins = ALLOWED_ORIGINS.value().split(",").map((entry) => entry.trim()).filter(Boolean);
  if (isAllowedOrigin(origin, allowedOrigins)) {
    res.set("Access-Control-Allow-Origin", origin!);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck");
    res.set("Access-Control-Allow-Methods", "POST");
  }
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return false; }
  if (!isAllowedOrigin(origin, allowedOrigins)) { res.status(403).json({ error: "forbidden" }); return false; }
  if ((req.rawBody?.length ?? 0) > maxBytes) { res.status(413).json({ error: "too_large" }); return false; }

  if (APP_CHECK_ENFORCED.value()) {
    const token = req.get("x-firebase-appcheck");
    try {
      if (!token) throw new Error("missing");
      await getAppCheck().verifyToken(token);
    } catch {
      logger.warn(log, { reason: "app_check" });
      res.status(401).json({ error: "app_check" });
      return false;
    }
  }
  return true;
}

/** The secret pepper, or null after answering 500 when it isn't set. */
export function pepperOr500(res: Response, log: string): string | null {
  const pepper = PHONE_HASH_PEPPER.value();
  if (pepper) return pepper;
  logger.error(log, { reason: "missing_pepper" });
  res.status(500).json({ error: "server" });
  return null;
}

/** Proves the browser holding it is the one that registered (or knew the phone and date of birth). */
export const payToken = (pepper: string, regNo: string) => keyedHash(pepper, `scholarship-pay:${regNo}`);

export type PayStatus = "due" | "submitted" | "paid" | "rejected";
export const payStatusOf = (reg: DocumentData | undefined): PayStatus => {
  const status = reg?.["payment"]?.status;
  return status === "submitted" || status === "paid" || status === "rejected" ? status : "due";
};

/** Where to pay: the team's UPI ID from settings/payments (set in /admin → Fees), or null until it is set. */
export async function upiDetails(): Promise<{ upiId: string; payeeName: string } | null> {
  const snap = await getFirestore().doc("settings/payments").get().catch(() => null);
  const upiId = String(snap?.get("upiId") ?? "");
  return /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId) ? { upiId, payeeName: String(snap?.get("payeeName") ?? "Stoodant") } : null;
}

/** The answer the form shows after registering: the number, and how to pay the fee. */
export function registrationAnswer(
  pepper: string,
  reg: DocumentData,
  existing: boolean,
  upi: { upiId: string; payeeName: string } | null,
) {
  return {
    ok: true,
    regNo: reg["regNo"] as string,
    existing,
    studentName: reg["studentName"] as string,
    studentClass: reg["studentClass"] as string,
    payment: {
      amount: Number(reg["fee"] ?? SCHOLARSHIP_FEE),
      status: payStatusOf(reg),
      token: payToken(pepper, reg["regNo"] as string),
      upi,
    },
  };
}
