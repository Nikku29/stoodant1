// The live pages (static files on Vercel's CDN). No Firebase use at all.
//   k6 run -e BASE_URL=https://stoodant.com loadtest/site.js
// Visitors open a page, sometimes load its scripts and styles (a first visit), then read for a while.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://stoodant.com";
const PEAK = Number(__ENV.PEAK_VUS || 100);
const PAGES = ["/", "/", "/", "/about", "/privacy", "/terms", "/refund-policy", "/login"];
const HEADERS = { "Accept-Encoding": "gzip, br", "User-Agent": "stoodant-loadtest (k6)" };

export const options = {
  stages: [
    { duration: "1m", target: Math.round(PEAK / 4) },
    { duration: "2m", target: PEAK },
    { duration: "1m", target: PEAK },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{kind:page}": ["p(95)<800"],
    "http_req_duration{kind:asset}": ["p(95)<800"],
  },
};

export function setup() {
  const home = http.get(`${BASE}/`, { headers: HEADERS });
  const found = [...home.body.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  return { assets: [...new Set(found)].slice(0, 6) };
}

export default function ({ assets }) {
  const path = PAGES[Math.floor(Math.random() * PAGES.length)];
  const page = http.get(`${BASE}${path}`, { headers: HEADERS, tags: { kind: "page", name: path } });
  check(page, { "page 200": (r) => r.status === 200 });
  if (Math.random() < 0.3 && assets.length) {
    const res = http.batch(assets.map((a) => ["GET", `${BASE}${a}`, null, { headers: HEADERS, tags: { kind: "asset", name: "asset" } }]));
    check(res, { "assets 200": (all) => all.every((r) => r.status === 200) });
  }
  sleep(1 + Math.random() * 2);
}
