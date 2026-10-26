import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { billingStatus, nextPeriod, planPrice } from "./period";

describe("plan dates in the app", () => {
  it("is the same file the server uses", () => {
    const read = (p: string) => readFileSync(path.resolve(__dirname, p), "utf8");
    expect(read("./period.ts")).toBe(read("../../../functions/src/billing/period.ts"));
  });

  it("works out the next plan and its price", () => {
    expect(nextPeriod("2026-11-20", "2026-11-25", 26, 3)).toEqual({
      from: "2026-11-26",
      to: "2027-02-25",
    });
    expect(planPrice(2999, 3, { "3": 5 })).toEqual({ list: 8997, percent: 5, amount: 8547 });
    expect(billingStatus("2026-11-27", "2026-11-25", false).status).toBe("grace");
  });
});
