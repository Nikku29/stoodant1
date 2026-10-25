# DevOps level 6: numbers the servers report, one dashboard, and alerts that fire when a number leaves its
# normal range. "Normal" is learned from the last 7 days of the same metric, so nothing needs re-tuning as
# traffic grows. Each alert also has a floor, so a quiet week with 3 requests can't make 10 look like a spike.
#
# Queries use PromQL over Cloud Monitoring's built-in metrics (no agent, no extra service).
locals {
  run    = "monitored_resource=\"cloud_run_revision\""
  window = "10m"

  # p95 response time per function, now vs its 7-day normal.
  p95_now  = "histogram_quantile(0.95, sum by (le, service_name) (rate(run_googleapis_com:request_latencies_bucket{${local.run}}[${local.window}])))"
  p95_base = "histogram_quantile(0.95, sum by (le, service_name) (rate(run_googleapis_com:request_latencies_bucket{${local.run}}[7d])))"

  # Share of requests answered with a 5xx.
  err_now  = "sum by (service_name) (rate(run_googleapis_com:request_count{${local.run},response_code_class=\"5xx\"}[${local.window}])) / sum by (service_name) (rate(run_googleapis_com:request_count{${local.run}}[${local.window}]))"
  err_base = "sum by (service_name) (rate(run_googleapis_com:request_count{${local.run},response_code_class=\"5xx\"}[7d])) / sum by (service_name) (rate(run_googleapis_com:request_count{${local.run}}[7d]))"

  # Requests per second (bots hammering the form, or a loop between triggers).
  rps_now  = "sum by (service_name) (rate(run_googleapis_com:request_count{${local.run}}[${local.window}]))"
  rps_base = "sum by (service_name) (rate(run_googleapis_com:request_count{${local.run}}[7d]))"

  # CPU per function (the usual "server CPU" signal; Cloud Run reports it per container).
  cpu_now  = "histogram_quantile(0.95, sum by (le, service_name) (rate(run_googleapis_com:container_cpu_utilizations_bucket{${local.run}}[${local.window}])))"
  cpu_base = "histogram_quantile(0.95, sum by (le, service_name) (rate(run_googleapis_com:container_cpu_utilizations_bucket{${local.run}}[7d])))"

  # Firestore document reads (the main thing that would push the bill up).
  reads_now  = "sum(rate(firestore_googleapis_com:document_read_count{monitored_resource=\"firestore_instance\"}[30m]))"
  reads_base = "sum(rate(firestore_googleapis_com:document_read_count{monitored_resource=\"firestore_instance\"}[7d]))"

  anomalies = {
    latency = {
      name  = "Functions slower than normal"
      query = "(${local.p95_now} > 2 * ${local.p95_base}) and (${local.p95_now} > 2000)"
      doc   = "p95 response time is more than twice its 7-day normal and above 2 s. Check recent deploys and the function logs."
    }
    errors = {
      name  = "Function error rate above normal"
      query = "(${local.err_now} > 3 * ${local.err_base}) and (${local.err_now} > 0.05)"
      doc   = "More than 5% of requests failed with 5xx, at least 3x the 7-day normal. Roll back the last deploy if it started after one."
    }
    traffic = {
      name  = "Traffic spike on functions"
      query = "(${local.rps_now} > 5 * ${local.rps_base}) and (${local.rps_now} > 0.2)"
      doc   = "Requests are 5x the 7-day normal. Usually bots on the demo form (App Check and rate limits should hold) or a trigger loop."
    }
    cpu = {
      name  = "Function CPU above normal"
      query = "(${local.cpu_now} > 2 * ${local.cpu_base}) and (${local.cpu_now} > 0.8)"
      doc   = "p95 CPU is twice its normal and above 80%. Look for a slow query or a loop in the function named in the alert."
    }
    reads = {
      name  = "Firestore reads above normal"
      query = "(${local.reads_now} > 5 * ${local.reads_base}) and (${local.reads_now} > 5)"
      doc   = "Document reads are 5x the 7-day normal. A page or trigger may be re-reading in a loop; this costs money."
    }
  }
}

