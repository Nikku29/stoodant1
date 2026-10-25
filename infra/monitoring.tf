# Uptime checks and outage alerts that were first set up by hand on 2026-10-20 (DEPLOY.md step 8).
resource "google_monitoring_notification_channel" "email" {
  display_name = "Stoodant team email"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

# The home page must answer 200 with the hero text.
resource "google_monitoring_uptime_check_config" "site" {
  display_name = "Site home page"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = "/"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    accepted_response_status_codes {
      status_value = 200
    }
  }

  content_matchers {
    content = "Learning that moves"
    matcher = "CONTAINS_STRING"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.site_host
    }
  }
}

# The demo form backend must be up and refuse a request with no allowed origin (403), which proves the
# function runs its checks. A 5xx or timeout means parents can't book a demo.
resource "google_monitoring_uptime_check_config" "form" {
  display_name = "Demo form backend"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path                = "/submitLead"
    port                = 443
    use_ssl             = true
    validate_ssl        = true
    request_method      = "POST"
    content_type        = "USER_PROVIDED"
    custom_content_type = "application/json"
    body                = base64encode("{}")
    accepted_response_status_codes {
      status_value = 403
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
  display_name = "${each.value.display_name} is down"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failing from more than one region"
    condition_threshold {
      filter     = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${each.value.uptime_check_id}\""
      comparison = "COMPARISON_GT"
      # More than one failing region for 5 minutes, so a single flaky checker doesn't page anyone.
      threshold_value = 1
      duration        = "300s"
      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id", "resource.label.host"]
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

# Any ERROR log line from a function (Error Reporting also groups these).
resource "google_monitoring_alert_policy" "function_errors" {
  display_name = "Backend error logged"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Functions logged an error"
    condition_matched_log {
      filter = "resource.type=\"cloud_run_revision\" AND severity>=ERROR"
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
    auto_close = "1800s"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}
