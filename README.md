# Stoodant

Landing page for Stoodant, personalised live tuition for Class 4 to 10 (CBSE and ICSE).
Live at [stoodant.com](https://stoodant.com). The page has one goal: get a parent to book a free demo class.

## Stack

- React 19, TypeScript, TanStack Start (file routes, pages prerendered to static HTML at build time)
- Vite 8, Tailwind CSS 4
- framer-motion, GSAP, three.js (three.js only loads with the final call-to-action section)
- Firebase: Hosting, Firestore, Cloud Functions (demo form backend), App Check

## Where things live

| Path | What |
| --- | --- |
| `src/config/siteConfig.ts` | All copy, prices, batches, offer switch and contact details |
| `src/config/timing.ts` | Animation timings |
| `src/routes/` | Pages (`index.tsx`, `404.tsx`) and the HTML shell (`__root.tsx`) |
| `src/components/` | Sections and shared UI |
| `functions/` | Cloud Functions: `submitLead` (form endpoint) and `onLeadCreated` (email and WhatsApp alerts) |
| `firestore.rules`, `storage.rules` | Security rules, deny by default |
| `scripts/check-bundle.mjs` | Fails the build if the first-load JavaScript goes over 150 KB gzip |
| `CLAUDE.md`, `AGENTS.md` | Project rules for design, copy and performance |

## Run it locally

You need Node 22 and [bun](https://bun.sh) (bun only installs packages; Node runs everything).

```sh
bun install
npm run dev          # http://localhost:8080
```

Build and check the output:

```sh
npm run build        # static site in dist/client
node scripts/check-bundle.mjs
npm run preview
```

Backend tests (needs Java 21 for the Firebase emulators):

```sh
cd functions
npm ci
npm test             # Firestore rules and function tests
npm run e2e          # browser tests of the demo form against the emulators
```

## Deploy

See [DEPLOY.md](DEPLOY.md). Pushes to `main` run CI; deploys to Firebase start once the repository variable `DEPLOY_ENABLED` is `true`.
