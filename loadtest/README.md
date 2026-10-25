# Load tests (k6)

| Script | Hits | Writes to Firebase | Run from |
|---|---|---|---|
| `site.js` | live pages and their scripts/styles on Vercel's CDN | nothing | GitHub: Actions > Load test |
| `lead-frontdoor.js` | the live demo form's function, without an App Check token | nothing (refused with 401 before any read or write) | GitHub: Actions > Load test |
| `lead-emulator.js` | the full form write path: many parents, double taps, one bot | the **emulator** only | locally: `cd functions && npm run emulators`, then `k6 run loadtest/lead-emulator.js` |

Never point `lead-emulator.js` at a real project: every accepted request writes about 7 documents.

## Results, 2026-10-25

**Live pages** (GitHub runner in the US, so every request crossed an ocean): ramp to **100 visitors at
the same time** for 4.5 minutes, each opening a page every 1–3 s and loading scripts and styles on 30%
of visits. 21,779 requests, **0 failed**, page p95 46 ms, scripts/styles p95 57 ms. 455 MB served, which
is about 0.5% of Vercel's 100 GB monthly allowance. No slowdown at the peak: the pages are static files
on a CDN, so this scales far past what the business will see.

**Live form, front door**: ramp to **150 requests a second** (5,249 requests). Every one was turned away
by App Check with 401, p95 296 ms (mostly the US to Mumbai round trip), no 429s or 5xx: the function
scaled without hitting its cap of 5 instances x 40 requests. Firestore use: **0** reads, **0** writes.

**Form write path (emulator, 4-core machine)**: at 10, 20, 40, 100 and 200 accepted requests a second,
**0 errors**; p95 21 ms up to 40/s, 335 ms at 100/s, 488 ms at 200/s (the emulator's own limit).
Counted afterwards: exactly one lead, one consent record and one request record per accepted submit
(3,022 of 3,022 and 5,765 of 5,765); 50 double taps made 50 leads, not 100; the bot from one address
got 5 through, then 429 for the other 45.

## What actually limits the form

Not speed: the free Firestore quota. Each accepted demo request costs about 7 writes (two rate-limit
counters, the lead, dedupe, idempotency and consent records, and the alert outcome) and 4 reads, so the
free 20,000 writes a day covers about **2,800 demo requests a day**. Blaze is on, so going over costs
money (about Rs 0.15 per 1,000 extra writes) rather than failing. A single address gets at most 5
requests per 10 minutes and 20 a day, and App Check stops scripts that aren't the real site.

## Found along the way

- The site posts the form straight to `cloudfunctions.net`, not through Firebase Hosting. The rate
  limit reads the visitor's address from `fastly-client-ip`, which only Firebase Hosting sets; called
  directly, a client can send that header itself and look like a new visitor each time. App Check
  still stops plain scripts, so this matters only to someone who can mint App Check tokens. It goes
  away when the domain moves to Firebase Hosting (`/api/lead`), or the function can stop trusting the
  header on direct calls once we confirm from the live logs which header Google adds.
