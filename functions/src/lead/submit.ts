import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { logger } from "firebase-functions";
import { getAppCheck } from "firebase-admin/app-check";
import { FieldValue, Timestamp, getFirestore, type Firestore } from "firebase-admin/firestore";
import {
  ALLOWED_ORIGINS, APP_CHECK_ENFORCED, LEAD_RETENTION_DAYS, MIN_FILL_MS, PHONE_HASH_PEPPER,
  RATE_LIMIT_PER_10_MIN, RATE_LIMIT_PER_DAY,
} from "../config.js";
import { keyedHash } from "../lib/hash.js";
import { isAllowedOrigin } from "../lib/origin.js";
import { invalidFields, leadRequestSchema } from "./schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;
const DEDUPE_WINDOW_MS = DAY_MS;
const MAX_BODY_BYTES = 4096;

type Outcome = "created" | "deduped" | "replayed";

/**
 * POST /api/lead (Hosting rewrite) — the only way a demo request reaches Firestore.
 * Order: method → origin → body size → App Check → schema → honeypot/min time → rate limit → write.
 * Logs carry ids and outcomes only, never names or phone numbers.
 */
export async function handleSubmitLead(req: Request, res: Response): Promise<void> {
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
      logger.warn("lead_rejected", { reason: "app_check" });
      res.status(401).json({ error: "app_check" });
      return;
    }
  }

  const parsed = leadRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = invalidFields(parsed.error);
    logger.info("lead_rejected", { reason: "invalid", fields });
    res.status(400).json({ error: "invalid", fields });
    return;
  }
  const lead = parsed.data;

  // Bots: answer exactly like a success so they learn nothing, but store nothing.
  if (lead.website !== "" || started - lead.startedAt < MIN_FILL_MS.value()) {
    logger.info("lead_rejected", { reason: lead.website !== "" ? "honeypot" : "too_fast" });
    res.status(200).json({ ok: true });
    return;
  }

  const pepper = PHONE_HASH_PEPPER.value();
  if (!pepper) {
    logger.error("lead_failed", { reason: "missing_pepper" });
    res.status(500).json({ error: "server" });
    return;
  }

  const db = getFirestore();
  const ip = clientIp(req);
  if (await isRateLimited(db, keyedHash(pepper, `ip:${ip}`), started)) {
    logger.info("lead_rejected", { reason: "rate_limited" });
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const phoneHash = keyedHash(pepper, lead.phone);
  const now = Timestamp.fromMillis(started);
  const retainUntil = Timestamp.fromMillis(started + LEAD_RETENTION_DAYS.value() * DAY_MS);
  const consent = { by: "parent", at: now, noticeVersion: lead.noticeVersion, checkbox: true };

  try {
    const { outcome, leadId } = await db.runTransaction(async (tx) => {
      const requestRef = db.doc(`leadRequests/${lead.idempotencyKey}`);
      const dedupeRef = db.doc(`leadDedupe/${phoneHash}`);
      const [request, dedupe] = await tx.getAll(requestRef, dedupeRef);

      // Same submit retried (same idempotency key): return the first result, write nothing.
      if (request!.exists) return { outcome: "replayed" as Outcome, leadId: request!.get("leadId") as string };

      const recentLeadId = dedupe!.exists && (dedupe!.get("lastAt") as Timestamp).toMillis() > started - DEDUPE_WINDOW_MS
        ? (dedupe!.get("leadId") as string) : null;
      const leadId = recentLeadId ?? lead.idempotencyKey;

      if (recentLeadId) {
        tx.update(db.doc(`leads/${recentLeadId}`), {
          submitCount: FieldValue.increment(1), lastSubmitAt: now, updatedAt: now,
        });
      } else {
        tx.create(db.doc(`leads/${leadId}`), {
          status: "new",
          parentName: lead.parentName,
          parentPhoneE164: lead.phone,
          phoneHash,
          studentClass: lead.studentClass,
          board: lead.board,
          source: dropUndefined(lead.source),
          submitCount: 1,
          consent,
          owner: "system",
          createdAt: now,
          updatedAt: now,
          lastSubmitAt: now,
          retainUntil,
        });
      }
      tx.set(dedupeRef, { leadId, lastAt: now, expiresAt: Timestamp.fromMillis(started + DEDUPE_WINDOW_MS) });
      tx.create(requestRef, { leadId, createdAt: now, expiresAt: Timestamp.fromMillis(started + DAY_MS) });
      tx.create(db.collection("consentLog").doc(), {
        subjectType: "lead", subjectId: leadId, action: "granted", by: "parent", at: now,
        noticeVersion: lead.noticeVersion, method: "web_form", retainUntil,
      });
      return { outcome: (recentLeadId ? "deduped" : "created") as Outcome, leadId };
    });

    logger.info("lead_accepted", { leadId, outcome, ms: Date.now() - started });
    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("lead_failed", { reason: "firestore", code: (error as { code?: unknown }).code ?? null });
    res.status(503).json({ error: "retry" });
  }
}

/**
 * Fixed-window counters per hashed IP. Behind Firebase Hosting the real client IP is in
 * `fastly-client-ip`, which the visitor cannot set; `req.ip` is the fallback (emulator, direct calls).
 */
async function isRateLimited(db: Firestore, ipHash: string, now: number): Promise<boolean> {
  const windows = [
    { id: `${ipHash}_10m_${Math.floor(now / TEN_MIN_MS)}`, limit: RATE_LIMIT_PER_10_MIN.value(), ttl: TEN_MIN_MS },
    { id: `${ipHash}_1d_${Math.floor(now / DAY_MS)}`, limit: RATE_LIMIT_PER_DAY.value(), ttl: DAY_MS },
  ];
  return db.runTransaction(async (tx) => {
    const refs = windows.map((w) => db.doc(`rateLimits/${w.id}`));
    const snaps = await tx.getAll(...refs);
    const limited = snaps.some((snap, i) => ((snap.get("count") as number | undefined) ?? 0) >= windows[i]!.limit);
    if (!limited) {
      refs.forEach((ref, i) => tx.set(ref, {
        count: FieldValue.increment(1), expiresAt: Timestamp.fromMillis(now + windows[i]!.ttl * 2),
      }, { merge: true }));
    }
    return limited;
  });
}

function clientIp(req: Request): string {
  return req.get("fastly-client-ip") ?? req.ip ?? "unknown";
}

function dropUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
