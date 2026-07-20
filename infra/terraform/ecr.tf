resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.project_name}-web"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Mesma política nas duas: mantém as últimas 10 imagens, descarta o resto —
# sem isso o ECR acumula indefinidamente uma imagem por build de CI.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy     = data.aws_ecr_lifecycle_policy_document.keep_last_10.json
}

resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name
  policy     = data.aws_ecr_lifecycle_policy_document.keep_last_10.json
}

data "aws_ecr_lifecycle_policy_document" "keep_last_10" {
  rule {
    priority    = 1
    description = "Mantém só as 10 imagens mais recentes"

    selection {
      tag_status   = "any"
      count_type   = "imageCountMoreThan"
      count_number = 10
    }

    action {
      type = "expire"
    }
  }
}
