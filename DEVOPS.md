# DevOps at Stoodant: the 7 levels

Each level answers one operational problem with one mechanism. Sized for this stack: a static site on Vercel
(later Firebase Hosting) and a serverless backend on Firebase (Cloud Functions in asia-south1, Firestore, Storage).
Deploy details: DEPLOY.md. Cloud setup: infra/README.md.

| Level | Problem | Mechanism here |
|---|---|---|
| 1 Git | Daily changes break things | Every change is a commit; every change on `main` gets a `live-*` checkpoint tag |
| 2 CI/CD | Saved code isn't checked code | 9 checks on every pull request and on `main`; Vercel ships `main` |
| 3 Docker | "Works on my laptop" | `Dockerfile` + `.devcontainer` pin Node 22, bun 1.4.4, Java 21 |
| 4 Terraform | Cloud setup lived in console clicks | `infra/` describes all of it; `terraform apply` rebuilds it |
| 5 Self-healing | Apps crash while infrastructure is fine | Cloud Run (under Cloud Functions) keeps instances running and replaces crashed ones |
| 6 Metrics | Crashes are handled, early warning isn't | Health dashboard, alerts against each metric's 7-day normal, weekly live Lighthouse |
| 7 Error budgets | 100% uptime is impossible | 99.9% targets (≈43 min/month), burn-rate alerts, CI freezes merges when the budget is gone |

## 1. Git: checkpoints

- Work happens on branches and lands through pull requests. `main` is what's live.
- `.github/workflows/release-tag.yml` tags every push to `main` as `live-YYYY.MM.DD-N`. List them with `git tag -l 'live-*'`.
- **Find the change that broke something:** `git diff live-2026.10.20-14..main` shows everything since a good release.
  `scripts/find-breaking-commit.sh live-2026.10.20-14` rewinds commit by commit (git bisect), runs the CI checks on
  each, and names the first bad commit.
- **Owner step:** protect `main` (GitHub → Settings → Branches → Add rule for `main`): require a pull request, require
  status checks to pass (pick the checks listed under level 2, plus "Error budget"), and block force pushes.
  Without this, the checks report but don't block.

## 2. CI/CD: block bad code, ship good code

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Check | What it stops |
|---|---|
| Typecheck, unit tests, build, bundle budget | type errors, broken logic, a first load over 150 KB |
| Rules and function tests (emulator) | Firestore/Storage rules or functions that leak or break |
| Playwright smoke tests | a home page that doesn't load, console errors, sideways scrolling on phones |
| Lighthouse (mobile) | accessibility, SEO and best-practice regressions |
| Dependency audit and secret scan | known-vulnerable packages, committed keys |
| Docker image | builds that only work on one machine (level 3) |
| Terraform format and validate | broken cloud configuration (level 4) |
| Error budget (`error-budget.yml`) | shipping features while reliability is out of budget (level 7) |

Shipping: Vercel builds `main` on every merge. `deploy.yml` deploys Firebase (functions, rules, hosting) to staging,
then production after your approval, once `DEPLOY_ENABLED=true` (DEPLOY.md step 6). Lint still only warns:
typescript-eslint doesn't support TypeScript 7 yet; make it blocking when it does.

## 3. Docker: the same toolchain everywhere

```bash
docker build --target site -t stoodant-site .   # typecheck, tests, build, bundle budget, then nginx
docker run --rm -p 8080:8080 stoodant-site      # http://localhost:8080, same clean URLs and 404 as production
docker build --target backend-test .             # functions + emulator tests with Java 21 inside
```
In VS Code, "Reopen in Container" uses `.devcontainer/` for the same versions, so a Windows laptop behaves like CI.
The live site isn't served from this image: Vercel and Firebase Hosting serve the same `dist/client` output.
Bump versions in the `Dockerfile` and `package.json` `engines` together.

## 4. Terraform: infrastructure in a file

`infra/` holds the Firestore database, backups, Storage bucket, secrets (names only), GitHub deploy access,
the budget, uptime checks and every alert. See infra/README.md for the first run and day-to-day use.
Applied to stoodant-prod on 2026-10-25 (state in `gs://stoodant-prod-tfstate`); `terraform plan` shows no changes.
Rule: change these only through `infra/` and a pull request, never in the console.

## 5. Self-healing: why there's no Kubernetes cluster

