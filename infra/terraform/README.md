# Infraestrutura AWS (Terraform)

> **Este código nunca foi aplicado contra uma conta AWS real.** Foi escrito e revisado
> manualmente (sem `terraform` instalado neste ambiente para rodar `validate`/`plan`/`apply`), não
> testado de ponta a ponta. Trate como um ponto de partida sólido, não como infraestrutura
> validada em produção - rode `terraform validate` e `terraform plan` com atenção antes do primeiro
> `apply` real, revise os `default` de cada variável em [`variables.tf`](./variables.tf) (em
> especial `db_instance_class`, `db_multi_az` e os domínios) para o seu caso de uso, e considere
> pedir uma revisão de segurança antes de expor isto à internet.

## O que isto provisiona

ECS Fargate rodando os mesmos dois containers do `docker-compose.yml` de produção (`api`, `web`),
atrás de um Application Load Balancer, com Postgres migrando do container de dev para um RDS
gerenciado. Reflete o roteiro descrito no `README.md` da raiz do projeto (Etapa 16):

- **Rede**: VPC dedicada, subnets públicas (ALB) e privadas (ECS, RDS, EFS) em 2 AZs, um NAT
  Gateway para saída à internet das subnets privadas.
- **ECR**: um repositório por imagem (`api`, `web`), scan automático no push, lifecycle policy
  mantendo só as 10 imagens mais recentes.
- **RDS**: Postgres gerenciado (backups automáticos, patching pela AWS) - substitui o container
  `postgres` do Compose.
- **Secrets Manager**: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e
  `ENCRYPTION_KEY` gerados aleatoriamente pelo próprio Terraform (`random_password`/`random_id`) e
  injetados nas tasks via `secrets` (nunca `environment`) - nada disso fica em texto plano no
  `.env` como em dev.
- **EFS**: volume de rede compartilhado entre as tasks da API, montado em `/app/storage` - o
  `StorageAdapter` (Etapa 7) continua gravando em disco local sem nenhuma mudança de código; EFS
  só resolve o problema de disco de container Fargate ser efêmero e não-compartilhado. Migrar para
  um `S3StorageAdapter` de verdade é o próximo passo natural (ver "Limitações conhecidas" abaixo),
  não implementado aqui porque esta etapa é só a camada de infraestrutura.
- **Cloud Map**: `api.morpheus.local` - a Web chama a API internamente por esse nome (mesmo papel
  do hostname `api` na rede do Compose), sem depender do ALB para tráfego dentro da VPC.
- **ECS/Fargate**: cluster, task definitions e serviços para `api`/`web`, IAM com execution role
  (puxa imagem, lê secrets, escreve logs) separada da task role (o que o código da aplicação
  assume em runtime - hoje praticamente vazia, já que o Prisma fala TCP puro com o RDS, não usa o
  SDK da AWS).
- **Task de migrate**: `aws_ecs_task_definition.migrate` é uma task definition avulsa, não um
  serviço - reflete exatamente o comportamento do serviço `migrate` do `docker-compose.yml` (roda
  `prisma migrate deploy` e termina), mas disparada pelo pipeline de deploy via `aws ecs run-task`
  em vez de orquestrada pelo Compose. Comando de referência pronto no output
  `migrate_run_task_command`.
- **ALB**: roteamento por **host header** (`api_domain_name` vs. `web_domain_name`), não por path -
  a API não tem prefixo de rota (`/auth`, `/assessments`, `/questionnaire`... todos top-level),
  então path-based exigiria listar/manter toda rota nova de cada módulo no Terraform.

## Limitações conhecidas (leia antes de aplicar)

- **HTTPS não configurado**: o listener do ALB é só HTTP (porta 80). Adicionar HTTPS exige um
  certificado ACM validado para os domínios reais (`api_domain_name`/`web_domain_name`) - deixado
  comentado em [`alb.tf`](./alb.tf) porque não dá para provisionar um certificado sem um domínio de
  verdade.
- **Storage em EFS, não S3**: funciona (ver acima), mas um `S3StorageAdapter` seria mais barato e
  mais alinhado ao padrão serverless do resto da stack. `StorageAdapter` (Etapa 7) já foi desenhado
  para essa troca ser só uma nova implementação da interface, sem tocar em quem a consome.
- **Sem infraestrutura de CI/CD**: build/push de imagem para o ECR, `aws ecs run-task` da
  migration, e `aws ecs update-service --force-new-deployment` para os serviços ficam fora deste
  módulo - é responsabilidade do pipeline (GitHub Actions, CodePipeline, etc.), não do Terraform.
- **Estado local por padrão**: o backend S3 + DynamoDB lock table está comentado em
  [`versions.tf`](./versions.tf). Backend local é inaceitável em qualquer cenário com mais de uma
  pessoa aplicando mudanças - configure um backend remoto antes de usar isto de verdade.
- **`skip_final_snapshot = true`** no RDS ([`rds.tf`](./rds.tf)) - apaga o banco sem snapshot final
  num `terraform destroy`. Deliberado para não travar destruir um ambiente de teste, mas é o
  contrário do que se quer em produção real (reveja antes de aplicar).

## Pré-requisitos

- Terraform >= 1.7
- Credenciais AWS configuradas (`aws configure` ou variáveis `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`)
- Um domínio (ou dois subdomínios) que você controle, para `api_domain_name`/`web_domain_name`
- Imagens já publicadas nos repositórios ECR (rode `terraform apply` uma primeira vez para criar os
  repositórios antes de conseguir publicar; os serviços ECS só sobem de verdade depois de existir
  ao menos uma imagem com a tag esperada em cada repositório)

## Como usar

```bash
cp terraform.tfvars.example terraform.tfvars
# edite terraform.tfvars com seus domínios e preferências

terraform init
terraform validate
terraform plan
terraform apply
```

Depois do primeiro `apply` (que cria os repositórios ECR vazios):

```bash
# build e push das imagens (a partir da raiz do monorepo)
aws ecr get-login-password --region <região> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<região>.amazonaws.com

docker build -f apps/api/Dockerfile -t <api-repo-url>:latest .
docker push <api-repo-url>:latest

docker build -f apps/web/Dockerfile -t <web-repo-url>:latest .
docker push <web-repo-url>:latest

# roda a migration como task avulsa (comando pronto no output do Terraform)
terraform output -raw migrate_run_task_command | bash

# força os serviços a pegarem a imagem recém-publicada
aws ecs update-service --cluster <cluster> --service morpheus-api --force-new-deployment
aws ecs update-service --cluster <cluster> --service morpheus-web --force-new-deployment
```

Aponte `api_domain_name`/`web_domain_name` (CNAME ou ALIAS) para `terraform output alb_dns_name`.
