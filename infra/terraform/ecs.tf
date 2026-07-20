data "aws_caller_identity" "current" {}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API a partir do ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Web a partir do ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Web chama a API via Cloud Map dentro da própria VPC (não passa pelo ALB) —
  # sem esta regra, tasks da Web não conseguem alcançar tasks da API.
  ingress {
    description = "API a partir de qualquer task na VPC (chamada interna Web -> API)"
    from_port    = 3001
    to_port      = 3001
    protocol     = "tcp"
    cidr_blocks  = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-ecs-tasks-sg" }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}-${var.environment}/api"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${var.project_name}-${var.environment}/web"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/ecs/${var.project_name}-${var.environment}/migrate"
  retention_in_days = var.log_retention_days
}

# --- IAM ---------------------------------------------------------------------
# Execution role: usada pelo agente do ECS para *iniciar* a task (puxar
# imagem do ECR, buscar secrets do Secrets Manager, escrever nos logs).
# Diferente da task role (abaixo), que é o que o *código da aplicação*
# assume em runtime — a API hoje não chama nenhuma API da AWS diretamente
# (Prisma fala TCP puro com o RDS, não via SDK), então a task role fica
# praticamente vazia, mas existe separada por padrão de segurança: nunca dar
# ao código da aplicação as mesmas permissões amplas da execution role.
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project_name}-${var.environment}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "read-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.jwt_access_secret.arn,
        aws_secretsmanager_secret.jwt_refresh_secret.arn,
        aws_secretsmanager_secret.encryption_key.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# --- Task definitions ----------------------------------------------------
locals {
  api_image = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
  web_image = "${aws_ecr_repository.web.repository_url}:${var.web_image_tag}"

  api_secrets = [
    { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
    { name = "JWT_ACCESS_SECRET", valueFrom = aws_secretsmanager_secret.jwt_access_secret.arn },
    { name = "JWT_REFRESH_SECRET", valueFrom = aws_secretsmanager_secret.jwt_refresh_secret.arn },
    { name = "ENCRYPTION_KEY", valueFrom = aws_secretsmanager_secret.encryption_key.arn },
  ]

  api_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "API_PORT", value = "3001" },
    { name = "CORS_ORIGIN", value = var.cors_origin },
    { name = "PUBLIC_API_URL", value = var.public_api_url },
    { name = "STORAGE_DIR", value = "/app/storage" },
  ]
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  volume {
    name = "storage"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.storage.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.storage.id
        iam             = "ENABLED"
      }
    }
  }

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.api_image
      essential = true
      portMappings = [{ containerPort = 3001, protocol = "tcp" }]
      environment  = local.api_environment
      secrets      = local.api_secrets
      mountPoints = [{ sourceVolume = "storage", containerPath = "/app/storage" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://localhost:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 15
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project_name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = local.web_image
      essential = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        # Cloud Map, não o ALB — tráfego leste-oeste dentro da VPC (ver
        # service_discovery.tf), mesmo papel do hostname "api" no Compose.
        { name = "API_URL", value = "http://api.${var.project_name}.local:3001" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }
    }
  ])
}

# Task de migrate: definida como task definition avulsa, não como serviço —
# roda sob demanda via `aws ecs run-task` no pipeline de deploy, antes de
# atualizar os serviços da API/Web (mesma ordem do serviço `migrate` no
# docker-compose.yml, só que orquestrada pelo CI/CD em vez do Compose).
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.project_name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = local.api_image
      essential = true
      command = [
        "packages/database/node_modules/.bin/prisma",
        "migrate",
        "deploy",
        "--schema",
        "packages/database/prisma/schema.prisma",
        "--config",
        "packages/database/prisma.config.ts",
      ]
      secrets = [{ name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.migrate.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "migrate"
        }
      }
    }
  ])
}

# --- Serviços --------------------------------------------------------------
resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name    = "api"
    container_port    = 3001
  }

  service_registries {
    registry_arn = aws_service_discovery_service.api.arn
  }

  # Espera o listener rule existir antes de tentar registrar targets nele.
  depends_on = [aws_lb_listener_rule.api]
}

resource "aws_ecs_service" "web" {
  name            = "${var.project_name}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name    = "web"
    container_port    = 3000
  }

  depends_on = [aws_lb_listener.http]
}
