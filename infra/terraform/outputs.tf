output "alb_dns_name" {
  description = "DNS do ALB — aponte api_domain_name e web_domain_name para cá (CNAME/ALIAS)."
  value       = aws_lb.main.dns_name
}

output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  value = aws_ecr_repository.web.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "rds_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}

output "migrate_task_definition_arn" {
  description = "Use com `aws ecs run-task` no pipeline de deploy, antes de atualizar os serviços da API/Web."
  value       = aws_ecs_task_definition.migrate.arn
}

output "migrate_run_task_command" {
  description = "Comando de referência para disparar a migration como task avulsa (ajuste subnets/security group se mudar a rede)."
  value = format(
    "aws ecs run-task --cluster %s --task-definition %s --launch-type FARGATE --network-configuration \"awsvpcConfiguration={subnets=[%s],securityGroups=[%s],assignPublicIp=DISABLED}\" --region %s",
    aws_ecs_cluster.main.name,
    aws_ecs_task_definition.migrate.family,
    join(",", aws_subnet.private[*].id),
    aws_security_group.ecs_tasks.id,
    var.aws_region,
  )
}
