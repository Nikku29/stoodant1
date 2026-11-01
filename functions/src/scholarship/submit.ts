import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { logger } from "firebase-functions";
import { FieldValue, Timestamp, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { MIN_FILL_MS } from "../config.js";
import { keyedHash } from "../lib/hash.js";
import { invalidFields } from "../lead/schema.js";
import { clientIp, dropUndefined, isRateLimited } from "../lead/submit.js";
import { SCHOLARSHIP_FEE, decodePhoto, duplicateKey, registrationNumber, scholarshipRequestSchema } from "./schema.js";
import { passesGate, pepperOr500, registrationAnswer, upiDetails } from "./http.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 260 * 1024;
/** Kept a year: long enough for the test, results and a scholarship used over the following months. */
const RETAIN_DAYS = 365;
/** A school or coaching centre may register many children from one connection, so this is looser than the demo form. */
const LIMITS = { per10Min: 30, perDay: 300 };

type Outcome =
  | { kind: "created" | "replayed" | "existing"; reg: DocumentData }
  | { kind: "taken" };

/**
 * POST from stoodant.com/scholarship: one child's registration for the scholarship test.
 * Order: gate (method, origin, size, App Check) → schema → honeypot/min time → photo → rate limit → write.
 *
 * One mobile number registers one student. The same number again with the same date of birth is the same
 * family coming back (say, to finish paying): they get their registration again. With another date of birth
 * it is refused as "phone_taken" (409), so a second child needs the other parent's number.
 *
 * Answers { ok, regNo, existing, studentName, studentClass, payment: { amount, status, token, upi } }.
 * Logs carry ids and outcomes only, never names, phone numbers or photos.
 */
export async function handleSubmitScholarship(req: Request, res: Response): Promise<void> {
  const started = Date.now();
  if (!(await passesGate(req, res, MAX_BODY_BYTES, "scholarship_rejected"))) return;

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

  const pepper = pepperOr500(res, "scholarship_failed");
  if (!pepper) return;

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
    const [, upi] = await Promise.all([
      getStorage().bucket().file(photoPath).save(photo, {
        contentType: "image/jpeg", resumable: false, metadata: { cacheControl: "private, max-age=0" },
      }),
      upiDetails(),
    ]);

    const outcome = await db.runTransaction(async (tx): Promise<Outcome> => {
      const requestRef = db.doc(`scholarshipRequests/${form.idempotencyKey}`);
      const keyId = keyedHash(pepper, duplicateKey(form.phone));
      const keyRef = db.doc(`scholarshipKeys/${keyId}`);
      const counterRef = db.doc(`counters/scholarship-class-${form.studentClass}`);
      const [request, key, counter] = await tx.getAll(requestRef, keyRef, counterRef);

      // Same submit retried, or this number already used: answer from the registration that exists.
      const earlier = request!.exists ? request!.get("regNo") : key!.exists ? key!.get("regNo") : null;
      if (typeof earlier === "string") {
        const reg = (await tx.get(db.doc(`scholarshipRegistrations/${earlier}`))).data();
        // Deleted by the team since: the number is free again.
        if (reg) {
          if (request!.exists) return { kind: "replayed", reg };
          return reg["dob"] === form.dob ? { kind: "existing", reg } : { kind: "taken" };
        }
      }

      const n = ((counter!.get("count") as number | undefined) ?? 0) + 1;
      const regNo = registrationNumber(form.studentClass, n);
      const reg = {
        regNo,
        studentName: form.studentName,
        studentClass: form.studentClass,
        dob: form.dob,
        school: form.school,
        city: form.city,
        pincode: form.pincode,
        parentName: form.parentName,
        parentPhoneE164: form.phone,
        phoneHash: keyedHash(pepper, form.phone),
        photoPath,
        keyId,
        status: "registered",
        fee: SCHOLARSHIP_FEE,
        payment: { status: "due" },
        source: dropUndefined(form.source),
        consent: { by: "parent", at: now, noticeVersion: form.noticeVersion, checkbox: true },
        createdAt: now,
        updatedAt: now,
        retainUntil,
      };
      tx.set(counterRef, { count: n, updatedAt: now }, { merge: true });
      tx.create(db.doc(`scholarshipRegistrations/${regNo}`), reg);
      tx.set(keyRef, { regNo, createdAt: now });
      tx.set(requestRef, { regNo, createdAt: now, expiresAt: Timestamp.fromMillis(started + DAY_MS) });
      tx.create(db.collection("consentLog").doc(), {
        subjectType: "scholarship", subjectId: regNo, action: "granted", by: "parent", at: now,
        noticeVersion: form.noticeVersion, method: "web_form", retainUntil,
      });
      tx.set(db.doc("counters/scholarship-total"), { count: FieldValue.increment(1), updatedAt: now }, { merge: true });
      return { kind: "created", reg };
    });

    // Only a new registration keeps the photo it uploaded.
    if (outcome.kind === "existing" || outcome.kind === "taken")
      await getStorage().bucket().file(photoPath).delete({ ignoreNotFound: true }).catch(() => undefined);

    if (outcome.kind === "taken") {
      logger.info("scholarship_rejected", { reason: "phone_taken" });
      res.status(409).json({ error: "phone_taken", fields: ["phone"] });
      return;
    }
    logger.info("scholarship_accepted", { regNo: outcome.reg["regNo"], outcome: outcome.kind, ms: Date.now() - started });
    res.status(200).json(registrationAnswer(pepper, outcome.reg, outcome.kind === "existing", upi));
  } catch (error) {
    logger.error("scholarship_failed", { reason: "write", code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}
