import { describe, expect, it } from "vitest";

import { classSummary, testAverage } from "@/lib/progress/classSummary";
import { previousPeriod, testTimeline, weekOf, weeklyAttendance } from "@/lib/progress/insights";
import {
  SAMPLE_BATCH,
  SAMPLE_HISTORY,
  SAMPLE_RECORDS,
  SAMPLE_TODAY,
} from "@/lib/progress/sampleData";

describe("parent charts", () => {
  it("gives eight weeks of attendance, oldest first, ending with this week", () => {
    const weeks = weeklyAttendance(SAMPLE_RECORDS, SAMPLE_TODAY);
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)!.from).toBe(weekOf(SAMPLE_TODAY).from);
    expect(weeks[0]!.from < weeks[1]!.from).toBe(true);
    // Cancelled classes never count against the child.
    for (const w of weeks) expect(w.attended).toBeLessThanOrEqual(w.held);
  });

  it("lists marked tests in date order and leaves missed tests out", () => {
    const points = testTimeline(SAMPLE_RECORDS, SAMPLE_TODAY);
    expect(points.map((p) => p.date)).toEqual([...points.map((p) => p.date)].sort());
    expect(points.some((p) => p.title === "Weather and climate")).toBe(false);
  });

  it("finds the week or month before", () => {
    expect(previousPeriod({ from: "2026-10-12", to: "2026-10-18" }, "week")).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
    expect(previousPeriod({ from: "2026-10-01", to: "2026-10-31" }, "month")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });
});

describe("teacher class overview", () => {
  const summary = classSummary(SAMPLE_BATCH.students, SAMPLE_HISTORY, SAMPLE_TODAY);

  it("flags the child who keeps missing class and whose marks dipped", () => {
    const kabir = summary.rows.find((r) => r.name === "Kabir Singh")!;
    expect(kabir.flags).toContain("Missing classes");
    const rohan = summary.rows.find((r) => r.name === "Rohan Das")!;
    expect(rohan.flags).not.toContain("Missing classes");
  });

  it("averages only the children who sat a test", () => {
    const sheet = {
      id: "x",
      title: "Quiz",
      date: "2026-10-10",
      max: 20,
      scores: { a: 10, b: null, c: 20 },
    };
    expect(testAverage(sheet)).toBe(75);
  });

  it("leaves out cancelled days and days a child wasn't on the roster", () => {
    const history = {
      days: [
        { date: "2026-10-12", status: "held" as const, attendance: { a: "present" as const } },
        { date: "2026-10-14", status: "cancelled" as const, attendance: {} },
        {
          date: "2026-10-16",
          status: "held" as const,
          attendance: { a: "absent" as const, b: "present" as const },
        },
      ],
      tests: [],
    };
    const rows = classSummary(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      history,
      "2026-10-18",
    ).rows;
    expect(rows[0]).toMatchObject({ held: 2, attended: 1, attendance: 50 });
    expect(rows[1]).toMatchObject({ held: 1, attended: 1, attendance: 100 });
  });
});
