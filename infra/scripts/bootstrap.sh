#!/usr/bin/env bash
# One-time: create the versioned bucket that holds Terraform state (a few KB; costs nothing noticeable).
set -euo pipefail
project="${1:-stoodant-prod}"
bucket="gs://${project}-tfstate"
gcloud storage buckets describe "$bucket" >/dev/null 2>&1 && { echo "$bucket already exists"; exit 0; }
gcloud storage buckets create "$bucket" --project "$project" --location asia-south1 \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "$bucket" --versioning
echo "Created $bucket"