resource "google_monitoring_alert_policy" "anomaly" {
  for_each     = local.anomalies
  display_name = each.value.name
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = each.value.name
    condition_prometheus_query_language {
      query = each.value.query
      # No retest window: the API forbids one with a 7-day lookback, and the 10-minute rate already smooths blips.
      duration            = "0s"
      evaluation_interval = "300s"
    }
  }

  alert_strategy {
    auto_close = "3600s"
  }

  documentation {
    content   = each.value.doc
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# One page with everything (zero positions are left out, as the API drops them and Terraform would see a change): uptime, functions, database and the error budget.
resource "google_monitoring_dashboard" "health" {
  dashboard_json = jsonencode({
    displayName = "Stoodant health"
    mosaicLayout = {
      columns = 12
      tiles = [
        { width = 4, height = 3, widget = {
          title = "Error budget left: site (30 days)"
          scorecard = {
            timeSeriesQuery = { timeSeriesFilter = { filter = "select_slo_budget_fraction(\"${google_monitoring_slo.site.name}\")" } }
            thresholds      = [{ value = 0.25, direction = "BELOW", color = "YELLOW" }, { value = 0.05, direction = "BELOW", color = "RED" }]
          }
        } },
        { xPos = 4, width = 4, height = 3, widget = {
          title = "Error budget left: demo form (30 days)"
          scorecard = {
            timeSeriesQuery = { timeSeriesFilter = { filter = "select_slo_budget_fraction(\"${google_monitoring_slo.form.name}\")" } }
            thresholds      = [{ value = 0.25, direction = "BELOW", color = "YELLOW" }, { value = 0.05, direction = "BELOW", color = "RED" }]
          }
        } },
        { xPos = 8, width = 4, height = 3, widget = {
          title        = "Open incidents"
          incidentList = {}
        } },
        { yPos = 3, width = 6, height = 4, widget = {
          title   = "Uptime check response time (ms)"
          xyChart = { dataSets = [{ targetAxis = "Y1", plotType = "LINE", timeSeriesQuery = { prometheusQuery = "avg by (check_id) (monitoring_googleapis_com:uptime_check_request_latency{monitored_resource=\"uptime_url\"})" } }] }
        } },
        { xPos = 6, yPos = 3, width = 6, height = 4, widget = {
          title   = "Requests per second by function and result"
          xyChart = { dataSets = [{ targetAxis = "Y1", plotType = "STACKED_AREA", timeSeriesQuery = { prometheusQuery = "sum by (service_name, response_code_class) (rate(run_googleapis_com:request_count{${local.run}}[5m]))" } }] }
        } },
        { yPos = 7, width = 6, height = 4, widget = {
          title = "p95 response time by function (ms), with 7-day normal"
          xyChart = { dataSets = [
            { targetAxis = "Y1", plotType = "LINE", legendTemplate = "now", timeSeriesQuery = { prometheusQuery = replace(local.p95_now, local.window, "5m") } },
            { targetAxis = "Y1", plotType = "LINE", legendTemplate = "7-day normal", timeSeriesQuery = { prometheusQuery = local.p95_base } },
          ] }
        } },
        { xPos = 6, yPos = 7, width = 6, height = 4, widget = {
          title = "p95 CPU by function, with 7-day normal"
          xyChart = { dataSets = [
            { targetAxis = "Y1", plotType = "LINE", legendTemplate = "now", timeSeriesQuery = { prometheusQuery = replace(local.cpu_now, local.window, "5m") } },
            { targetAxis = "Y1", plotType = "LINE", legendTemplate = "7-day normal", timeSeriesQuery = { prometheusQuery = local.cpu_base } },
          ] }
        } },
        { yPos = 11, width = 6, height = 4, widget = {
          title   = "Running instances by function"
          xyChart = { dataSets = [{ targetAxis = "Y1", plotType = "LINE", timeSeriesQuery = { prometheusQuery = "sum by (service_name) (run_googleapis_com:container_instance_count{${local.run}})" } }] }
        } },
        { xPos = 6, yPos = 11, width = 6, height = 4, widget = {
          title = "Firestore reads and writes per second"
          xyChart = { dataSets = [
            { targetAxis = "Y1", plotType = "LINE", legendTemplate = "reads", timeSeriesQuery = { prometheusQuery = "sum(rate(firestore_googleapis_com:document_read_count{monitored_resource=\"firestore_instance\"}[5m]))" } },
            { targetAxis = "Y1", plotType = "LINE", legendTemplate = "writes", timeSeriesQuery = { prometheusQuery = "sum(rate(firestore_googleapis_com:document_write_count{monitored_resource=\"firestore_instance\"}[5m]))" } },
          ] }
        } },
      ]
    }
  })
}
