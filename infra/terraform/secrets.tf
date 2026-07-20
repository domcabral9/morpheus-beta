resource "random_password" "db_password" {
  length  = 32
  special = false # RDS master password não aceita todos os caracteres especiais
}

resource "random_password" "jwt_access_secret" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = false
}

# ENCRYPTION_KEY precisa ser exatamente 32 bytes em base64 (validado em
# env.validation.ts) — random_id com byte_length=32 gera isso diretamente
# via .b64_std, diferente de random_password (baseado em caracteres, não
# bytes brutos).
resource "random_id" "encryption_key" {
  byte_length = 32
}

# Um secret por variável (em vez de um JSON único com todas) — cada task
# definition injeta só o que precisa via `secrets` (não `environment`), e
# rotacionar uma chave não obriga reimplantar quem não a usa.
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project_name}/${var.environment}/db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_secretsmanager_secret" "database_url" {
  name = "${var.project_name}/${var.environment}/database-url"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s/%s?schema=public",
    var.db_username,
    random_password.db_password.result,
    aws_db_instance.main.endpoint,
    var.db_name,
  )
}

resource "aws_secretsmanager_secret" "jwt_access_secret" {
  name = "${var.project_name}/${var.environment}/jwt-access-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_access_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_access_secret.id
  secret_string = random_password.jwt_access_secret.result
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name = "${var.project_name}/${var.environment}/jwt-refresh-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = random_password.jwt_refresh_secret.result
}

resource "aws_secretsmanager_secret" "encryption_key" {
  name = "${var.project_name}/${var.environment}/encryption-key"
}

resource "aws_secretsmanager_secret_version" "encryption_key" {
  secret_id     = aws_secretsmanager_secret.encryption_key.id
  secret_string = random_id.encryption_key.b64_std
}
