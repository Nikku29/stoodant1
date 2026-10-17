// Initial JS budget (CLAUDE.md v10: <= 150 KB gzip). Counts every script the prerendered home page loads
// before any interaction: <script src> plus <link rel="modulepreload">. Lazy chunks are not counted.
// Usage: node scripts/check-bundle.mjs [--strict]   (without --strict an overrun only warns)
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 150;
const root = ".output/public";
const html = readFileSync(`${root}/index.html`, "utf8");
const urls = new Set([
  ...[...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1]),
]);
let total = 0;
for (const url of urls) {
  const kb = gzipSync(readFileSync(`${root}${url}`), { level: 9 }).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${url}`);
}
console.log(`${total.toFixed(1).padStart(7)} KB  initial JS (gzip), budget ${BUDGET_KB} KB`);
if (total > BUDGET_KB) {
  const message = `Initial JS is ${total.toFixed(1)} KB gzip, over the ${BUDGET_KB} KB budget.`;
  if (process.argv.includes("--strict")) { console.error(message); process.exit(1); }
  console.log(`::warning::${message}`);
}
