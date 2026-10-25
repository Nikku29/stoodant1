# Infrastructure as code (DevOps level 4)

Everything in Google Cloud that used to be set up by clicking in the console, written down so it can be
reviewed in a pull request, rebuilt after a mistake, or copied to `stoodant-staging`.

| File | What it holds |
|---|---|
| `firestore.tf` | the database, point-in-time recovery, daily (14 d) and weekly (8 w) backups |
| `storage.tf` | the Storage bucket for study material and the role its rules need |
| `secrets.tf` | the three function secrets (names only, never values) |
| `github.tf` | keyless GitHub Actions access: the deployer and the read-only error budget account |
| `budget.tf` | ₹500 monthly budget with email alerts |
| `monitoring.tf` | email channel, uptime checks, "is down" and "backend error" alerts |
| `metrics.tf` | level 6: health dashboard and alerts against each metric's 7-day normal |
| `slo.tf` | level 7: 99.9% availability targets, error budgets and burn-rate alerts |

Not here on purpose: Firestore and Storage **rules**, indexes and the functions themselves. The Firebase CLI deploys
those from `firebase.json` (CI's Deploy workflow), and two tools owning the same thing would fight.

## First run (once, needs the owner's OK because it touches stoodant-prod)

```bash
gcloud auth login && gcloud auth application-default login
cd infra
scripts/bootstrap.sh                                   # state bucket gs://stoodant-prod-tfstate
BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX scripts/discover-imports.sh   # adopts the hand-made resources
terraform init
terraform plan -var billing_account_id=XXXXXX-XXXXXX-XXXXXX -out plan.tfplan
```

Read the plan before applying. Expected: imports, small in-place updates (names, descriptions), and only these
**new** things: the error budget reader account, the dashboard, five anomaly alerts, the SLO service with two
targets and four burn-rate alerts. Anything else marked "destroy" or "replace" means a mismatch: stop and fix the code.

```bash
terraform apply plan.tfplan
terraform output github_variables     # copy into GitHub repository variables
rm imports-discovered.tf              # adoption is done; state remembers it
```

## Every change after that

Edit the `.tf` files in a pull request. CI checks formatting and validity. After merge, run
`terraform plan` and `terraform apply` from `infra/`. Never change these resources in the console: the next apply
would undo it.

## Rebuilding or copying

`terraform apply -var project_id=stoodant-staging -var project_number=611248545277 -var site_host=stoodant-staging.web.app`
with a separate state prefix (`terraform init -backend-config=prefix=staging`) creates the same setup in staging.
