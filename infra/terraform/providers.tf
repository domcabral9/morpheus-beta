provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "morpheus"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
