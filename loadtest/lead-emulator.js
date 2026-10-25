// Demo form write path, against the Firebase emulator only (never a real project).
//   cd functions && npm run emulators        (in another terminal)
//   k6 run loadtest/lead-emulator.js
// Three things a busy evening looks like: many parents at once, a parent double-tapping Submit, and one
// bot hammering the form from a single address.
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const URL = __ENV.LEAD_URL || "http://127.0.0.1:5001/demo-stoodant/asia-south1/submitLead";
const ORIGIN = "http://localhost:5173";
const RATE = Number(__ENV.RATE || 20);

export const accepted = new Counter("leads_accepted");
export const limited = new Counter("leads_rate_limited");

export const options = {
  scenarios: {
    many_parents: {
      executor: "constant-arrival-rate", rate: RATE, timeUnit: "1s", duration: __ENV.DURATION || "60s",
      preAllocatedVUs: 40, maxVUs: 200, exec: "parent",
    },
    double_tap: { executor: "per-vu-iterations", vus: 10, iterations: 5, exec: "doubleTap" },
    one_bot: { executor: "shared-iterations", vus: 5, iterations: 50, exec: "bot", startTime: "5s" },
  },
  thresholds: {
    "http_req_failed{scenario:many_parents}": ["rate<0.01"],
    "http_req_duration{scenario:many_parents}": ["p(95)<1500"],
    "checks{scenario:many_parents}": ["rate>0.99"],
    "checks{scenario:double_tap}": ["rate==1"],
  },
};

const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
const ip = () => `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}`;
const body = (overrides = {}) => JSON.stringify({
  idempotencyKey: crypto.randomUUID(), parentName: "Load Test Parent", studentClass: "7", board: "CBSE", phone: phone(),
  consent: true, noticeVersion: "2026-10-17", startedAt: Date.now() - 10_000, website: "",
  source: { path: "/", utmSource: "loadtest" }, ...overrides,
});
// The emulator has no Fastly in front, so the client address comes from this header (submit.ts clientIp).
const post = (payload, address) => http.post(URL, payload, {
  headers: { "Content-Type": "application/json", Origin: ORIGIN, "fastly-client-ip": address },
});

export function parent() {
  const res = post(body(), ip());
  if (res.status === 200) accepted.add(1);
  check(res, { "parent gets 200": (r) => r.status === 200 });
}

export function doubleTap() {
  const payload = body();
  const address = ip();
  const first = post(payload, address);
  const second = post(payload, address);
  check([first, second], { "both taps get 200": ([a, b]) => a.status === 200 && b.status === 200 });
}

export function bot() {
  const res = post(body(), "10.255.255.255");
  if (res.status === 429) limited.add(1);
  check(res, { "bot gets 200 or 429": (r) => r.status === 200 || r.status === 429 });
}
