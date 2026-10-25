terraform {
  required_version = ">= 1.9"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.8"
    }
  }
  # State lives in a versioned bucket in the same project (created once by scripts/bootstrap.sh).
  backend "gcs" {
    bucket = "stoodant-prod-tfstate"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  # The budget API bills quota to the project instead of the caller.
  user_project_override = true
  billing_project       = var.project_id
}
