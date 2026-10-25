# DevOps level 7: a 99.9% availability target over a rolling 30 days for the two things parents touch,
# the site and the demo form. 0.1% of 30 days is the error budget: about 43 minutes of downtime a month.
#
# Measured from the uptime checks in 5-minute windows: a window is good if the check passed from any region.
# That fits a low-traffic site, where a request-based ratio would swing wildly on a handful of requests.
# The budget is read by CI (.github/workflows/error-budget.yml): while budget is left, merges ship as usual;
# once it is used up, only pull requests labelled `reliability` can merge until the budget recovers.
resource "google_monitoring_custom_service" "stoodant" {
  service_id   = "stoodant"
  display_name = "Stoodant (site and demo form)"
}

resource "google_monitoring_slo" "site" {
  service             = google_monitoring_custom_service.stoodant.service_id
  slo_id              = "site-availability"
  display_name        = "Site available ${var.slo_goal * 100}% (30 days)"
  goal                = var.slo_goal
  rolling_period_days = 30

  windows_based_sli {
    window_period          = "300s"
    good_bad_metric_filter = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.site.uptime_check_id}\""
  }
}

resource "google_monitoring_slo" "form" {
  service             = google_monitoring_custom_service.stoodant.service_id
  slo_id              = "form-availability"
  display_name        = "Demo form available ${var.slo_goal * 100}% (30 days)"
  goal                = var.slo_goal
  rolling_period_days = 30

  windows_based_sli {
    window_period          = "300s"
    good_bad_metric_filter = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.form.uptime_check_id}\""
  }
}

locals {
  slos = {
    site = google_monitoring_slo.site
    form = google_monitoring_slo.form
  }
  # Standard multi-window burn rates for a 30-day budget:
  # fast = 2% of the month's budget gone in 1 hour, slow = 5% gone in 6 hours.
  burn_rates = {
    fast = { lookback = "3600s", threshold = 14.4, severity = "CRITICAL" }
    slow = { lookback = "21600s", threshold = 6, severity = "WARNING" }
  }
  burn_alerts = {
    for pair in setproduct(keys(local.slos), keys(local.burn_rates)) :
    "${pair[0]}-${pair[1]}" => { slo = local.slos[pair[0]], rate = local.burn_rates[pair[1]], speed = pair[1] }
  }
}

resource "google_monitoring_alert_policy" "burn_rate" {
  for_each     = local.burn_alerts
  display_name = "Error budget burning ${each.value.speed}: ${each.value.slo.display_name}"
  combiner     = "OR"
  severity     = each.value.rate.severity

  conditions {
    display_name = "Burn rate above ${each.value.rate.threshold}x over ${each.value.rate.lookback}"
    condition_threshold {
      filter          = "select_slo_burn_rate(\"${each.value.slo.name}\", \"${each.value.rate.lookback}\")"
      comparison      = "COMPARISON_GT"
      threshold_value = each.value.rate.threshold
      duration        = "0s"
    }
  }

  documentation {
    content   = "At this rate the monthly error budget runs out early. Fix first; if it runs out, CI blocks merges except pull requests labelled `reliability` (DEVOPS.md, level 7)."
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}
