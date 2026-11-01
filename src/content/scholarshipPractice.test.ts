import { PRACTICE } from "./scholarshipPractice";

// Two options that differ only in spaces, slashes, brackets, × or · look the same on a phone (10√3 m and 10/√3 m).
const plain = (o: string) => o.toLowerCase().replace(/²/g, "2").replace(/³/g, "3").replace(/[\s/()·×*^]/g, "");

describe("the mock test questions", () => {
  for (const cls of ["9", "10"] as const) {
    it(`Class ${cls}: 15 per section, 4 clearly different options, a valid answer`, () => {
      const qs = PRACTICE[cls];
      expect(qs).toHaveLength(60);
      for (const s of ["maths", "science", "reasoning", "english"]) expect(qs.filter((q) => q.subject === s)).toHaveLength(15);
      for (const q of qs) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map(plain)).size, `${q.text}: ${q.options.join(" | ")}`).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThanOrEqual(3);
      }
    });
  }
});
