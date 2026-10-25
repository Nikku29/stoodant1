# Deploying Stoodant

How the site and backend go live on Firebase, how to roll back, and what to do when something breaks.
Plan and reasoning: BACKEND_PLAN.md. Nothing here deploys until step 6 switches it on.

## What runs where

| Piece | Where | Deployed by |
|---|---|---|
| Website (prerendered HTML + assets) | Firebase Hosting | CI |
| `submitLead` (demo form endpoint, `/api/lead`) | Cloud Functions, asia-south1 | CI |
| `onLeadCreated` (email + push + WhatsApp alert) | Cloud Functions, asia-south1 | CI |
| App for parents, teachers and the team (`console/`, app.stoodant.com) | Vercel, its own project | Vercel |
| Live classes (`scheduleClasses`, `changeClass`, `classReminders`), help (`askForHelp`, `onHelpRequested`) | Cloud Functions, asia-south1 | CI |
| Firestore rules, indexes, TTL policies | Firestore, asia-south1 | CI |
| Storage rules | Cloud Storage | CI |

Projects: `demo-stoodant` (local emulator only, no account), `stoodant-staging`, `stoodant-prod`.
If Firebase gives a project a suffix (e.g. `stoodant-prod-a1b2`), use the real ID everywhere below and in `.firebaserc`.

## Local development

```bash
bun install                     # root (installs only; everything runs on Node 22)
cd functions && npm ci
npm test                        # unit tests + rules and function tests in the emulator (needs Java 21)
npm run emulators               # Firestore, Storage, Auth, Functions on 127.0.0.1
# in another terminal, from the repo root:
VITE_LEAD_ENDPOINT=http://127.0.0.1:5001/demo-stoodant/asia-south1/submitLead npx vite dev
npx vite build && (cd functions && npm run e2e)   # Playwright against the Hosting emulator
```

## One-time setup (owner)

### 1. Projects and billing
1. Create a Google Cloud billing account (console.cloud.google.com/billing).
2. In console.firebase.google.com create `stoodant-staging` and `stoodant-prod`. Turn Google Analytics **off** (v10: no tracking of children).
3. Upgrade both to **Blaze**. In Billing → Budgets, add a ₹500 budget with alerts at 50%, 90% and 100% on each project.
4. In each project: Build → Firestore → Create database → **Standard edition**, location **asia-south1 (Mumbai)**, production mode. Build → Storage → Get started, same location.
5. Build → Authentication → Sign-in method → enable **Google** (only the owner signs in).

### 2. App Check (bot protection for the form)
1. In each project add a **Web app** (Project settings → Your apps). Note the API key, project ID and app ID; these are public.
2. In Google Cloud console → Security → reCAPTCHA, create a **website key** for `stoodant.com` (prod) or the staging domains (staging), with "Use checkbox" off.
3. Firebase console → App Check → register the web app with **reCAPTCHA Enterprise** and that key. Do **not** press "Enforce" for Firestore/Storage (the browser never uses them); the `submitLead` function enforces App Check itself.

### 3. Secrets (per project, Secret Manager)
```bash
firebase use staging            # then repeat for production
openssl rand -hex 32 | firebase functions:secrets:set PHONE_HASH_PEPPER --data-file=-
echo -n disabled | firebase functions:secrets:set EMAIL_API_KEY --data-file=-     # real key in step 5
echo -n disabled | firebase functions:secrets:set WHATSAPP_TOKEN --data-file=-    # real token in step 5
```
Never change `PHONE_HASH_PEPPER` after launch: dedupe would stop matching earlier leads.

### 4. Function settings (per project, not secret)
Create `functions/.env.<projectId>` (committed) with:
```
ALLOWED_ORIGINS=https://stoodant.com,https://www.stoodant.com          # prod
# ALLOWED_ORIGINS=https://stoodant-staging.web.app,https://stoodant-staging--*.web.app   # staging
OWNER_EMAIL_TO=info@stoodant.com
EMAIL_FROM=Stoodant <leads@stoodant.com>
OWNER_WHATSAPP_TO=+918306018141
WHATSAPP_PHONE_NUMBER_ID=
```
Defaults live in `functions/src/config.ts` (rate limits 5 per 10 min and 20 per day per address, 3 s minimum fill time, 90-day retention, App Check enforced).

