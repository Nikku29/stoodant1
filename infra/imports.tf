# Adopt what already exists in stoodant-prod instead of creating it again. Resources whose IDs are random
# (uptime checks, alert policies, backup schedules, the email channel, the budget) are found by
# scripts/discover-imports.sh, which writes imports-discovered.tf before the first plan.
import {
  to = google_firestore_database.default
  id = "projects/${var.project_id}/databases/(default)"
}

import {
  to = google_storage_bucket.default
  id = "${var.project_id}.firebasestorage.app"
}

import {
  for_each = local.function_secrets
  to       = google_secret_manager_secret.function[each.key]
  id       = "projects/${var.project_id}/secrets/${each.key}"
}

import {
  to = google_iam_workload_identity_pool.github
  id = "projects/${var.project_id}/locations/global/workloadIdentityPools/github"
}

import {
  to = google_iam_workload_identity_pool_provider.github
  id = "projects/${var.project_id}/locations/global/workloadIdentityPools/github/providers/github"
}

import {
  to = google_service_account.deployer
  id = "projects/${var.project_id}/serviceAccounts/github-deployer@${var.project_id}.iam.gserviceaccount.com"
}
