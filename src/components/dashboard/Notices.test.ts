import { currentFor, dueLabel, sampleNotices, type FamilyNotice } from "./Notices";

const TODAY = "2026-10-25";
const NOW = Date.parse("2026-10-25T12:00:00Z");
const DAY = 86_400_000;

describe("homework and notices on the parent's Home", () => {
  it("shows homework still to do first, soonest due first, then notices, then done homework", () => {
    const base = sampleNotices(TODAY, NOW)[0]!;
    const items: FamilyNotice[] = [
      { ...base, id: "done", kind: "homework", due: "2026-10-26", done: true, createdAt: NOW - DAY },
      { ...base, id: "notice", kind: "notice", due: null, done: false, createdAt: NOW - 2 * DAY },
      { ...base, id: "later", kind: "homework", due: "2026-10-28", done: false, createdAt: NOW },
      { ...base, id: "soon", kind: "homework", due: "2026-10-26", done: false, createdAt: NOW - DAY },
      { ...base, id: "old-notice", kind: "notice", due: null, done: false, createdAt: NOW - 20 * DAY },
      { ...base, id: "old-homework", kind: "homework", due: "2026-10-01", done: true, createdAt: NOW - 30 * DAY },
    ];
    expect(currentFor(items, TODAY).map((n) => n.id)).toEqual(["soon", "later", "notice", "done"]);
  });

  it("says when homework is due in plain words", () => {
    expect(dueLabel("2026-10-25", TODAY)).toBe("Due today");
    expect(dueLabel("2026-10-26", TODAY)).toBe("Due tomorrow");
    expect(dueLabel("2026-10-24", TODAY)).toMatch(/^Was due/);
    expect(dueLabel("2026-10-30", TODAY)).toMatch(/^Due 30 Oct/);
  });
});
