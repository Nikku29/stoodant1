# Secret names only. Values are set with `firebase functions:secrets:set` and never live in Terraform or git.
locals {
  function_secrets = toset(["PHONE_HASH_PEPPER", "EMAIL_API_KEY", "WHATSAPP_TOKEN"])
}

resource "google_secret_manager_secret" "function" {
  for_each  = local.function_secrets
  secret_id = each.key
  replication {
    auto {}
  }
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels, annotations]
  }
}
