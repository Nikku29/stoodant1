# Keyless GitHub Actions access (DEPLOY.md step 6): only workflows in this repository can use these accounts.
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }
  attribute_condition = "assertion.repository == '${var.github_repo}'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

locals {
  github_principal = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
  deployer_roles = toset([
    "roles/firebase.admin",
    "roles/cloudfunctions.developer",
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.viewer",
    "roles/datastore.indexAdmin",
    "roles/firebaserules.admin",
  ])
}

# Deploys hosting, functions and rules from the Deploy workflow (production waits for your approval in GitHub).
resource "google_service_account" "deployer" {
  account_id   = "github-deployer"
  display_name = "GitHub Actions deployer"
}

resource "google_project_iam_member" "deployer" {
  for_each = local.deployer_roles
  project  = var.project_id
  role     = each.key
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_principal
}

# Read-only account for the error budget check that runs on every pull request (level 7).
# Kept separate so pull request jobs never hold deploy rights.
resource "google_service_account" "slo_reader" {
  account_id   = "github-slo-reader"
  display_name = "GitHub Actions error budget reader"
}

resource "google_project_iam_member" "slo_reader" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.slo_reader.email}"
}

resource "google_service_account_iam_member" "slo_reader_wif" {
  service_account_id = google_service_account.slo_reader.name
  role               = "roles/iam.workloadIdentityUser"
  member             = local.github_principal
}
