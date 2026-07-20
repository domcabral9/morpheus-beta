# StorageAdapter (Etapa 7) grava PDFs em disco local (STORAGE_DIR) — em
# Fargate, disco de container é efêmero e não é compartilhado entre tasks.
# EFS resolve isso sem tocar em código de aplicação: mesma interface
# StorageAdapter, mesmo caminho STORAGE_DIR, só que montado como um volume
# de rede compartilhado por todas as tasks da API. Migrar para um
# S3StorageAdapter de verdade fica documentado como próximo passo natural no
# README desta pasta — não implementado aqui, que é só a camada de infra.
resource "aws_efs_file_system" "storage" {
  creation_token = "${var.project_name}-storage"
  encrypted      = true

  tags = { Name = "${var.project_name}-storage" }
}

resource "aws_security_group" "efs" {
  name_prefix = "${var.project_name}-efs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "NFS a partir das tasks ECS"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-efs-sg" }
}

resource "aws_efs_mount_target" "storage" {
  count           = var.availability_zone_count
  file_system_id  = aws_efs_file_system.storage.id
  subnet_id       = aws_subnet.private[count.index].id
  security_groups = [aws_security_group.efs.id]
}

resource "aws_efs_access_point" "storage" {
  file_system_id = aws_efs_file_system.storage.id

  posix_user {
    uid = 1000 # mesmo usuário non-root do Dockerfile da API
    gid = 1000
  }

  root_directory {
    path = "/storage"
    creation_info {
      owner_uid   = 1000
      owner_gid   = 1000
      permissions = "755"
    }
  }
}
