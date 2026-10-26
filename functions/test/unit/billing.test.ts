import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, billingStatus, nextPeriod, reminderStage, replay } from "../../lib/billing/period.js";
import { reminderText } from "../../lib/billing/billing.js";
import { monthlyFeeOf, planPrice } from "../../lib/billing/period.js";

const pay = (id: string, payDay: string, months = 1) => ({ id, payDay, months, order: 0 });

test("a month ends the day before the same date next month, and the 31st doesn't drift", () => {
  assert.equal(addMonths("2026-10-26", 1), "2026-11-26");
  assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonths("2027-02-28", 1, 31), "2027-03-31"); // the anchor stays the 31st
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
  const { periods } = replay([pay("a", "2027-01-31"), pay("b", "2027-02-25"), pay("c", "2027-03-28")]);
  assert.deepEqual(periods.map((p) => [p.from, p.to]), [
    ["2027-01-31", "2027-02-27"],
    ["2027-02-28", "2027-03-30"],
    ["2027-03-31", "2027-04-29"],
  ]);
});

test("paying early or within the grace days continues the plan; paying later starts fresh", () => {
  const early = replay([pay("a", "2026-10-26"), pay("b", "2026-11-20", 3)]);
  assert.equal(early.paidUntil, "2027-02-25"); // 26 Oct to 25 Nov, then three more months
  const grace = replay([pay("a", "2026-10-26"), pay("b", "2026-11-28")]);
  assert.equal(grace.paidUntil, "2026-12-25"); // paid 3 days late: no free days
  const lapsed = replay([pay("a", "2026-10-26"), pay("b", "2026-12-10")]);
  assert.equal(lapsed.paidUntil, "2027-01-09"); // paused a while: starts again on the day paid
  assert.equal(replay([]).paidUntil, "");
});

test("where a family stands", () => {
  assert.deepEqual(billingStatus("2026-10-26", "", false), { status: "new", daysLeft: null, open: false });
  assert.equal(billingStatus("2026-10-26", "", true).status, "checking");
  assert.equal(billingStatus("2026-10-26", "", true).open, true);
  assert.equal(billingStatus("2026-11-10", "2026-11-25", false).status, "active");
  assert.equal(billingStatus("2026-11-21", "2026-11-25", false).status, "ending");
  assert.equal(billingStatus("2026-11-25", "2026-11-25", false).status, "ending");
  assert.deepEqual(billingStatus("2026-11-28", "2026-11-25", false), { status: "grace", daysLeft: -3, open: true });
  assert.deepEqual(billingStatus("2026-11-29", "2026-11-25", false), { status: "paused", daysLeft: -4, open: false });
  assert.equal(billingStatus("2026-12-20", "2026-11-25", true).open, true); // a payment being checked
});

test("the next plan's dates", () => {
  assert.deepEqual(nextPeriod("2026-11-20", "2026-11-25", 26, 1), { from: "2026-11-26", to: "2026-12-25" });
  assert.deepEqual(nextPeriod("2026-12-20", "2026-11-25", 26, 1), { from: "2026-12-20", to: "2027-01-19" });
  assert.deepEqual(nextPeriod("2026-10-26", "", 0, 3), { from: "2026-10-26", to: "2027-01-25" });
});

test("reminders: once per step, gently worded", () => {
  assert.equal(reminderStage("ending", 4), "soon");
  assert.equal(reminderStage("ending", 1), "last");
  assert.equal(reminderStage("grace", -1), "grace");
  assert.equal(reminderStage("paused", -9), "paused");
  assert.equal(reminderStage("active", 20), null);
  assert.equal(reminderStage("new", null), null);
  assert.equal(reminderText("soon", "Aarav", "2026-11-25").title, "Aarav's plan ends on 25 Nov");
});

test("plan price with the team's discount for paying ahead", () => {
  assert.deepEqual(planPrice(2999, 1, { "3": 5 }), { list: 2999, percent: 0, amount: 2999 });
  assert.deepEqual(planPrice(2999, 3, { "3": 5 }), { list: 8997, percent: 5, amount: 8547 });
  assert.deepEqual(planPrice(2999, 6, undefined), { list: 17994, percent: 0, amount: 17994 });
  assert.equal(planPrice(1000, 12, { "12": 90 }).percent, 50); // capped
  // Any number of months: the best discount for that many months or fewer.
  assert.equal(planPrice(1000, 5, { "3": 5, "6": 8 }).percent, 5);
  assert.equal(planPrice(1000, 2, { "3": 5 }).percent, 0);
  assert.equal(planPrice(1000, 7, { "3": 5, "6": 8, "12": 12 }).amount, 6440);
  assert.equal(monthlyFeeOf(0, [1500, 1499]), 2999);
  assert.equal(monthlyFeeOf(2500, [1500, 1499]), 2500); // the team's own amount for this child
});
