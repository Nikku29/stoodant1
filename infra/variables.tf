variable "project_id" {
  type    = string
  default = "stoodant-prod"
}

variable "project_number" {
  type    = string
  default = "839354037071"
}

variable "region" {
  type    = string
  default = "asia-south1"
}

variable "alert_email" {
  description = "Where every alert goes."
  type        = string
  default     = "info@stoodant.com"
}

variable "site_host" {
  type    = string
  default = "stoodant.com"
}

variable "github_repo" {
  type    = string
  default = "Nikku29/stoodant1"
}

variable "billing_account_id" {
  description = "Billing account that pays for the project (Billing > Account management, e.g. 012345-6789AB-CDEF01). Empty skips the budget."
  type        = string
  default     = ""
}

variable "monthly_budget_inr" {
  type    = number
  default = 500
}

variable "slo_goal" {
  description = "Availability target over a rolling 30 days. 0.999 allows about 43 minutes of downtime a month."
  type        = number
  default     = 0.999
}
