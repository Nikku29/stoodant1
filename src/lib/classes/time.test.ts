import { istParts, joinState, statusLine, weeklyStarts, whenLabel } from "./time";

// 2026-10-25 is a Sunday. 10:00 UTC = 3:30 pm in India.
const NOW = Date.parse("2026-10-25T10:00:00Z");

describe("India time", () => {
  it("reads instants as India date and time", () => {
    expect(istParts(Date.parse("2026-10-25T20:00:00Z"))).toEqual({ date: "2026-10-26", time: "01:30", weekday: 1 });
  });

  it("labels today, tomorrow and later days", () => {
    expect(whenLabel(Date.parse("2026-10-25T11:30:00+05:30"), NOW)).toBe("Today, 11:30 am");
    expect(whenLabel(Date.parse("2026-10-26T17:00:00+05:30"), NOW)).toBe("Tomorrow, 5:00 pm");
    expect(whenLabel(Date.parse("2026-10-28T12:15:00+05:30"), NOW)).toBe("Wed 28 Oct, 12:15 pm");
  });
});

describe("weekly series", () => {
  it("repeats on the chosen weekdays for the chosen weeks", () => {
    // Mondays and Wednesdays for 2 weeks from Monday 26 Oct.
    expect(weeklyStarts("2026-10-26", "17:00", [1, 3], 2)).toEqual([
      "2026-10-26T17:00:00+05:30",
      "2026-10-28T17:00:00+05:30",
      "2026-11-02T17:00:00+05:30",
      "2026-11-04T17:00:00+05:30",
    ]);
  });
  it("is one class when no weekday is picked, and never more than the cap", () => {
    expect(weeklyStarts("2026-10-26", "17:00", [], 4)).toEqual(["2026-10-26T17:00:00+05:30"]);
    expect(weeklyStarts("2026-10-26", "17:00", [0, 1, 2, 3, 4, 5, 6], 12)).toHaveLength(26);
  });
});

describe("Join button", () => {
  const cls = { startAt: NOW + 30 * 60_000, endAt: NOW + 90 * 60_000, status: "scheduled" };
  it("turns on 10 minutes before and off at the end", () => {
    expect(joinState(cls, NOW)).toBe("upcoming");
    expect(joinState(cls, cls.startAt - 10 * 60_000)).toBe("open");
    expect(joinState(cls, cls.endAt)).toBe("open");
    expect(joinState(cls, cls.endAt + 1)).toBe("ended");
    expect(joinState({ ...cls, status: "cancelled" }, cls.startAt)).toBe("cancelled");
  });
  it("says when", () => {
    expect(statusLine(cls, NOW)).toBe("Starts in 30 min");
    expect(statusLine(cls, cls.startAt + 1)).toBe("On now, ends 5:00 pm");
  });
});