Kubernetes keeps a target number of copies of an app running and replaces any that crash. Stoodant already gets
that without running a cluster:

- Each Cloud Function (2nd gen) is a **Cloud Run** service, which runs on Google's managed Kubernetes-style platform.
  It starts instances when requests arrive, scales to zero when idle, restarts a crashed instance automatically,
  and retries a request on a fresh instance if one dies mid-start. Limits are set in `functions/src/index.ts`
  (`maxInstances: 5`, `timeoutSeconds: 10`, `256MiB`).
- Firestore triggers that fail are logged (alerted at level 6). Lead alerts retry inside the function (`withRetry`),
  so one failed email doesn't drop a lead.
- The site is static files on Vercel's CDN (later Firebase Hosting): there's no server process to crash.

A GKE cluster's nodes run (and bill) around the clock, at least ₹1,000–2,000 a month even when idle, and add
upgrades to look after, for no gain at this traffic. Revisit only if Stoodant runs long-lived servers (for example its own video or live-class service).
`minInstances: 1` on `submitLead` would remove the cold start on the demo form for roughly ₹300–600 a month; not
set, since the form's 3 s minimum fill time already hides it.

## 6. Metrics: spot irregular spikes early

- **Dashboard** "Stoodant health" in Cloud Monitoring (`infra/metrics.tf`): error budget left, uptime response time,
  requests by function and result, p95 response time and p95 CPU against their 7-day normal, running instances,
  Firestore reads and writes. Link: https://console.cloud.google.com/monitoring/dashboards/builder/f631e5fe-47f3-4cfd-b6e6-c40c1dd27486?project=stoodant-prod
- **Anomaly alerts** (email to info@stoodant.com), each comparing the last 10 minutes with the same metric's
  7-day normal and with a floor so tiny numbers don't page anyone: slow responses (2× normal and > 2 s),
  error rate (3× normal and > 5%), traffic spike (5× normal), CPU (2× normal and > 80%), Firestore reads (5× normal).
- **Weekly live check** (`live-metrics.yml`, Mondays 09:00 IST): Lighthouse on stoodant.com on a phone profile,
  compared with `ops/lighthouse-baseline.json`. A failed run emails you. With no baseline yet it prints one to save;
  update the baseline after an intentional change.

## 7. Error budgets: when to ship, when to fix

- Targets (`infra/slo.tf`): the site and the demo form each available **99.9%** over a rolling 30 days, measured
  by the uptime checks every 5 minutes. Budget = 0.1% ≈ **43 minutes of downtime a month** each.
- Burn-rate alerts: "fast" when 2% of the month's budget goes in an hour, "slow" when 5% goes in 6 hours.
- **The rule:** while budget is left, ship as usual. When a budget hits zero, the "Error budget" check fails on
  every pull request, so (with branch protection) nothing new merges or deploys. Only pull requests labelled
  `reliability` pass, and those should fix what used the budget. The freeze lifts on its own as bad minutes age
  out of the 30-day window. Repository variable `DEPLOY_FREEZE=true` freezes by hand (for example during exams week).
- **Owner step:** add repository variables `GCP_WIF_PROVIDER`
  (`projects/839354037071/locations/global/workloadIdentityPools/github/providers/github`) and `GCP_SLO_SA`
  (`github-slo-reader@stoodant-prod.iam.gserviceaccount.com`). Until then the check passes with a warning.

## Runbook: something broke

1. **Is it down for everyone?** Check the alert email, the dashboard, vercel.com/status and status.firebase.google.com.
2. **Did it start after a release?** Compare the alert time with the latest `live-*` tag (`git tag -l 'live-*' --sort=-creatordate | head`).
3. **Roll back first, investigate second.**
   - Site on Vercel: Vercel → Deployments → the previous good one → "Instant Rollback". Or revert the pull request on GitHub (Revert button), which ships a clean `main`.
   - Functions and rules: see DEPLOY.md "Rollback" (re-run the Deploy workflow on the previous tag).
   - Data: restore a backup into a new database (DEPLOY.md "Rollback"), never over the live one.
4. **Find the cause:** `scripts/find-breaking-commit.sh <last good tag>`; function logs in Firebase console → Functions → Logs.
5. **Fix** in a pull request labelled `reliability`, add a test that would have caught it, and note it in CHANGELOG.md.
