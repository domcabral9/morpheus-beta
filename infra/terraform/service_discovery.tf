# Web chama a API server-side (rota de proxy — ver comentário sobre API_URL
# em docker-compose.yml) usando o hostname interno do serviço, mesmo
# raciocínio do Compose ("http://api:3001"). Em ECS isso vira Cloud Map:
# api.morpheus.local resolve para o IP da task saudável mais recente, sem
# depender do ALB para tráfego leste-oeste dentro da VPC.
resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "${var.project_name}.local"
  vpc  = aws_vpc.main.id
}

resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}
