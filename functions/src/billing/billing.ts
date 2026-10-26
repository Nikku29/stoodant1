import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { pushToPhones } from "../notify/push.js";
import { refreshRoster } from "../school/roster.js";
import {
  PLAN_MONTHS, STAGES, billingStatus, nextPeriod, planPrice, reminderStage, replay, type PlanPayment, type Stage,
} from "./period.js";

// Monthly plans (owner request 2026-10-26). The team sets each child's monthly fee; the family picks how
// many months to pay (startPayment), pays by UPI and sends the reference; the team confirms it. Every
// change to a child's plan payments rebuilds billing/{studentId}, which the parent's app reads to know
// whether classes are open, and which the roster reads to let the family into the batch (roster.ts).

export const istDay = (ms = Date.now()) => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const millis = (v: unknown) => (v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : 0);
const niceDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** The day a confirmed payment counts from: the day the family paid, not the day the team checked it. */
export function payDayOf(fee: FirebaseFirestore.DocumentData): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str(fee.payDay))) return fee.payDay;
  const at = millis(fee.submittedAt) || millis(fee.paidAt) || millis(fee.createdAt);
  return at ? istDay(at) : "";
}

type Options = { today?: string; remind?: boolean };

/**
 * Rebuilds a child's plan from their payments: paid-until date, status, and each payment's period. When
 * the classes open or close, the child's batches are refreshed so the family gains or loses access at once.
 */
export async function rebuildBilling(db: Firestore, studentId: string, options: Options = {}) {
  const today = options.today ?? istDay();
  const ref = db.doc(`billing/${studentId}`);
  const [studentSnap, feeSnaps, before] = await Promise.all([
    db.doc(`students/${studentId}`).get(),
    db.collection("fees").where("studentId", "==", studentId).get(),
    ref.get(),
  ]);
  const student = studentSnap.data();
  if (!student) {
    if (before.exists) await ref.delete();
    return;
  }
  const plans = feeSnaps.docs.filter((f) => num(f.get("months")) > 0);
  const paid: PlanPayment[] = plans
    .filter((f) => f.get("status") === "paid")
    .map((f) => ({ id: f.id, months: num(f.get("months")), payDay: payDayOf(f.data()), order: millis(f.get("createdAt")) }));
  const { paidUntil, anchor, periods } = replay(paid);
  const checking = plans.some((f) => f.get("status") === "submitted");
  const { status, daysLeft, open: planOpen } = billingStatus(today, paidUntil, checking);
  // A child who has left keeps their history but has nothing open.
  const open = student.active !== false && planOpen;

  // Each payment shows the months it covers (fees keep it for receipts and the team's list).
  for (const p of periods) {
    const fee = plans.find((f) => f.id === p.id)!;
    if (fee.get("periodFrom") !== p.from || fee.get("periodTo") !== p.to)
      await fee.ref.update({ periodFrom: p.from, periodTo: p.to });
  }

  const last = paid.length ? plans.find((f) => f.id === periods[periods.length - 1]!.id) : undefined;
  const prev = before.data() ?? {};
  const next: Record<string, unknown> = {
    studentId,
    studentName: str(student.name),
    classLevel: str(student.classLevel),
    board: str(student.board),
    parentName: str(student.parentName),
    parentPhone: str(student.parentPhone),
    active: student.active !== false,
    monthlyFee: num(student.monthlyFee),
    paidUntil,
    anchor,
    status,
    open,
    checking,
    lastPayment: last
      ? { amount: num(last.get("payable")), months: num(last.get("months")), day: payDayOf(last.data()) }
      : null,
    remindedFor: str(prev.remindedFor),
    remindedStage: str(prev.remindedStage),
  };

  let push: { title: string; body: string } | null = null;
  const stage = options.remind && student.active !== false ? reminderStage(status, daysLeft) : null;
  if (stage && shouldRemind(stage, paidUntil, str(prev.remindedFor), str(prev.remindedStage))) {
    push = reminderText(stage, str(student.name).split(" ")[0] ?? "", paidUntil);
    next.remindedFor = paidUntil;
    next.remindedStage = stage;
  }

  const changed = Object.keys(next).some((k) => JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null));
  if (changed) await ref.set({ ...next, updatedAt: FieldValue.serverTimestamp() });
  if (prev.open !== open) {
    const batchIds = Array.isArray(student.batchIds) ? student.batchIds.filter((id): id is string => typeof id === "string") : [];
    for (const id of batchIds) await refreshRoster(id);
  }
  if (push && student.parentPhone)
    await pushToPhones([String(student.parentPhone)], { ...push, link: "/parent/fees", tag: `plan-${studentId}` }, db);
}