### 5. Lead alerts
- **Email (Resend):** create an account, add the domain `stoodant.com`, put the SPF and DKIM records it shows into GoDaddy DNS, create an API key, then `firebase functions:secrets:set EMAIL_API_KEY`.
- **WhatsApp (Meta Cloud API):** Meta Business account → WhatsApp → add a phone number that is not on the WhatsApp app → create a **utility** template named `new_demo_request`, language English, body with four variables, e.g. `New demo request: {{1}}, Class {{2}}, {{3}}. Call {{4}}.` → once approved, create a permanent System User token with `whatsapp_business_messaging`, then `firebase functions:secrets:set WHATSAPP_TOKEN` and set `WHATSAPP_PHONE_NUMBER_ID` in step 4.
- **Push:** every phone where someone from the team is signed in to the app with notifications on gets demo requests and help requests. Nothing to set up beyond step 10.
- `OWNER_WHATSAPP_TO` takes several numbers, comma-separated (now Jitesh and Nikhil).
- A channel left as `disabled` is skipped; each lead and help request records `alerts.email` / `alerts.push` / `alerts.whatsapp` as `sent`, `failed` or `skipped`.

### 6. GitHub (CI and deploys)
Workload Identity Federation lets GitHub deploy without any stored key. For **each** project (replace `PROJECT`):
```bash
gcloud iam service-accounts create github-deployer --project PROJECT
for role in roles/firebase.admin roles/cloudfunctions.developer roles/run.admin roles/iam.serviceAccountUser \
            roles/secretmanager.viewer roles/datastore.indexAdmin roles/firebaserules.admin; do
  gcloud projects add-iam-policy-binding PROJECT --member "serviceAccount:github-deployer@PROJECT.iam.gserviceaccount.com" --role $role
done
gcloud iam workload-identity-pools create github --project PROJECT --location global
gcloud iam workload-identity-pools providers create-oidc github --project PROJECT --location global \
  --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition "assertion.repository == 'Nikku29/stoodant1'"
gcloud iam service-accounts add-iam-policy-binding github-deployer@PROJECT.iam.gserviceaccount.com --project PROJECT \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/Nikku29/stoodant1"
```
Then in GitHub → Settings → Environments create `preview`, `staging` and `production` (production: required reviewer = you, deployment branches = `main`). Add these **variables** to each environment (`preview` uses the staging values):

| Variable | Value |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SA` | `github-deployer@PROJECT.iam.gserviceaccount.com` |
| `FIREBASE_PROJECT_ID` | the project ID |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | from step 2.1 |
| `VITE_RECAPTCHA_SITE_KEY` | from step 2.2 |
| `SITE_URL` | `https://stoodant.com` (prod) or `https://stoodant-staging.web.app` |

Finally add the **repository** variable `DEPLOY_ENABLED` = `true`. Until then the deploy and preview jobs are skipped and every other check still runs. No GitHub **secrets** are needed.

Branch protection on `main`: require the CI checks, one review, no direct pushes.

### 7. Log-ins and admin access
Everyone signs in on **/login** (linked from the site header and footer):
- **Parents and teachers**: their mobile number and a 6-digit SMS code. The number decides the page: a teacher's number (on an
  active `teachers` record) opens /teacher, a parent's number (on a `students` record) opens /parent.
- **The Stoodant team**: "Continue with Google". The owners in `ADMIN_EMAILS` (functions/.env.<project>) and anyone added on
  /admin → Team access (a `team/{email}` document) get the admin claim through the `claimAdmin` function and land on /admin,
  where they manage demo requests, students, teachers, batches and the team list. Removing someone there clears their claim
  and signs them out everywhere (`onTeamRemoved`). Owners can't be removed from the page.

One-time Firebase console setup per project (Authentication):
- Sign-in method: enable **Phone** and **Google**. Under Settings → SMS region policy, allow only India.
- Settings → Authorized domains: add stoodant.com, www.stoodant.com and stoodant1.vercel.app.

Each SMS code is billed by Firebase on the Blaze plan; the Rs 500 budget alert covers it. `scripts/set-admin.mjs` still works
to grant the claim by hand. Previews without log-in: /parent?sample=1 and /teacher?sample=1.

For an enrolled family, clear `retainUntil` on the lead and its `consentLog` entries so the 90-day TTL does not delete them.

