variable "aws_region" {
  description = "Região AWS onde a stack é provisionada."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Nome do ambiente (produção, staging...) — usado em tags e nomes de recursos."
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Prefixo usado no nome de todos os recursos."
  type        = string
  default     = "morpheus"
}

# --- Rede -----------------------------------------------------------------
variable "vpc_cidr" {
  description = "CIDR block da VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zone_count" {
  description = "Quantas AZs usar (subnets públicas e privadas espelhadas em cada uma)."
  type        = number
  default     = 2
}

# --- Banco de dados (RDS) ---------------------------------------------------
variable "db_name" {
  description = "Nome do banco Postgres."
  type        = string
  default     = "morpheus"
}

variable "db_username" {
  description = "Usuário administrador do RDS."
  type        = string
  default     = "morpheus"
}

variable "db_instance_class" {
  description = "Classe da instância RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  description = "Armazenamento inicial do RDS, em GB."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "Versão do Postgres no RDS — mesma major usada em dev (docker-compose usa postgres:16-alpine)."
  type        = string
  default     = "16.4"
}

variable "db_multi_az" {
  description = "Se o RDS deve rodar em múltiplas AZs (recomendado em produção real, mais caro)."
  type        = bool
  default     = false
}

# --- Imagens (ECR) -----------------------------------------------------------
variable "api_image_tag" {
  description = "Tag da imagem da API no ECR a ser implantada."
  type        = string
  default     = "latest"
}

variable "web_image_tag" {
  description = "Tag da imagem da Web no ECR a ser implantada."
  type        = string
  default     = "latest"
}

# --- ECS/Fargate ---------------------------------------------------------
variable "api_cpu" {
  description = "CPU units (1024 = 1 vCPU) da task da API."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memória (MB) da task da API."
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Número de tasks da API rodando em paralelo."
  type        = number
  default     = 2
}

variable "web_cpu" {
  description = "CPU units (1024 = 1 vCPU) da task da Web."
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Memória (MB) da task da Web."
  type        = number
  default     = 512
}

variable "web_desired_count" {
  description = "Número de tasks da Web rodando em paralelo."
  type        = number
  default     = 2
}

# --- Aplicação ---------------------------------------------------------------
variable "api_domain_name" {
  description = "Host usado para rotear tráfego do ALB para a API (registre um CNAME/ALIAS apontando para o DNS do ALB)."
  type        = string
  default     = "api.example.com"
}

variable "web_domain_name" {
  description = "Host usado para rotear tráfego do ALB para a Web (registre um CNAME/ALIAS apontando para o DNS do ALB)."
  type        = string
  default     = "app.example.com"
}

variable "cors_origin" {
  description = "Origem permitida pela API (domínio público da Web em produção)."
  type        = string
  default     = "https://app.example.com"
}

variable "public_api_url" {
  description = "URL pública da API — usada no link do QR Code do parecer técnico."
  type        = string
  default     = "https://api.example.com"
}

variable "log_retention_days" {
  description = "Retenção dos logs no CloudWatch."
  type        = number
  default     = 30
}
