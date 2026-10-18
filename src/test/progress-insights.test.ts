import { describe, expect, it } from "vitest";

import {
  attendanceSummary,
  improvement,
  monthOf,
  overview,
  weekOf,
  type TestRecord,
} from "@/lib/progress/insights";
import { monthlyReport, weeklyReport } from "@/lib/progress/reportText";
import { SAMPLE_RECORDS, SAMPLE_TODAY } from "@/lib/progress/sampleData";

const test = (date: string, score: number | null, max = 20): TestRecord => ({
  date,
  subject: "Maths",
  title: date,
  score,
  max,
});

describe("attendance", () => {
  const week = { from: "2026-10-12", to: "2026-10-18" };

  it("counts late as attended and leaves cancelled classes out", () => {
    const result = attendanceSummary(
      [
        { date: "2026-10-12", subject: "Maths", status: "present" },
        { date: "2026-10-13", subject: "Maths", status: "late" },
        { date: "2026-10-14", subject: "Maths", status: "absent" },
        { date: "2026-10-15", subject: "Maths", status: "cancelled" },
        { date: "2026-10-20", subject: "Maths", status: "absent" },
      ],
      week,
    );
    expect(result).toEqual({ held: 3, attended: 2, percent: 67 });
  });

  it("has no percentage when no class was held", () => {
    expect(attendanceSummary([], week).percent).toBeNull();
  });
});

describe("improvement", () => {
  it("compares the latest tests with the ones just before, as percentages", () => {
    // Earlier three: 50, 55, 60 (avg 55). Latest three: 65, 70, 75 (avg 70).
    const tests = [10, 11, 12, 13, 14, 15].map((s, i) => test(`2026-10-0${i + 1}`, s));
    expect(improvement(tests)).toEqual({ delta: 15, trend: "up" });
  });

  it("treats marks out of different totals fairly", () => {
    expect(improvement([test("2026-10-01", 10, 20), test("2026-10-02", 25, 50)])).toEqual({
      delta: 0,
      trend: "steady",
    });
  });

  it("skips missed tests and needs two marked tests", () => {
    expect(improvement([test("2026-10-01", null), test("2026-10-02", 15)])).toEqual({
      delta: null,
      trend: "unknown",
    });
  });

  it("calls a clear drop a dip", () => {
    expect(improvement([test("2026-10-01", 18), test("2026-10-02", 14)]).trend).toBe("down");
  });
});

describe("periods", () => {
  it("runs weeks Monday to Sunday and months first to last day", () => {
    expect(weekOf("2026-10-18")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(weekOf("2026-10-12")).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    expect(monthOf("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("sample overview and reports", () => {
  const month = overview(SAMPLE_RECORDS, monthOf(SAMPLE_TODAY));

  it("finds the improving subject and the one to focus on", () => {
    expect(month.subjects.find((s) => s.subject === "Maths")?.trend).toBe("up");
    expect(month.focus?.subject).toBe("English");
  });

  it("builds WhatsApp messages within the template limit", () => {
    const weekly = weeklyReport(SAMPLE_RECORDS, SAMPLE_TODAY);
    const monthly = monthlyReport(SAMPLE_RECORDS, SAMPLE_TODAY);
    expect(weekly).toContain("Mrs Mehta");
    expect(weekly).toContain("Simple equations test: 41/50 (82%)");
    expect(monthly).toContain("October 2026");
    expect(weekly.length).toBeLessThan(1024);
    expect(monthly.length).toBeLessThan(1024);
  });
});
