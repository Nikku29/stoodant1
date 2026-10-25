// Fees, paid by UPI until the company's payment account is ready. The team creates a fee for each child
// (one at a time or a whole batch at once); the family pays to the team's UPI ID (QR code or the UPI app),
// then types the payment's reference number; the team checks it against the bank account and marks it paid.
// Coupons are checked by the applyCoupon function, so families never see the list of codes.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore/lite";

import { firebase } from "./session";

export type FeeStatus = "due" | "submitted" | "paid" | "cancelled";
export type Fee = {
  id: string;
  studentId: string;
  studentName: string;
  batchId: string;
  title: string;
  /** Whole rupees. */
  amount: number;
  discount: number;
  /** What the family pays: amount minus the coupon's discount. */
  payable: number;
  couponCode: string;
  couponPercent: number;
  /** YYYY-MM-DD. */
  due: string;
  status: FeeStatus;
  /** The UPI reference (UTR) the family typed after paying. */
  utr: string;
  note: string;
  createdAt: number;
  submittedAt: number;
  paidAt: number;
};
export type Coupon = {
  code: string;
  percent: number;
  active: boolean;
  /** 0 = no limit. */
  maxUses: number;
  uses: number;
  /** Last day it works, YYYY-MM-DD, or "" for no end. */
  expires: string;
};
export type PaySettings = { upiId: string; payeeName: string; note: string };

const db = () => firebase().db;
const ms = (v: unknown) =>
  v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : 0;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function toFee(id: string, d: Record<string, unknown>): Fee {
  const amount = num(d["amount"]);
  return {
    id,
    studentId: str(d["studentId"]),
    studentName: str(d["studentName"]),
    batchId: str(d["batchId"]),
    title: str(d["title"]),
    amount,
    discount: num(d["discount"]),
    payable: typeof d["payable"] === "number" ? d["payable"] : amount,
    couponCode: str(d["couponCode"]),
    couponPercent: num(d["couponPercent"]),
    due: str(d["due"]),
    status:
      (["due", "submitted", "paid", "cancelled"] as const).find((s) => s === d["status"]) ?? "due",
    utr: str(d["utr"]),
    note: str(d["note"]),
    createdAt: ms(d["createdAt"]) || Date.now(),
    submittedAt: ms(d["submittedAt"]),
    paidAt: ms(d["paidAt"]),
  };
}

/** Rupees the Indian way: ₹12,500. */
export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** A UPI ID: name@bank. */
export const isUpiId = (v: string) => /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(v);
/** A UPI reference: 12 digits for most apps; some show letters too. */
export const isUtr = (v: string) => /^[A-Za-z0-9]{6,30}$/.test(v);
export const isCouponCode = (v: string) => /^[A-Z0-9]{3,20}$/.test(v);

/**
 * The standard UPI payment link (NPCI's UPI linking spec). Opens the family's UPI app with the payee and
 * amount filled in; the same text in a QR code works from any UPI app's scanner.
 */
export function upiLink(
  pay: PaySettings,
  fee: Pick<Fee, "payable" | "title" | "studentName">,
): string {
  const q = new URLSearchParams({
    pa: pay.upiId,
    pn: pay.payeeName,
    am: fee.payable.toFixed(2),
    cu: "INR",
    tn: `${fee.title} ${fee.studentName}`.slice(0, 50),
  });
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

// ---- Families ----

export async function feesOfChild(studentId: string): Promise<Fee[]> {
  const snap = await getDocs(query(collection(db(), "fees"), where("studentId", "==", studentId)));
  return snap.docs.map((d) => toFee(d.id, d.data())).filter((f) => f.status !== "cancelled");
}

export async function paySettings(): Promise<PaySettings | null> {
  const snap = await getDoc(doc(db(), "settings", "payments"));
  const d = snap.data();
  if (!d || !isUpiId(str(d["upiId"]))) return null;
  return { upiId: str(d["upiId"]), payeeName: str(d["payeeName"]), note: str(d["note"]) };
}

/** Checks the code on the server and lowers the fee; "" takes a coupon off again. */
export const applyCoupon = (feeId: string, code: string) =>
  firebase().call<
    { payable: number; discount: number; percent: number; code: string } | { error: string }
  >("applyCoupon", {
    feeId,
    code,
  });

export async function submitPayment(feeId: string, utr: string, uid: string) {
  await updateDoc(doc(db(), "fees", feeId), {
    status: "submitted",
    utr,
    submittedBy: uid,
    submittedAt: serverTimestamp(),
  });
}

// ---- The team ----

export async function allFees(): Promise<Fee[]> {
  const snap = await getDocs(
    query(collection(db(), "fees"), orderBy("createdAt", "desc"), limit(500)),
  );
  return snap.docs.map((d) => toFee(d.id, d.data()));
}

/** One fee per child, in one write: all of them are created, or none. */
export async function createFees(
  children: { id: string; name: string; batchId: string }[],
  fee: { title: string; amount: number; due: string },
  uid: string,
) {
  const batch = writeBatch(db());
  for (const c of children)
    batch.set(doc(collection(db(), "fees")), {
      studentId: c.id,
      studentName: c.name.slice(0, 80),
      batchId: c.batchId,
      title: fee.title,
      amount: fee.amount,
      discount: 0,
      payable: fee.amount,
      due: fee.due,
      status: "due",
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  await batch.commit();
}

export async function setFeeStatus(
  id: string,
  status: "due" | "paid" | "cancelled",
  uid: string,
  note = "",
) {
  await updateDoc(doc(db(), "fees", id), {
    status,
    note: note.slice(0, 200),
    ...(status === "paid" ? { paidAt: serverTimestamp(), paidBy: uid } : {}),
  });
}

export const deleteFee = (id: string) => deleteDoc(doc(db(), "fees", id));

export async function listCoupons(): Promise<Coupon[]> {
  const snap = await getDocs(collection(db(), "coupons"));
  return snap.docs
    .map((d) => {
      const c = d.data();
      return {
        code: d.id,
        percent: num(c["percent"]),
        active: c["active"] !== false,
        maxUses: num(c["maxUses"]),
        uses: num(c["uses"]),
        expires: str(c["expires"]),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function addCoupon(c: Omit<Coupon, "uses" | "active">, uid: string) {
  await setDoc(doc(db(), "coupons", c.code), {
    percent: c.percent,
    maxUses: c.maxUses,
    expires: c.expires,
    active: true,
    uses: 0,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

export const setCouponActive = (code: string, active: boolean) =>
  updateDoc(doc(db(), "coupons", code), { active });

export const deleteCoupon = (code: string) => deleteDoc(doc(db(), "coupons", code));

export async function savePaySettings(s: PaySettings, uid: string) {
  await setDoc(doc(db(), "settings", "payments"), {
    upiId: s.upiId.trim(),
    payeeName: s.payeeName.trim().slice(0, 60),
    note: s.note.trim().slice(0, 200),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
