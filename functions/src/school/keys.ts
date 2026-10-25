import { createHash } from "node:crypto";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

// The same forms firestore.rules computes (normName, teacherKey, studentKey). Change them together.

/** "  Aarav   Sharma " and "aarav sharma" are the same name. */
export const normName = (name: unknown) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export type Kind = "teachers" | "students";

/** The unique key a record holds, or null when it lacks the fields the key is made of. */
export function keyOf(kind: Kind, data: DocumentData | undefined): string | null {
  if (!data) return null;
  if (kind === "teachers") return data.phone ? sha256(`teacher|${data.phone}`) : null;
  return data.parentPhone && data.name ? sha256(`student|${data.parentPhone}|${normName(data.name)}`) : null;
}

/**
 * Keeps `uniqueKeys` and `nameKey` in step with a record the team just wrote. The browser already does
 * this in the same write; this covers records made before keys existed and anything a crash left behind.
 * Returns true when it changed the record itself (its `nameKey`), so the caller can stop: that update
 * fires the trigger again.
 */
export async function syncKeys(
  db: Firestore, kind: Kind, id: string, before: DocumentData | undefined, after: DocumentData | undefined,
): Promise<boolean> {
  const old = keyOf(kind, before);
  const now = keyOf(kind, after);
  if (old && old !== now) {
    const ref = db.doc(`uniqueKeys/${old}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.get("id") === id) tx.delete(ref);
    });
  }
  if (!after) return false;
  if (now) {
    const ref = db.doc(`uniqueKeys/${now}`);
    const holder = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) tx.create(ref, { kind, id });
      return snap.exists ? (snap.get("id") as string) : id;
    });
    // Two records entered before keys existed. Both stay; the team sees the warning in the logs.
    if (holder !== id) logger.warn("duplicate_record", { kind, id, keptBy: holder });
  }
  const nameKey = normName(after.name);
  if (after.nameKey !== nameKey) {
    await db.doc(`${kind}/${id}`).update({ nameKey });
    return true;
  }
  return false;
}
