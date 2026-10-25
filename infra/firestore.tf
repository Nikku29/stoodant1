# Firestore database, point-in-time recovery and the two backup schedules (DEPLOY.md step 8).
resource "google_firestore_database" "default" {
  name                              = "(default)"
  location_id                       = var.region
  type                              = "FIRESTORE_NATIVE"
  point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_ENABLED"
  delete_protection_state           = "DELETE_PROTECTION_ENABLED"
  # Never delete the live database from Terraform, even if this block is removed.
  deletion_policy = "ABANDON"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_firestore_backup_schedule" "daily" {
  database  = google_firestore_database.default.name
  retention = "1209600s" # 14 days
  daily_recurrence {}
}

resource "google_firestore_backup_schedule" "weekly" {
  database  = google_firestore_database.default.name
  retention = "4838400s" # 8 weeks; the privacy page says deleted data can survive this long in backups
  weekly_recurrence {
    day = "SUNDAY"
  }
}
