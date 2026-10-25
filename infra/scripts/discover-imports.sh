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

# REST calls with the gcloud login (no beta/alpha components needed).
token="$(gcloud auth print-access-token)"
get() { curl -sfS -H "Authorization: Bearer $token" -H "x-goog-user-project: $project" "$1"; }
m="https://monitoring.googleapis.com/v3/projects/$project"
get "$m/notificationChannels" > "$tmp/channels.json"
get "$m/uptimeCheckConfigs" > "$tmp/uptime.json"
get "$m/alertPolicies" > "$tmp/policies.json"
get "https://firestore.googleapis.com/v1/projects/$project/databases/(default)/backupSchedules" > "$tmp/backups.json"
if [ -n "$billing" ]; then
  get "https://billingbudgets.googleapis.com/v1/billingAccounts/$billing/budgets" > "$tmp/budgets.json"
else
  echo "{}" > "$tmp/budgets.json"
fi

python3 - "$tmp" "$email" "$out" <<'PY'
import json, sys
tmp, email, out = sys.argv[1:4]
keys = {"channels": "notificationChannels", "uptime": "uptimeCheckConfigs", "policies": "alertPolicies", "backups": "backupSchedules", "budgets": "budgets"}
load = lambda n: json.load(open(f"{tmp}/{n}.json")).get(keys[n], [])
blocks = []
def imp(to, id_):
    blocks.append(f'import {{\n  to = {to}\n  id = "{id_}"\n}}\n')
    print(f"  {to:60} <- {id_}")

for c in load("channels"):
    if c.get("type") == "email" and c.get("labels", {}).get("email_address") == email:
        imp("google_monitoring_notification_channel.email", c["name"]); break

checks = {}
for u in load("uptime"):
    host = u.get("monitoredResource", {}).get("labels", {}).get("host", "")
    key = "form" if "cloudfunctions" in host else "site"
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
