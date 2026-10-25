# Default Firebase Storage bucket (study material). Rules are deployed by the Firebase CLI, not here.
resource "google_storage_bucket" "default" {
  name                        = "${var.project_id}.firebasestorage.app"
  location                    = upper(var.region)
  uniform_bucket_level_access = true

  lifecycle {
    prevent_destroy = true
    # Firebase manages CORS and labels on its default bucket.
    ignore_changes = [cors, labels]
  }
}

# Cross-service Storage rules read Firestore (batchAccess) through this role.
resource "google_project_iam_member" "storage_rules_reads_firestore" {
  project = var.project_id
  role    = "roles/firebaserules.firestoreServiceAgent"
  member  = "serviceAccount:service-${var.project_number}@gcp-sa-firebasestorage.iam.gserviceaccount.com"
}
