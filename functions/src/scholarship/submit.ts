import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { logger } from "firebase-functions";
import { getAppCheck } from "firebase-admin/app-check";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ALLOWED_ORIGINS, APP_CHECK_ENFORCED, MIN_FILL_MS, PHONE_HASH_PEPPER } from "../config.js";
import { keyedHash } from "../lib/hash.js";
import { isAllowedOrigin } from "../lib/origin.js";
import { invalidFields } from "../lead/schema.js";
import { clientIp, dropUndefined, isRateLimited } from "../lead/submit.js";
import { decodePhoto, duplicateKey, registrationNumber, scholarshipRequestSchema } from "./schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 260 * 1024;
/** Kept a year: long enough for the test, results and a scholarship used over the following months. */
const RETAIN_DAYS = 365;
/** A school or coaching centre may register many children from one connection, so this is looser than the demo form. */
const LIMITS = { per10Min: 30, perDay: 300 };

type Outcome = "created" | "existing" | "replayed";

/**
 * POST from stoodant.com/scholarship: one child's registration for the scholarship test.
 * Order: method → origin → body size → App Check → schema → honeypot/min time → photo → rate limit → write.
 * Answers { ok, regNo, existing }. Logs carry ids and outcomes only, never names, phone numbers or photos.
 */
export async function handleSubmitScholarship(req: Request, res: Response): Promise<void> {
  const started = Date.now();
  const origin = req.get("origin");
  const allowedOrigins = ALLOWED_ORIGINS.value().split(",").map((entry) => entry.trim()).filter(Boolean);
  if (isAllowedOrigin(origin, allowedOrigins)) {
    res.set("Access-Control-Allow-Origin", origin!);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck");
    res.set("Access-Control-Allow-Methods", "POST");
  }
  res.set("Cache-Control", "no-store");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  if (!isAllowedOrigin(origin, allowedOrigins)) { res.status(403).json({ error: "forbidden" }); return; }
  if ((req.rawBody?.length ?? 0) > MAX_BODY_BYTES) { res.status(413).json({ error: "too_large" }); return; }

  if (APP_CHECK_ENFORCED.value()) {
    const token = req.get("x-firebase-appcheck");
    try {
      if (!token) throw new Error("missing");
      await getAppCheck().verifyToken(token);
    } catch {
      logger.warn("scholarship_rejected", { reason: "app_check" });
      res.status(401).json({ error: "app_check" });
      return;
    }
  }

  const parsed = scholarshipRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = invalidFields(parsed.error);
    logger.info("scholarship_rejected", { reason: "invalid", fields });
    res.status(400).json({ error: "invalid", fields });
    return;
  }
  const form = parsed.data;

  // Bots: a success that stores nothing. They get no registration number to show.
  if (form.website !== "" || started - form.startedAt < MIN_FILL_MS.value()) {
    logger.info("scholarship_rejected", { reason: form.website !== "" ? "honeypot" : "too_fast" });
    res.status(200).json({ ok: true, regNo: "", existing: false });
    return;
  }

  const photo = decodePhoto(form.photo);
  if (!photo) {
    logger.info("scholarship_rejected", { reason: "invalid", fields: ["photo"] });
    res.status(400).json({ error: "invalid", fields: ["photo"] });
    return;
  }

  const pepper = PHONE_HASH_PEPPER.value();
  if (!pepper) {
    logger.error("scholarship_failed", { reason: "missing_pepper" });
    res.status(500).json({ error: "server" });
    return;
  }

  const db = getFirestore();
  if (await isRateLimited(db, keyedHash(pepper, `scholarship-ip:${clientIp(req)}`), started, LIMITS)) {
    logger.info("scholarship_rejected", { reason: "rate_limited" });
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const now = Timestamp.fromMillis(started);
  const retainUntil = Timestamp.fromMillis(started + RETAIN_DAYS * DAY_MS);
  const photoPath = `originals/scholarship/${form.idempotencyKey}/photo.jpg`;

  try {
    // The photo goes first, under the request's own key, so a retry simply overwrites it.
    await getStorage().bucket().file(photoPath).save(photo, {
      contentType: "image/jpeg", resumable: false, metadata: { cacheControl: "private, max-age=0" },
    });

    const { outcome, regNo } = await db.runTransaction(async (tx) => {
      const requestRef = db.doc(`scholarshipRequests/${form.idempotencyKey}`);
      const keyId = keyedHash(pepper, duplicateKey(form.phone, form.studentClass, form.studentName));
      const keyRef = db.doc(`scholarshipKeys/${keyId}`);
      const counterRef = db.doc(`counters/scholarship-class-${form.studentClass}`);
      const [request, key, counter] = await tx.getAll(requestRef, keyRef, counterRef);

      // Same submit retried: the first answer again, nothing written.
      if (request!.exists) return { outcome: "replayed" as Outcome, regNo: request!.get("regNo") as string };
      // Same child already registered: their existing number, nothing written.
      if (key!.exists) return { outcome: "existing" as Outcome, regNo: key!.get("regNo") as string };

      const n = ((counter!.get("count") as number | undefined) ?? 0) + 1;
      const regNo = registrationNumber(form.studentClass, n);
      tx.set(counterRef, { count: n, updatedAt: now }, { merge: true });
      tx.create(db.doc(`scholarshipRegistrations/${regNo}`), {
        regNo,
        studentName: form.studentName,
        studentClass: form.studentClass,
        dob: form.dob,
        school: form.school,
        city: form.city,
        parentName: form.parentName,
        parentPhoneE164: form.phone,
        phoneHash: keyedHash(pepper, form.phone),
        photoPath,
        keyId,
        status: "registered",
        source: dropUndefined(form.source),
        consent: { by: "parent", at: now, noticeVersion: form.noticeVersion, checkbox: true },
        createdAt: now,
        updatedAt: now,
        retainUntil,
      });
      tx.create(keyRef, { regNo, createdAt: now });
      tx.create(requestRef, { regNo, createdAt: now, expiresAt: Timestamp.fromMillis(started + DAY_MS) });
      tx.create(db.collection("consentLog").doc(), {
        subjectType: "scholarship", subjectId: regNo, action: "granted", by: "parent", at: now,
        noticeVersion: form.noticeVersion, method: "web_form", retainUntil,
      });
      tx.set(db.doc("counters/scholarship-total"), { count: FieldValue.increment(1), updatedAt: now }, { merge: true });
      return { outcome: "created" as Outcome, regNo };
    });

    // A repeat registration must not leave a second photo behind.
    if (outcome === "existing") await getStorage().bucket().file(photoPath).delete({ ignoreNotFound: true }).catch(() => undefined);

    logger.info("scholarship_accepted", { regNo, outcome, ms: Date.now() - started });
    res.status(200).json({ ok: true, regNo, existing: outcome === "existing" });
  } catch (error) {
    logger.error("scholarship_failed", { reason: "write", code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}
