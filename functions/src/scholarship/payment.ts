import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "firebase-functions";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { keyedHash } from "../lib/hash.js";
import { invalidFields } from "../lead/schema.js";
import { clientIp, isRateLimited } from "../lead/submit.js";
import { paymentSchema } from "./schema.js";
import { passesGate, payStatusOf, payToken, pepperOr500 } from "./http.js";

const LIMITS = { per10Min: 20, perDay: 100 };

/**
 * POST from the /scholarship page after the parent pays the test fee by UPI: { regNo, token, utr }.
 * The token came with the registration, so only that browser (or someone with the phone and date of birth)
 * can send it. The payment becomes "submitted"; the team checks the bank account and marks it paid in /admin.
 * One UPI reference can be used for one registration only.
 * Answers { ok, status }, or 409 { error: "utr_used" } / 404 { error: "not_found" }.
 */
export async function handleScholarshipPayment(req: Request, res: Response): Promise<void> {
  const started = Date.now();
  if (!(await passesGate(req, res, 4 * 1024, "scholarship_payment_rejected"))) return;

  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid", fields: invalidFields(parsed.error) });
    return;
  }
  const { regNo, token, utr } = parsed.data;

  const pepper = pepperOr500(res, "scholarship_payment_failed");
  if (!pepper) return;
  const expected = Buffer.from(payToken(pepper, regNo));
  if (!timingSafeEqual(expected, Buffer.from(token))) {
    logger.info("scholarship_payment_rejected", { reason: "token" });
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const db = getFirestore();
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-pay-ip:${clientIp(req)}`), started, LIMITS)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  try {
    const now = Timestamp.fromMillis(started);
    const result = await db.runTransaction(async (tx) => {
      const regRef = db.doc(`scholarshipRegistrations/${regNo}`);
      const utrRef = db.doc(`scholarshipUtrs/${utr}`);
      const [reg, used] = await tx.getAll(regRef, utrRef);
      if (!reg!.exists) return "not_found" as const;
      const status = payStatusOf(reg!.data());
      if (status === "paid") return "paid" as const;
      if (used!.exists && used!.get("regNo") !== regNo) return "utr_used" as const;
      tx.update(regRef, { payment: { status: "submitted", utr, submittedAt: now }, updatedAt: now });
      tx.set(utrRef, { regNo, at: now });
      return "submitted" as const;
    });
    if (result === "not_found") { res.status(404).json({ error: "not_found" }); return; }
    if (result === "utr_used") { res.status(409).json({ error: "utr_used", fields: ["utr"] }); return; }
    logger.info("scholarship_payment", { regNo, status: result, ms: Date.now() - started });
    res.status(200).json({ ok: true, status: result });
  } catch (error) {
    logger.error("scholarship_payment_failed", { reason: "write", code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}
