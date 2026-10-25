import { test } from "node:test";
import assert from "node:assert/strict";
import { answerPush, questionPush } from "../../lib/doubts/notify.js";

test("the teacher's push names the child and the subject", () => {
  const push = questionPush({ studentName: "Aarav Sharma", question: "Why is 0 divided by 5 zero?" }, { subject: "Maths", name: "Class 7 Maths" });
  assert.deepEqual(push, { title: "New doubt from Aarav · Maths", body: "Why is 0 divided by 5 zero?" });
});

test("the family's push names the teacher and keeps long answers short", () => {
  const push = answerPush({ teacherName: "Priya Ma'am", studentName: "Aarav Sharma", answer: "x".repeat(300) });
  assert.equal(push.title, "Priya Ma'am answered Aarav's doubt");
  assert.equal(push.body.length, 140);
  assert.ok(push.body.endsWith("…"));
});