function shouldRemind(stage: Stage, paidUntil: string, remindedFor: string, remindedStage: string) {
  if (remindedFor !== paidUntil) return true;
  return STAGES.indexOf(stage) > STAGES.indexOf(remindedStage as Stage);
}

export function reminderText(stage: Stage, child: string, paidUntil: string) {
  const end = niceDay(paidUntil);
  switch (stage) {
    case "soon":
      return { title: `${child}'s plan ends on ${end}`, body: "Renew in the app to keep classes going without a break." };
    case "last":
      return { title: `${child}'s plan ends on ${end}`, body: "Renew today so classes continue tomorrow." };
    case "grace":
      return { title: `${child}'s plan has ended`, body: "Classes stay open for a few more days. Renew in the app to continue." };
    case "paused":
      return { title: `${child}'s classes are paused`, body: "Renew in the app any time and classes start again straight away." };
  }
}

// ---------------------------------------------------------------------------------------------------
// The family starts a payment: the server works out the amount from the child's monthly fee.

export async function handleStartPayment(request: CallableRequest) {
  const phone = typeof request.auth?.token.phone_number === "string" ? request.auth.token.phone_number : "";
  if (!request.auth || !phone) throw new HttpsError("unauthenticated", "Please log in again.");
  const data = (request.data ?? {}) as Record<string, unknown>;
  const studentId = str(data.studentId);
  const months = num(data.months);
  if (!/^[A-Za-z0-9]{1,40}$/.test(studentId)) throw new HttpsError("invalid-argument", "Unknown child.");
  if (!(PLAN_MONTHS as readonly number[]).includes(months)) throw new HttpsError("invalid-argument", "Please choose a plan.");

  const db = getFirestore();
  const [page, studentSnap, settings, billing, open] = await Promise.all([
    db.doc(`progress/${studentId}`).get(),
    db.doc(`students/${studentId}`).get(),
    db.doc("settings/payments").get(),
    db.doc(`billing/${studentId}`).get(),
    db.collection("fees").where("studentId", "==", studentId).where("status", "in", ["due", "submitted"]).get(),
  ]);
  if (page.get("parentPhone") !== phone) throw new HttpsError("permission-denied", "This child isn't on your account.");
  const student = studentSnap.data();
  if (!student || student.active === false) throw new HttpsError("failed-precondition", "Please message us to restart classes.");
  const monthlyFee = num(student.monthlyFee);
  if (monthlyFee <= 0)
    throw new HttpsError("failed-precondition", "Your fee isn't set up yet. Please message us and we'll sort it out.");
  if (open.docs.some((f) => num(f.get("months")) > 0 && f.get("status") === "submitted"))
    throw new HttpsError("failed-precondition", "Your last payment is still being checked. We'll confirm it soon.");

  const price = planPrice(monthlyFee, months, settings.get("planOff"));
  const today = istDay();
  const period = nextPeriod(today, str(billing.get("paidUntil")), num(billing.get("anchor")), months);
  const page_ = page.get("student") ?? {};
  const fee = {
    kind: "plan",
    studentId,
    studentName: str(student.name),
    parentName: str(student.parentName),
    classLevel: str(student.classLevel),
    board: str(student.board),
    batchId: "",
    batches: Array.isArray(page_.batches) ? page_.batches : [],
    subjects: Array.isArray(page_.subjects) ? page_.subjects : [],
    title: months === 1 ? "1 month of classes" : `${months} months of classes`,
    months,
    monthlyFee,
    listAmount: price.list,
    planPercent: price.percent,
    amount: price.amount,
    discount: 0,
    payable: price.amount,
    couponCode: "",
    couponPercent: 0,
    due: today,
    status: "due",
    // What it would cover if paid today; fixed for good once the team confirms it.
    expectFrom: period.from,
    expectTo: period.to,
    startedPhone: phone,
  };

  // One open payment per child: changing the plan updates it (and gives back any coupon on it).
  const due = open.docs.find((f) => num(f.get("months")) > 0 && f.get("status") === "due");
  if (due) {
    if (num(due.get("months")) === months && num(due.get("listAmount")) === price.list && num(due.get("planPercent")) === price.percent) {
      if (due.get("expectFrom") !== period.from) await due.ref.update({ expectFrom: period.from, expectTo: period.to, due: today });
      return { feeId: due.id };
    }
    const oldCode = str(due.get("couponCode"));
    await db.runTransaction(async (tx) => {
      const old = oldCode ? await tx.get(db.doc(`coupons/${oldCode}`)) : null;
      tx.update(due.ref, fee);
      if (old?.exists) tx.update(old.ref, { uses: FieldValue.increment(-1) });
    });
    return { feeId: due.id };
  }
  const ref = db.collection("fees").doc();
  await ref.set({ ...fee, createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { feeId: ref.id };
}

// ---------------------------------------------------------------------------------------------------
// The team records a payment made another way (cash, bank transfer) or gives free months.

const METHODS = ["cash", "bank", "upi", "free"] as const;

export async function handleRecordPayment(request: CallableRequest) {
  if (request.auth?.token.admin !== true) throw new HttpsError("permission-denied", "Only the team can do this.");
  const data = (request.data ?? {}) as Record<string, unknown>;
  const studentId = str(data.studentId);
  const months = num(data.months);
  const amount = num(data.amount);
  const payDay = str(data.payDay);
  const method = METHODS.find((m) => m === data.method);
  const note = str(data.note).trim().slice(0, 200);
  if (!/^[A-Za-z0-9]{1,40}$/.test(studentId)) throw new HttpsError("invalid-argument", "Unknown child.");
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new HttpsError("invalid-argument", "Months: 1 to 24.");
  if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000) throw new HttpsError("invalid-argument", "Check the amount.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payDay) || payDay > istDay()) throw new HttpsError("invalid-argument", "Check the date.");
  if (!method) throw new HttpsError("invalid-argument", "How was it paid?");

  const db = getFirestore();
  const studentSnap = await db.doc(`students/${studentId}`).get();
  const student = studentSnap.data();
  if (!student) throw new HttpsError("not-found", "Unknown child.");
  const page = (await db.doc(`progress/${studentId}`).get()).get("student") ?? {};
  const ref = db.collection("fees").doc();
  await ref.set({
    kind: "plan",
    studentId,
    studentName: str(student.name),
    parentName: str(student.parentName),
    classLevel: str(student.classLevel),
    board: str(student.board),
    batchId: "",
    batches: Array.isArray(page.batches) ? page.batches : [],
    subjects: Array.isArray(page.subjects) ? page.subjects : [],
    title: months === 1 ? "1 month of classes" : `${months} months of classes`,
    months,
    monthlyFee: num(student.monthlyFee),
    listAmount: amount,
    planPercent: 0,
    amount,
    discount: 0,
    payable: amount,
    couponCode: "",
    couponPercent: 0,
    due: payDay,
    payDay,
    method,
    note,
    status: "paid",
    utr: "",
    createdBy: request.auth!.uid,
    createdAt: FieldValue.serverTimestamp(),
    paidAt: FieldValue.serverTimestamp(),
    paidBy: request.auth!.uid,
  });
  return { feeId: ref.id };
}

// ---------------------------------------------------------------------------------------------------
// Every morning: move plans along (ending, grace, paused) and remind families once per step.

export async function runBillingDay(today = istDay()) {
  const db = getFirestore();
  const [students, plans] = await Promise.all([db.collection("students").get(), db.collection("billing").get()]);
  const ids = new Set([...students.docs.map((s) => s.id), ...plans.docs.map((p) => p.id)]);
  let failed = 0;
  for (const id of ids) {
    try {
      await rebuildBilling(db, id, { today, remind: true });
    } catch (e) {
      failed++;
      logger.error("billing rebuild failed", { studentId: id, error: String(e) });
    }
  }
  logger.info("billing_day", { today, children: ids.size, failed });
}
