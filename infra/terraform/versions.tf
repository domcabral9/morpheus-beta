terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Estado remoto fica a critério de quem for aplicar isto de verdade — um
  # backend S3 + DynamoDB lock table é o padrão razoável para produção, mas
  # exige recursos que precisam existir antes do `terraform init` (bootstrap
  # em duas etapas). Deixado como backend local por padrão de propósito.
  # backend "s3" {
  #   bucket         = "morpheus-terraform-state"
  #   key            = "morpheus/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "morpheus-terraform-locks"
  #   encrypt        = true
  # }
}
