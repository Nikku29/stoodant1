import { test } from "node:test";
import assert from "node:assert/strict";
import { couponProblem, discountFor, feePush } from "../../lib/fees/fees.js";

test("coupons: valid, expired, used up, switched off", () => {
  assert.equal(couponProblem({ percent: 10, active: true, maxUses: 0, uses: 9, expires: "" }, "2026-10-25"), null);
  assert.equal(couponProblem({ percent: 10, active: true, expires: "2026-10-25" }, "2026-10-25"), null); // last day
  assert.match(String(couponProblem({ percent: 10, active: true, expires: "2026-10-24" }, "2026-10-25")), /expired/);
  assert.match(String(couponProblem({ percent: 10, active: true, maxUses: 2, uses: 2 }, "2026-10-25")), /fully used/);
  assert.match(String(couponProblem({ percent: 10, active: false }, "2026-10-25")), /isn't valid/);
  assert.match(String(couponProblem(undefined, "2026-10-25")), /isn't valid/);
});

test("discounts round to whole rupees", () => {
  assert.equal(discountFor(2999, 10), 300);
  assert.equal(discountFor(7999, 15), 1200);
  assert.equal(discountFor(3000, 100), 3000);
});

test("who hears about a fee, and when", () => {
  const due = { status: "due", amount: 3000, payable: 2700, title: "November fees", studentName: "Aarav Mehta" };
  assert.deepEqual(feePush(undefined, due), { to: "family", title: "Fee due: ₹2,700", body: "November fees for Aarav. Pay by UPI in the app." });
  assert.equal(feePush(due, { ...due, status: "submitted", utr: "412345678901" })?.to, "team");
  assert.equal(feePush({ ...due, status: "submitted" }, { ...due, status: "paid" })?.title, "Payment received: ₹2,700");
  assert.equal(feePush({ ...due, status: "submitted" }, { ...due, status: "due" })?.title, "Payment not found yet");
  assert.equal(feePush(due, { ...due, payable: 2000 }), null); // a coupon, no news
});
