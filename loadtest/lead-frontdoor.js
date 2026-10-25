// The live demo form's front door, writing nothing. Requests come without an App Check token, so the
// function turns them away (401) before it touches Firestore: this measures how many requests the
// function itself takes (5 instances x 40 at once), at no database cost.
//   k6 run -e LEAD_URL=https://asia-south1-stoodant-prod.cloudfunctions.net/submitLead loadtest/lead-frontdoor.js
import http from "k6/http";
import { check } from "k6";

const URL = __ENV.LEAD_URL;
const TOP = Number(__ENV.TOP_RATE || 150);

export const options = {
  scenarios: {
    front_door: {
      executor: "ramping-arrival-rate", startRate: 5, timeUnit: "1s", preAllocatedVUs: 50, maxVUs: 400,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "30s", target: 50 },
        { duration: "30s", target: TOP },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    "checks": ["rate>0.99"],
    http_req_duration: ["p(95)<1500"],
  },
};

const body = JSON.stringify({
  idempotencyKey: "00000000-0000-4000-8000-000000000000", parentName: "Load Test", studentClass: "7", board: "CBSE",
  phone: "9000000000", consent: true, noticeVersion: "2026-10-17", startedAt: 1, website: "", source: { path: "/" },
});

export default function () {
  const res = http.post(URL, body, { headers: { "Content-Type": "application/json", Origin: "https://stoodant.com" } });
  // 401 = turned away at App Check, nothing stored. 429 from Google = all 5 instances busy.
  check(res, { "refused before any write (401)": (r) => r.status === 401 });
}
