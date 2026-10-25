import { test } from "node:test";
import assert from "node:assert/strict";
import { dueText, noticePush } from "../../lib/notices/notify.js";

test("due dates read as today, tomorrow or a short day", () => {
  assert.equal(dueText("2026-10-25", "2026-10-25"), "due today");
  assert.equal(dueText("2026-10-26", "2026-10-25"), "due tomorrow");
  assert.equal(dueText("2026-10-28", "2026-10-25"), "due Wed, 28 Oct");
});

test("homework and notices get their own push wording", () => {
  const hw = noticePush({ kind: "homework", subject: "Maths", title: "Ex 5.2, Q1 to Q10", due: "2026-10-26", teacherName: "Priya" }, "2026-10-25");
  assert.deepEqual(hw, { title: "New homework: Maths", body: "Ex 5.2, Q1 to Q10, due tomorrow" });
  const notice = noticePush({ kind: "notice", subject: "Maths", title: "No class on Friday", teacherName: "Priya Ma'am" }, "2026-10-25");
  assert.deepEqual(notice, { title: "Notice from Priya Ma'am", body: "No class on Friday" });
});
