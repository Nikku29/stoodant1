import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { BLUEPRINT, indexBank, hasLookAlikeOptions, lookAlike, lockQuestions, makePaper, paperKey, scorePaper, showPaper, type BankQuestion } from "../../lib/scholarship/exam/paper.js";
import { canStartAt, paperEnds, questionsOpen, slotStart } from "../../lib/scholarship/exam/slots.js";

const SUBJECTS = ["maths", "science", "reasoning", "english"] as const;
const levels = ["easy", "medium", "hard"] as const;
const bank: BankQuestion[] = SUBJECTS.flatMap((subject) => levels.flatMap((level) => Array.from({ length: 20 }, (_, n) => ({
  id: `${subject}-${level}-${n}`, class: "10", subject, level, text: `${subject} ${level} ${n}`,
  options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`], answer: n % 4,
}))));

test("each paper follows the blueprint (mostly hard) and carries its own answer key", () => {
  const paper = makePaper(bank, "seed-1");
  assert.equal(paper.length, 60);
  for (const subject of SUBJECTS) {
    const mine = paper.filter((p) => p.subject === subject).map((p) => bank.find((q) => q.id === p.id)!);
    for (const level of levels) assert.equal(mine.filter((q) => q.level === level).length, BLUEPRINT[level]);
  }
  // The shown option at `answer` is the bank's right answer, whatever order the options were shuffled into.
  const shown = showPaper(paper, bank);
  paper.forEach((item, i) => {
    const q = bank.find((b) => b.id === item.id)!;
    assert.equal(shown[i]!.options[item.answer], q.options[q.answer]);
  });
  const all = Object.fromEntries(paper.map((p, i) => [String(i), p.answer]));
  assert.equal(scorePaper(paper, all).marks, 60);
  assert.equal(scorePaper(paper, { 0: (paper[0]!.answer + 1) % 4 }).wrong, 1);
});

test("different students get different papers; the same student always gets the same one", () => {
  assert.deepEqual(makePaper(bank, "seed-1"), makePaper(bank, "seed-1"));
  assert.notDeepEqual(makePaper(bank, "seed-1").map((p) => p.id), makePaper(bank, "seed-2").map((p) => p.id));
});

test("the locked paper opens only with the student's key", () => {
  const questions = showPaper(makePaper(bank, "s"), bank);
  const key = paperKey("pepper", "261000001");
  const locked = lockQuestions(questions, key);
  const open = (k: Buffer) => {
    const data = Buffer.from(locked.data, "base64");
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(locked.iv, "base64"));
    d.setAuthTag(data.subarray(-16));
    return JSON.parse(Buffer.concat([d.update(data.subarray(0, -16)), d.final()]).toString("utf8")) as unknown;
  };
  assert.deepEqual(open(key), questions);
  assert.throws(() => open(paperKey("pepper", "261000002")));
  assert.ok(!locked.data.includes("maths"));
});

test("a paper never takes two questions from the same pattern group", () => {
  const grouped: BankQuestion[] = bank.map((q, i) => (q.level === "hard" ? { ...q, group: `g${i % 3}-${q.subject}` } : q));
  for (const seed of ["a", "b", "c", "d"]) {
    const paper = makePaper(grouped, seed);
    assert.equal(paper.length, 60);
    const groups = paper.map((p) => grouped.find((q) => q.id === p.id)!.group).filter(Boolean);
    assert.equal(new Set(groups).size, groups.length);
  }
});

test("the same answer written twice is left out; close-but-different distractors stay", () => {
  assert.ok(lookAlike("10 m", "10m"));
  assert.ok(lookAlike("Ω M", "ω m"));
  assert.ok(lookAlike("x^2", "x²"));
  assert.ok(!lookAlike("10√3 m", "10/√3 m"));
  assert.ok(!lookAlike("Ω m", "Ω/m"));
  assert.ok(!lookAlike("9.8 m/s²", "98 m/s²"));
  assert.ok(!lookAlike("It's raining.", "Its raining."));
  assert.ok(!hasLookAlikeOptions(["5√3 m", "10/√3 m", "10√3 m", "20 m"]));
  const q = (id: string, options: string[]) => ({ id, class: "10", subject: "maths", level: "hard", text: id, options, answer: 0 });
  const indexed = indexBank([q("ok", ["5√3 m", "10/√3 m", "10√3 m", "20 m"]), q("alike", ["5√3 m", "10 m", "10m", "20 m"])]);
  assert.deepEqual(indexed.get("10")!.map((x) => x.id), ["ok"]);
});

test("log-in opens 5 minutes early; the questions open by themselves at the hour, or 2 minutes after a later log-in", () => {
  const slot = "2026-11-10T09";
  const start = slotStart(slot);
  const MIN = 60_000;
  assert.ok(!canStartAt(slot, start - 6 * MIN));
  assert.ok(canStartAt(slot, start - 5 * MIN));
  assert.ok(canStartAt(slot, start + 15 * MIN));
  assert.ok(!canStartAt(slot, start + 16 * MIN));
  assert.equal(questionsOpen(slot, start - 4 * MIN), start);
  assert.equal(questionsOpen(slot, start - MIN), start + MIN);
  assert.equal(questionsOpen(slot, start + 2 * MIN), start + 4 * MIN);
  assert.equal(paperEnds(slot, start - 4 * MIN), start + 60 * MIN);
  assert.equal(paperEnds(slot, start + 15 * MIN), start + 77 * MIN);
});
