import { describe, expect, it } from "vitest";

import { ago, forTeacher, sampleDoubts, unseenAnswers } from "./Doubts";

const NOW = Date.parse("2026-10-25T12:00:00Z");

describe("doubts", () => {
  it("the teacher sees the oldest waiting doubt first, answered ones apart", () => {
    const { waiting, answered } = forTeacher(sampleDoubts(NOW));
    expect(waiting.map((d) => d.id)).toEqual(["sd2", "sd1"]);
    expect(answered.map((d) => d.id)).toEqual(["sd3"]);
  });

  it("only answers since the family last looked count as new", () => {
    const items = sampleDoubts(NOW);
    expect(unseenAnswers(items, 0).map((d) => d.id)).toEqual(["sd3"]);
    expect(unseenAnswers(items, NOW - 60_000)).toEqual([]);
  });

  it("times read as minutes, hours, then the day", () => {
    expect(ago(NOW - 10_000, NOW)).toBe("just now");
    expect(ago(NOW - 12 * 60_000, NOW)).toBe("12 min ago");
    expect(ago(NOW - 3 * 3_600_000, NOW)).toBe("3 h ago");
    expect(ago(NOW - 3 * 86_400_000, NOW)).toMatch(/22 Oct/);
  });
});
