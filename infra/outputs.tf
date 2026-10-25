output "github_variables" {
  description = "Repository variables for GitHub (Settings > Secrets and variables > Actions > Variables)."
  value = {
    GCP_WIF_PROVIDER = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOY_SA    = google_service_account.deployer.email
    GCP_SLO_SA       = google_service_account.slo_reader.email
    SLO_NAMES        = join(",", [google_monitoring_slo.site.name, google_monitoring_slo.form.name])
  }
}

output "dashboard_url" {
  value = "https://console.cloud.google.com/monitoring/dashboards/builder/${element(split("/", google_monitoring_dashboard.health.id), 3)}?project=${var.project_id}"
}
