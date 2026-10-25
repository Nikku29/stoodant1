import { FieldValue, getFirestore, type Transaction } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { pushToPhones } from "../notify/push.js";
import { alertTeam } from "../notify/team.js";

// Fees paid by UPI (fees/{id}). applyCoupon checks a coupon code for a family and lowers their fee: the codes
// live in coupons/{CODE}, which only the team can read. onFeeWritten tells the family when a fee is added or
// the payment is confirmed, and the team when a family says they have paid.

/** Wrong codes one fee may try before the family has to ask the team: stops guessing codes. */
export const MAX_TRIES = 10;

const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type CouponDoc = { percent?: unknown; active?: unknown; maxUses?: unknown; uses?: unknown; expires?: unknown };

/** Why a coupon can't be used today, or null when it can. */
export function couponProblem(c: CouponDoc | undefined, today: string): string | null {
  if (!c || c.active === false || typeof c.percent !== "number" || c.percent < 1 || c.percent > 100)
    return "That code isn't valid. Please check it and try again.";
  if (typeof c.expires === "string" && c.expires && c.expires < today) return "That code has expired.";
  const max = typeof c.maxUses === "number" ? c.maxUses : 0;
  if (max > 0 && (typeof c.uses === "number" ? c.uses : 0) >= max) return "That code has been fully used.";
  return null;
}

export const discountFor = (amount: number, percent: number) => Math.round((amount * percent) / 100);

export async function handleApplyCoupon(request: CallableRequest) {
  const auth = request.auth;
  const phone = typeof auth?.token.phone_number === "string" ? auth.token.phone_number : "";
  const admin = auth?.token.admin === true;
  if (!auth || (!phone && !admin)) throw new HttpsError("unauthenticated", "Please log in again.");
  const data = (request.data ?? {}) as Record<string, unknown>;
  const feeId = typeof data.feeId === "string" ? data.feeId : "";
  const code = typeof data.code === "string" ? data.code.trim().toUpperCase().replace(/\s+/g, "") : "";
  if (!/^[A-Za-z0-9]{1,40}$/.test(feeId)) throw new HttpsError("invalid-argument", "Unknown fee.");
  if (code && !/^[A-Z0-9]{3,20}$/.test(code)) throw new HttpsError("not-found", "That code isn't valid. Please check it and try again.");

  const db = getFirestore();
  const feeRef = db.doc(`fees/${feeId}`);
  return db.runTransaction(async (tx: Transaction) => {
    const fee = await tx.get(feeRef);
    if (!fee.exists) throw new HttpsError("not-found", "Unknown fee.");
    const f = fee.data()!;
    if (!admin) {
      const page = await tx.get(db.doc(`progress/${String(f.studentId)}`));
      if (page.get("parentPhone") !== phone) throw new HttpsError("permission-denied", "This fee isn't yours.");
    }
    if (f.status !== "due") throw new HttpsError("failed-precondition", "This fee can't be changed any more.");
    const tries = typeof f.couponTries === "number" ? f.couponTries : 0;
    if (code && tries >= MAX_TRIES)
      throw new HttpsError("resource-exhausted", "Too many codes tried. Please ask the Stoodant team.");

    const amount = Number(f.amount) || 0;
    const oldCode = typeof f.couponCode === "string" ? f.couponCode : "";
    if (code && code === oldCode)
      return { payable: Number(f.payable), discount: Number(f.discount), percent: Number(f.couponPercent), code };

    const couponRef = code ? db.doc(`coupons/${code}`) : null;
    const coupon = couponRef ? await tx.get(couponRef) : null;
    // The coupon it replaces gives its use back, unless the team has deleted it since.
    const oldRef = oldCode ? db.doc(`coupons/${oldCode}`) : null;
    const old = oldRef ? await tx.get(oldRef) : null;
    if (code) {
      const problem = couponProblem(coupon?.data(), istToday());
      if (problem) {
        tx.update(feeRef, { couponTries: tries + 1 });
        // Thrown after the transaction would roll the count back, so the error goes back as a result.
        return { error: problem };
      }
    }
    const percent = code ? Number(coupon!.get("percent")) : 0;
    const discount = discountFor(amount, percent);
    tx.update(feeRef, {
      couponCode: code,
      couponPercent: percent,
      discount,
      payable: amount - discount,
      ...(code ? { couponTries: tries + 1 } : {}),
    });
    if (couponRef) tx.update(couponRef, { uses: FieldValue.increment(1) });
    if (oldRef && old?.exists) tx.update(oldRef, { uses: FieldValue.increment(-1) });
    return { payable: amount - discount, discount, percent, code };
  });
}

export function feePush(
  before: FirebaseFirestore.DocumentData | undefined,
  after: FirebaseFirestore.DocumentData | undefined,
): { to: "family" | "team"; title: string; body: string } | null {
  if (!after) return null;
  const amount = rupees(Number(after.payable ?? after.amount) || 0);
  const child = String(after.studentName ?? "").split(" ")[0] ?? "";
  if (!before && after.status === "due")
    return { to: "family", title: `Fee due: ${amount}`, body: `${after.title} for ${child}. Pay by UPI in the app.` };
  if (before?.status === "due" && after.status === "submitted")
    return { to: "team", title: `Payment to check: ${amount}`, body: `${after.studentName}, ${after.title}. UPI ref ${after.utr}` };
  if (before && before.status !== "paid" && after.status === "paid")
    return { to: "family", title: `Payment received: ${amount}`, body: `${after.title} for ${child}. Thank you!` };
  if (before?.status === "submitted" && after.status === "due")
    return { to: "family", title: "Payment not found yet", body: `We couldn't find ${amount} for ${after.title}. Please check the UPI reference.` };
  return null;
}

export async function handleFeeWritten(
  event: FirestoreEvent<Change<FirebaseFirestore.DocumentSnapshot> | undefined, { feeId: string }>,
) {
  const before = event.data?.before.exists ? event.data.before.data() : undefined;
  const after = event.data?.after.exists ? event.data.after.data() : undefined;
  const push = feePush(before, after);
  if (!push || !after) return;
  const db = getFirestore();
  const id = event.params.feeId;
  try {
    if (push.to === "team") {
      await alertTeam({
        key: `fee-submitted-${id}-${String(after.utr)}`,
        subject: push.title,
        lines: [push.body, "", "Check the bank account, then mark it paid in the app: Fees, To check."],
        push: { title: push.title, body: push.body, link: "/admin/fees", tag: `fee-${id}` },
      });
      return;
    }
    const parentPhone = String((await db.doc(`progress/${after.studentId}`).get()).get("parentPhone") ?? "");
    if (parentPhone)
      await pushToPhones([parentPhone], { title: push.title, body: push.body, link: "/parent/fees", tag: `fee-${id}` }, db);
  } catch (e) {
    logger.error("fee alert failed", { feeId: id, error: String(e) });
  }
}
