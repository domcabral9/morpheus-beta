# Morpheus

Plataforma de homologação e avaliação de risco de software, usada pela equipe de Segurança da
Informação para reduzir Shadow IT: centraliza o processo de avaliação de risco de novos sistemas
contratados pela empresa, do questionário ao parecer técnico em PDF.

> **Status:** Roteiro original completo (Etapas 1-16). O sistema roda de ponta a ponta - do
> questionário de risco ao parecer técnico em PDF, com RBAC, workflow de aprovação configurável,
> auditoria, observabilidade e hardening de segurança - e agora tem um teste e2e cobrindo o
> caminho crítico inteiro e uma estratégia de deploy em produção documentada e versionada em
> Terraform (nunca aplicada contra uma conta AWS real - ver aviso em
> [`infra/terraform/README.md`](./infra/terraform/README.md)). Diagramas de arquitetura (modelo de
> dados + topologia de deploy) em [`docs/architecture.md`](./docs/architecture.md). Daqui em diante,
> qualquer trabalho novo é iteração sobre uma base já fechada, não mais uma etapa numerada do
> roteiro original.

Este arquivo é referência (stack, estrutura, como rodar) e fica enxuto de propósito. O histórico
narrativo — decisões etapa por etapa, PRs, bugs encontrados e corrigidos, gotchas — vive em
[`docs/CHANGELOG.md`](./CHANGELOG.md).

## Stack

| Camada          | Tecnologia                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Backend         | Node.js, TypeScript, NestJS 11                                          |
| Frontend        | Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui              |
| Banco de dados  | PostgreSQL 16, Prisma ORM 7                                              |
| Autenticação    | JWT + Refresh Token, SSO via SAML genérico/plugável (a partir da Etapa 3) |
| Observabilidade | Logs estruturados (pino), Correlation ID, métricas Prometheus            |
| Containerização | Docker, Docker Compose                                                   |
| Documentação    | Swagger/OpenAPI                                                          |

## Estrutura do monorepo

```
morpheus-beta/
├── apps/
│   ├── api/                 # NestJS - API REST
│   └── web/                 # Next.js - frontend
├── packages/
│   ├── database/            # Prisma schema, client e migrations
│   └── config/              # tsconfig base compartilhado
├── docker-compose.yml        # stack completa (Postgres + API + Web) em produção-like
├── docker-compose.dev.yml    # apenas Postgres, para desenvolvimento local com hot-reload
└── turbo.json                 # orquestração de build/lint/test via Turborepo
```

Gerenciado como workspace pnpm + Turborepo: cada `apps/*` e `packages/*` é um pacote independente,
com dependências internas resolvidas via `workspace:*` (ex.: a API consome `@morpheus/database`).

## Pré-requisitos

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable` ou instalação standalone)
- Docker + Docker Compose (para subir Postgres e/ou a stack completa em containers)

## Como rodar

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Ajuste os valores se necessário (portas, credenciais do Postgres, etc.). Os valores padrão já
funcionam para desenvolvimento local.

### 2. Desenvolvimento local (hot-reload)

Sobe apenas o Postgres em container; API e Web rodam nativamente com hot-reload.

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate      # aplica as migrations no Postgres local
pnpm db:seed         # popula tenant/RBAC/questionário/matriz de risco demo
pnpm dev             # roda apps/api e apps/web em paralelo via Turborepo
```

- API: http://localhost:3001 (Swagger em `/docs`, health checks em `/health/live` e `/health/ready`, métricas em `/metrics`)
- Web: http://localhost:3000
- Login de teste (`POST /auth/login`, corpo `{ tenantSlug, email, password }`):
  `tenantSlug: "demo"`, `admin@morpheus.demo` ou `usuario@morpheus.demo`, senha `Demo@12345`
  (só existe porque o seed cria esses dois usuários - nunca use esse padrão para usuários reais).

### 3. Stack completa via Docker

Sobe Postgres, aplica migrations automaticamente e builda as imagens de produção da API e da Web.

```bash
docker compose up --build
```

