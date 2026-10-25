// DevOps level 6: compare this week's Lighthouse run on the live site with the saved normal (ops/lighthouse-baseline.json).
// Usage: node scripts/compare-lighthouse.mjs [.lighthouseci dir]
// Exits 1 when a number has clearly left its normal range, so the scheduled workflow fails and GitHub emails the owner.
// With no baseline yet it prints one to save and passes.
import { existsSync, readFileSync, readdirSync, appendFileSync } from "node:fs";

const dir = process.argv[2] ?? ".lighthouseci";
const baselineFile = "ops/lighthouse-baseline.json";

const runs = readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f)).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
if (runs.length === 0) throw new Error(`No Lighthouse results in ${dir}`);

const median = (values) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pick = (lhr) => ({
  performance: Math.round(lhr.categories.performance.score * 100),
  lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
  tbtMs: Math.round(lhr.audits["total-blocking-time"].numericValue),
  cls: Number(lhr.audits["cumulative-layout-shift"].numericValue.toFixed(3)),
  totalKb: Math.round(lhr.audits["total-byte-weight"].numericValue / 1024),
});
const each = runs.map(pick);
const now = Object.fromEntries(Object.keys(each[0]).map((k) => [k, median(each.map((r) => r[k]))]));

// A metric is irregular only when it is worse by both a ratio and an absolute amount, so noise on small numbers doesn't fail.
const rules = {
  performance: (b, n) => n < b - 10,
  lcpMs: (b, n) => n > b * 1.25 && n - b > 500,
  tbtMs: (b, n) => n > b * 1.5 && n - b > 100,
  cls: (b, n) => n - b > 0.05,
  totalKb: (b, n) => n > b * 1.15 && n - b > 50,
};

const summary = (line) => { console.log(line); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n"); };

if (!existsSync(baselineFile)) {
  summary("No baseline yet. Save this as ops/lighthouse-baseline.json:\n\n```json\n" + JSON.stringify(now, null, 2) + "\n```");
  process.exit(0);
}

const base = JSON.parse(readFileSync(baselineFile, "utf8"));
summary("| Metric | Normal | This week | |\n|---|---|---|---|");
let failed = false;
for (const [key, worse] of Object.entries(rules)) {
  const bad = key in base && worse(base[key], now[key]);
  failed ||= bad;
  summary(`| ${key} | ${base[key]} | ${now[key]} | ${bad ? "⚠️ irregular" : "ok"} |`);
}
if (failed) {
  console.error("Live site performance left its normal range. Compare with the last release tag (DEVOPS.md, level 6).");
  process.exit(1);
}
