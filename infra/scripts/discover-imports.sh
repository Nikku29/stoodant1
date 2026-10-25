#!/usr/bin/env bash
# Finds the hand-made resources with random IDs and writes import blocks for them to imports-discovered.tf,
# so the first `terraform plan` adopts them instead of creating duplicates. Safe to re-run; read-only on GCP.
# Anything it can't match is left out and shows up in the plan as "will be created": check those by hand.
set -euo pipefail
cd "$(dirname "$0")/.."
project="${PROJECT:-stoodant-prod}"
email="${ALERT_EMAIL:-info@stoodant.com}"
billing="${BILLING_ACCOUNT_ID:-}"
out=imports-discovered.tf
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

gcloud beta monitoring channels list --project "$project" --format=json > "$tmp/channels.json"
gcloud monitoring uptime list-configs --project "$project" --format=json > "$tmp/uptime.json"
gcloud beta monitoring policies list --project "$project" --format=json > "$tmp/policies.json"
gcloud firestore backups schedules list --project "$project" --database='(default)' --format=json > "$tmp/backups.json"
if [ -n "$billing" ]; then
  gcloud billing budgets list --billing-account "$billing" --format=json > "$tmp/budgets.json"
else
  echo "[]" > "$tmp/budgets.json"
fi

python3 - "$tmp" "$email" "$out" <<'PY'
import json, sys
tmp, email, out = sys.argv[1:4]
load = lambda n: json.load(open(f"{tmp}/{n}.json"))
blocks = []
def imp(to, id_):
    blocks.append(f'import {{\n  to = {to}\n  id = "{id_}"\n}}\n')
    print(f"  {to:60} <- {id_}")

for c in load("channels"):
    if c.get("type") == "email" and c.get("labels", {}).get("email_address") == email:
        imp("google_monitoring_notification_channel.email", c["name"]); break

checks = {}
for u in load("uptime"):
    method = u.get("httpCheck", {}).get("requestMethod", "GET")
    key = "form" if method == "POST" else "site"
    if key not in checks:
        checks[key] = u
        imp(f"google_monitoring_uptime_check_config.{key}", u["name"])

seen = set()
for p in load("policies"):
    text = json.dumps(p.get("conditions", []))
    for key, u in checks.items():
        check_id = u["name"].rsplit("/", 1)[1]
        if check_id in text and "uptime_check" in text and key not in seen:
            seen.add(key); imp(f'google_monitoring_alert_policy.down["{key}"]', p["name"])
    if "conditionMatchedLog" in text and "severity" in text and "errors" not in seen:
        seen.add("errors"); imp("google_monitoring_alert_policy.function_errors", p["name"])

for b in load("backups"):
    key = "weekly" if "weeklyRecurrence" in b else "daily"
    imp(f"google_firestore_backup_schedule.{key}", b["name"])

budgets = load("budgets")
if budgets:
    imp("google_billing_budget.monthly[0]", budgets[0]["name"])

open(out, "w").write("# Written by scripts/discover-imports.sh. Delete after the first apply.\n\n" + "\n".join(blocks))
print(f"Wrote {len(blocks)} import blocks to {out}")
PY
