# Uptime checks and outage alerts that were first set up by hand on 2026-10-20 (DEPLOY.md step 8).
resource "google_monitoring_notification_channel" "email" {
  display_name = "Stoodant owner email"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

# The home page must answer 2xx.
resource "google_monitoring_uptime_check_config" "site" {
  display_name = "Stoodant site"
  timeout      = "10s"
  period       = "300s"
  checker_type = "STATIC_IP_CHECKERS"

  http_check {
    path           = "/"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.site_host
    }
  }
}

# The demo form backend must be up and refuse a plain GET with a 4xx, which proves the function runs its
# checks. A 5xx or timeout means parents can't book a demo.
resource "google_monitoring_uptime_check_config" "form" {
  display_name = "Stoodant form backend"
  timeout      = "10s"
  period       = "300s"
  checker_type = "STATIC_IP_CHECKERS"

  http_check {
    path           = "/submitLead"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_4XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = "${var.region}-${var.project_id}.cloudfunctions.net"
    }
  }
}

locals {
  uptime_checks = {
    site = google_monitoring_uptime_check_config.site
    form = google_monitoring_uptime_check_config.form
  }
}

resource "google_monitoring_alert_policy" "down" {
  for_each     = local.uptime_checks
  display_name = { site = "Stoodant site is down", form = "Stoodant demo form backend is down" }[each.key]
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failing"
    condition_threshold {
      filter     = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${each.value.uptime_check_id}\" AND resource.type=\"uptime_url\""
      comparison = "COMPARISON_GT"
      # More than one failing region for 10 minutes, so a single flaky checker doesn't page anyone.
      threshold_value = 1
      duration        = "600s"
      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "Open RUNBOOK in DEVOPS.md: check Vercel and Firebase status, then roll back the last release if it started after a deploy."
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# Any ERROR log line from any function (Error Reporting also groups these). The hand-made version only
# watched submitLead and onLeadCreated; the login, admin and progress functions came later.
resource "google_monitoring_alert_policy" "function_errors" {
  display_name = "Stoodant backend errors"
  combiner     = "OR"

  conditions {
    display_name = "Error logged by a function"
    condition_matched_log {
      filter = "resource.type=\"cloud_run_revision\" AND severity>=ERROR"
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "3600s"
    }
    auto_close = "86400s"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}
