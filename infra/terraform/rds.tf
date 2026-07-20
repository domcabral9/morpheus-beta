resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-rds-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres a partir das tasks ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
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

  tags = { Name = "${var.project_name}-rds-sg" }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-${var.environment}"
  engine         = "postgres"
  engine_version = var.db_engine_version

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  db_name               = var.db_name
  username              = var.db_username
  password              = random_password.db_password.result
  db_subnet_group_name  = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  multi_az               = var.db_multi_az

  # RDS gerenciado (vs. Postgres em container, usado em dev — ver
  # docker-compose.yml): backups automáticos, patching de SO/engine e
  # failover ficam por conta da AWS em vez de operados manualmente.
  backup_retention_period = 7
  backup_window            = "03:00-04:00"
  maintenance_window       = "mon:04:30-mon:05:30"

  # skip_final_snapshot=false seria o padrão mais seguro para produção real;
  # true aqui só para não travar `terraform destroy` num ambiente de
  # exemplo/teste. Reavaliar antes de usar isto contra uma conta de verdade.
  skip_final_snapshot = true
  deletion_protection  = false

  tags = { Name = "${var.project_name}-${var.environment}-db" }
}