> As imagens usam `turbo prune` para builds enxutos e multi-stage. Validado de ponta a ponta com
> Docker Desktop real (`docker compose up --build`): Postgres sobe saudável, o serviço `migrate`
> aplica as migrations via `prisma migrate deploy` e sai com sucesso, `api` fica `healthy` com
> `/health/ready` respondendo 200 contra o Postgres do container, e `web` serve a home (SSR,
> redirecionamento de locale `/` → `/pt-BR`) com `/api/health` proxeando de verdade para o serviço
> `api` pela rede interna do Compose.
>
> Dois bugs reais foram encontrados e corrigidos nessa validação (guarde isso se for mexer no
> Docker depois):
> 1. O binário do `prisma` fica em `packages/database/node_modules/.bin` (é devDependency desse
>    pacote, não da raiz) - o `command:` do serviço `migrate` precisa apontar para lá, com
>    `--config packages/database/prisma.config.ts` explícito.
> 2. O `.env` da raiz (usado no `pnpm dev` local) também é lido automaticamente pelo Docker Compose
>    para interpolar `${VAR}` no `docker-compose.yml` - isso sobrescrevia `DATABASE_URL`/
>    `NEXT_PUBLIC_API_URL` com valores de `localhost`, quebrando a resolução de nome entre
>    containers. A correção: `DATABASE_URL` é montado com o hostname fixo `postgres` (nunca
>    interpolado do `.env`), e a Web usa uma variável **sem** prefixo `NEXT_PUBLIC_` (`API_URL`)
>    para o proxy server-side - porque o Next.js faz *inline* de qualquer `NEXT_PUBLIC_*` em tempo
>    de build, mesmo em código que só roda no servidor, então um valor prefixado ficaria congelado
>    com o padrão usado no build da imagem e nunca refletiria a rede Docker em runtime.

### Scripts úteis (raiz do monorepo)

| Comando                 | O que faz                                              |
| ------------------------ | ------------------------------------------------------- |
| `pnpm dev`                | Roda API e Web em modo desenvolvimento (Turborepo)        |
| `pnpm build`              | Builda todos os pacotes/apps                              |
| `pnpm lint`               | Lint em todos os pacotes/apps                              |
| `pnpm test`               | Testes em todos os pacotes/apps                            |
| `pnpm typecheck`          | Checagem de tipos em todos os pacotes/apps                 |
| `pnpm db:generate`        | Gera o Prisma Client                                       |
| `pnpm db:migrate`         | Cria/aplica uma migration em desenvolvimento               |
| `pnpm db:seed`            | Roda o seed do banco                                       |

### Testes e2e (Etapa 16)

Diferente de `pnpm test` (unitário, tudo mockado), o teste e2e roda contra um Postgres real com o
seed aplicado - precisa do ambiente de desenvolvimento local já de pé (passos 1-2 acima, com
`pnpm db:seed` executado ao menos uma vez).

```bash
pnpm --filter @morpheus/api test:e2e
```

## CI e proteção do `main`

Todo PR (e todo push em `main`) roda `.github/workflows/ci.yml`: `pnpm turbo run typecheck` /
`lint` / `test` (unitário, sem Postgres) / `build`, Node 22. `main` tem branch protection exigindo
esse check (`validate`) verde antes de mesclar, inclusive para o dono do repositório
(`enforce_admins: true`) - sem exigência de aprovação formal de PR (não há um segundo revisor
humano fixo neste projeto; a confirmação de merge é verbal).

Dependabot está ativo (alerts + correções de segurança automáticas + atualizações de versão
semanais via `.github/dependabot.yml`). Prática combinada: PRs de segurança do Dependabot não são
mesclados assim que aparecem, entram numa janela de revisão semanal - exceto severidade `critical`
com exploit publicamente conhecido, tratada imediatamente. Processo completo (camadas de risco,
onde fica o histórico de cada janela) em [`docs/security.md`](./security.md); detalhe de como isso
foi montado (incluindo dois bugs reais que a primeira execução do CI pegou) no
[`CHANGELOG.md`](./CHANGELOG.md).
