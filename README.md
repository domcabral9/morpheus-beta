# Morpheus

**Projeto educacional / portfólio.** Não é software em produção nem um produto comercial - foi
construído do zero, etapa por etapa, para praticar (e demonstrar) engenharia full-stack aplicada a
um problema real de segurança da informação, com os controles que um time de blueteam
normalmente cobra de qualquer sistema que lida com dados sensíveis: controle de acesso granular,
trilha de auditoria, hardening de API, observabilidade.

## O que o Morpheus faz

Centraliza o processo de avaliação de risco de novos softwares contratados/adotados por uma
empresa - uma forma de reduzir Shadow IT. Do questionário de risco à decisão final:

1. Questionário de risco (perguntas ponderadas, vinculadas a controles de compliance).
2. Matriz de decisão configurável (faixas de probabilidade × impacto → classificação de risco).
3. Workflow de aprovação com etapas e responsáveis configuráveis por tenant.
4. Parecer técnico em PDF, com QR Code de verificação.
5. Inventário de software homologado, com ciclo de revisão periódica.
6. Dashboards de postura de conformidade e placar de maturidade por área.

## Controles de segurança implementados

- **RBAC granular por permissão** (não só por papel), com decorators dedicados para composição
  AND/OR de permissões - `apps/api/src/common/decorators`, `common/guards`.
- **Autenticação**: JWT de acesso curto + refresh token via cookie httpOnly, SSO via SAML
  genérico/plugável (login local convive com SSO, nunca exclusivo).
- **Trilha de auditoria**: interceptor dedicado registra CREATE/UPDATE/DELETE/LOGIN/... com ator,
  entidade e IP, consultável em `/admin/audit-logs`.
- **CSRF via double-submit cookie**, sanitização global de entrada, rate limiting configurável por
  endpoint (`@nestjs/throttler`, limites mais estritos em rotas sensíveis).
- **Criptografia em repouso (AES-256-GCM)** para campos sensíveis via `CryptoService`.
- **Observabilidade**: logs estruturados, correlation ID, métricas Prometheus, tracing
  OpenTelemetry.
- **Multi-tenancy row-level**, isolamento por `tenantId` em toda query, banco único.

## Stack

| Camada          | Tecnologia                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Backend         | Node.js, TypeScript, NestJS 11                                          |
| Frontend        | Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui              |
| Banco de dados  | PostgreSQL 16, Prisma ORM 7                                              |
| Autenticação    | JWT + Refresh Token, SSO via SAML genérico/plugável                     |
| Observabilidade | Logs estruturados (pino), Correlation ID, métricas Prometheus, OpenTelemetry |
| Containerização | Docker, Docker Compose                                                   |
| IaC             | Terraform (deploy AWS documentado - nunca aplicado contra conta real)   |

## Rodando localmente

```bash
cp .env.example .env
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000 - API: http://localhost:3001 (Swagger em `/docs`)
- Login de teste: tenant `demo`, `admin@morpheus.demo`, senha `Demo@12345` (só existe porque o seed
  cria esse usuário - nunca use esse padrão para usuários reais).

Passo a passo completo (incluindo a stack via Docker) em
[`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md#como-rodar).

## Documentação técnica completa

- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) - histórico de decisões etapa a etapa, mantido de
  propósito como um diário de bordo técnico (não só uma lista de features prontas): trade-offs
  considerados, bugs reais encontrados e como foram corrigidos.
- [`docs/architecture.md`](./docs/architecture.md) - diagramas de modelo de dados e topologia de
  deploy.
- [`infra/terraform/README.md`](./infra/terraform/README.md) - estratégia de deploy em produção.

## Contato

[LinkedIn](https://www.linkedin.com/in/domcabral/) - domcabral@proton.me

---

# Morpheus (English)

**Educational / portfolio project.** Not production software or a commercial product - built from
scratch, stage by stage, to practice (and demonstrate) full-stack engineering applied to a real
information-security problem, with the controls a blue team typically expects from any system
handling sensitive data: granular access control, audit trail, API hardening, observability.

## What Morpheus does

Centralizes the risk-assessment process for new software purchased/adopted by a company - a way to
reduce Shadow IT. From risk questionnaire to final decision:

1. Risk questionnaire (weighted questions, linked to compliance controls).
2. Configurable decision matrix (probability × impact ranges → risk classification).
3. Approval workflow with configurable steps and responsible roles per tenant.
4. Technical opinion (PDF report), with a verification QR code.
5. Homologated software inventory, with periodic review cycle.
6. Compliance-posture dashboards and a maturity leaderboard by area.

## Implemented security controls

- **Granular, permission-level RBAC** (not just role-level), with dedicated decorators for AND/OR
  permission composition - `apps/api/src/common/decorators`, `common/guards`.
- **Authentication**: short-lived access JWT + refresh token via httpOnly cookie, SSO via generic/
  pluggable SAML (local login coexists with SSO, never exclusive).
- **Audit trail**: a dedicated interceptor logs CREATE/UPDATE/DELETE/LOGIN/... with actor, entity
  and IP, queryable at `/admin/audit-logs`.
- **CSRF via double-submit cookie**, global input sanitization, configurable rate limiting per
  endpoint (`@nestjs/throttler`, stricter limits on sensitive routes).
- **Encryption at rest (AES-256-GCM)** for sensitive fields via `CryptoService`.
- **Observability**: structured logs, correlation ID, Prometheus metrics, OpenTelemetry tracing.
- **Row-level multi-tenancy**, `tenantId` isolation on every query, single database.

## Stack

| Layer            | Technology                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| Backend          | Node.js, TypeScript, NestJS 11                                             |
| Frontend         | Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui                 |
| Database         | PostgreSQL 16, Prisma ORM 7                                                 |
| Authentication   | JWT + Refresh Token, generic/pluggable SAML SSO                            |
| Observability    | Structured logs (pino), Correlation ID, Prometheus metrics, OpenTelemetry   |
| Containerization | Docker, Docker Compose                                                     |
| IaC              | Terraform (AWS deploy documented - never applied against a real account)   |

## Running locally

```bash
cp .env.example .env
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000 - API: http://localhost:3001 (Swagger at `/docs`)
- Test login: tenant `demo`, `admin@morpheus.demo`, password `Demo@12345` (exists only because the
  seed creates this user - never use this pattern for real users).

Full walkthrough (including the Docker stack) in
[`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md#como-rodar) (Portuguese - the project's technical log
is written in Portuguese; happy to translate specific sections on request).

## Full technical documentation

- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) - stage-by-stage decision log, deliberately kept
  as a technical logbook (not just a feature list): trade-offs considered, real bugs found and how
  they were fixed.
- [`docs/architecture.md`](./docs/architecture.md) - data model and deployment topology diagrams.
- [`infra/terraform/README.md`](./infra/terraform/README.md) - production deployment strategy.

## Contact

[LinkedIn](https://www.linkedin.com/in/domcabral/) - domcabral@proton.me
