import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "firebase-functions";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { keyedHash } from "../lib/hash.js";
import { invalidFields } from "../lead/schema.js";
import { clientIp, isRateLimited } from "../lead/submit.js";
import { duplicateKey, loginSchema, paymentSchema } from "./schema.js";
import { passesGate, payStatusOf, payToken, pepperOr500, registrationAnswer, upiDetails } from "./http.js";

const LIMITS = { per10Min: 20, perDay: 100 };

/**
 * POST from the /scholarship page after the parent pays the test fee by UPI: { regNo, token, utr } (the 12-digit
 * UPI reference) or { regNo, token, payerUpi } (the UPI ID they paid from), whichever the parent chose.
 * The token came with the registration, so only that browser (or someone with the phone and date of birth)
 * can send it. The payment becomes "submitted"; the team checks the bank account and marks it paid in /admin.
 * One UPI reference can be used for one registration only.
 * Without either it only reads: the page asks this way to learn whether the team has confirmed the fee.
 * Answers { ok, status, rollNo? } (the roll number once the fee is confirmed), or 409 { error: "utr_used" } / 404 { error: "not_found" }.
 */
export async function handleScholarshipPayment(req: Request, res: Response): Promise<void> {
  const started = Date.now();
  if (!(await passesGate(req, res, 4 * 1024, "scholarship_payment_rejected"))) return;
  if (req.body && typeof req.body === "object" && "phone" in req.body) return login(req, res, started);

  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid", fields: invalidFields(parsed.error) });
    return;
  }
  const { regNo, token, utr, payerUpi } = parsed.data;
  const proof = utr ? { utr } : payerUpi ? { payerUpi } : null;

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
      const utrRef = db.doc(`scholarshipUtrs/${utr ?? "-"}`);
      const [reg, used] = utr ? await tx.getAll(regRef, utrRef) : [await tx.get(regRef), null];
      if (!reg!.exists) return "not_found" as const;
      const status = payStatusOf(reg!.data());
      const rollNo = status === "paid" ? (reg!.get("rollNo") as string | undefined) : undefined;
      if (status === "paid" || !proof) return { status, rollNo };
      if (used?.exists && used.get("regNo") !== regNo) return "utr_used" as const;
      tx.update(regRef, { payment: { status: "submitted", ...proof, submittedAt: now }, updatedAt: now });
      if (utr) tx.set(utrRef, { regNo, at: now });
      return { status: "submitted" as const, rollNo: undefined };
    });
    if (result === "not_found") { res.status(404).json({ error: "not_found" }); return; }
    if (result === "utr_used") { res.status(409).json({ error: "utr_used", fields: ["utr"] }); return; }
    if (proof) logger.info("scholarship_payment", { regNo, status: result.status, by: utr ? "utr" : "upi_id", ms: Date.now() - started });
    res.status(200).json({ ok: true, status: result.status, ...(result.rollNo ? { rollNo: result.rollNo } : {}) });
  } catch (error) {
    logger.error("scholarship_payment_failed", { reason: "write", code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}

/**
 * POST { phone, dob }: a family logging in on /scholarship from another phone or a cleared browser.
 * The mobile number finds the registration (one number = one student) and the date of birth must match.
 * Answers like a registration: { ok, regNo, studentName, payment: { token, ... }, rollNo?, slotId }, or 401 { error: "login" }.
 * Tries are counted per mobile number as well as per address, so a date of birth can't be guessed.
 */
async function login(req: Request, res: Response, started: number): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "invalid", fields: invalidFields(parsed.error) }); return; }
  const { phone, dob } = parsed.data;
  const pepper = pepperOr500(res, "scholarship_login_failed");
  if (!pepper) return;
  const db = getFirestore();
  const keyId = keyedHash(pepper, duplicateKey(phone));
  if (
    (await isRateLimited(db, keyedHash(pepper, `scholarship-login-ip:${clientIp(req)}`), started, { per10Min: 60, perDay: 300 })) ||
    (await isRateLimited(db, keyedHash(pepper, `scholarship-login:${keyId}`), started, { per10Min: 8, perDay: 30 }))
  ) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  try {
    const key = await db.doc(`scholarshipKeys/${keyId}`).get();
    const regNo = key.get("regNo") as string | undefined;
    const reg = regNo ? await db.doc(`scholarshipRegistrations/${regNo}`).get() : null;
    if (!reg?.exists || reg.get("dob") !== dob) {
      logger.info("scholarship_login", { ok: false });
      res.status(401).json({ error: "login" });
      return;
    }
    logger.info("scholarship_login", { ok: true, regNo });
    res.status(200).json(registrationAnswer(pepper, reg.data()!, true, await upiDetails()));
  } catch (error) {
    logger.error("scholarship_login_failed", { code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}