### 8. Backups, monitoring
```bash
gcloud firestore backups schedules create --project stoodant-prod --database '(default)' --recurrence daily --retention 14d
gcloud firestore backups schedules create --project stoodant-prod --database '(default)' --recurrence weekly --day-of-week SUN --retention 8w
gcloud firestore databases update --project stoodant-prod --database '(default)' --enable-pitr
```
Cloud Monitoring → Uptime checks: `https://stoodant.com/` (expect 200, every 5 min) and `https://stoodant.com/api/lead` with POST and empty body (expect 403). Alert to your email. Error Reporting picks up function errors automatically; turn on its email notifications.

### 9. Moving the domain from Vercel

Until this step is done, Vercel builds `main` using `vercel.json` (static build in `dist/client`). `/api/lead` exists only on Firebase Hosting, so the Vercel build gets these variables in Vercel → Project → Settings → Environment Variables (Production), and the demo form posts straight to the live function:

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | stoodant-prod web app (step 2.1) |
| `VITE_RECAPTCHA_SITE_KEY` | stoodant-prod site key (step 2.2) |
| `VITE_LEAD_ENDPOINT` | `https://asia-south1-stoodant-prod.cloudfunctions.net/submitLead` |

After the move, the Vercel project and its variables can be removed.
1. Let `main` deploy to staging and production; check `https://stoodant-prod.web.app`.
2. Firebase console → Hosting → Add custom domain `stoodant.com` and `www.stoodant.com` (redirect www → apex).
3. In GoDaddy DNS replace the Vercel A/CNAME records with the ones Firebase shows. Keep Vercel running until the Firebase certificate is issued (can take a few hours), then remove the domain from Vercel.

### 10. The app (app.stoodant.com)

The app is a separate build of the same repo (`console/`), on the same Firebase project and log-ins.

1. Vercel → Add New → Project → import the same GitHub repo, **Root Directory `console`** (the rest comes from `console/vercel.json`). Add the same five `VITE_FIREBASE_*` / `VITE_RECAPTCHA_SITE_KEY` variables as the website (step 9), plus `VITE_FIREBASE_VAPID_KEY` from Firebase console → Project settings → Cloud Messaging → Web Push certificates → Generate key pair (the long public key).
2. Vercel → that project → Domains → add `app.stoodant.com`; put the CNAME it shows into GoDaddy DNS.
3. Firebase console → Authentication → Settings → Authorized domains → add `app.stoodant.com`. Google Cloud → APIs & Services → Credentials → the browser API key → add `https://app.stoodant.com/*` to its website restrictions. Add `https://app.stoodant.com` to the reCAPTCHA key's domains.
4. Deploy rules, indexes and functions (`firebase deploy --only firestore,functions --project stoodant-prod`).
5. Once `https://app.stoodant.com/login` works: website's Vercel project → add `VITE_APP_URL=https://app.stoodant.com` and redeploy. Log in links on stoodant.com then open the app, and old `/login`, `/parent`, `/teacher`, `/admin` links move there too. Remove the variable to undo.

## Rollback

- **Site:** Firebase console → Hosting → Release history → "Roll back" on the previous release, or
  `firebase hosting:clone stoodant-prod:live@PREVIOUS_VERSION_ID stoodant-prod:live`.
- **Functions and rules:** re-run the Deploy workflow on the previous release tag (`vYYYY.MM.DD-N`) via "Run workflow", or revert the commit on `main`.
- **Data:** restore a backup into a **new** database (`gcloud firestore databases restore`), check it, then copy what is needed. Never restore over the live database blind.

## If personal data may have leaked (DPDP Act)

1. Contain: disable the affected function or rule (deploy a deny-all rule or roll back), rotate secrets (`PHONE_HASH_PEPPER` only if the hash itself is the problem).
2. Record what, when, how many people, and what was exposed. Logs carry lead ids, not names or numbers.
3. Within **72 hours**, notify the Data Protection Board of India and inform affected parents in plain language, as the DPDP Rules require. Get legal advice.
4. Fix, add a test that would have caught it, and write a short note in CHANGELOG.md.

## Deletion requests

A parent can ask for their data to be deleted at any time: find the lead by phone in Firestore (`parentPhoneE164`), delete the lead, its `notes`, its `consentLog` entries and the `leadDedupe` entry, and confirm to the parent once it is done. Ask a lawyer for the exact response deadline under the DPDP Rules.
