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
narrativo (decisões etapa por etapa, PRs, bugs encontrados e corrigidos, gotchas) vive em
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
>
> Validação da Camada 2 do Dependabot (bump `node:22-alpine` → `node:26-alpine`, 2026-07-28) achou
> mais dois problemas reais, independentes entre si:
> 3. A partir do Node 26, o `corepack` deixou de vir embutido na imagem - `RUN corepack enable`
>    passou a falhar com `corepack: not found` (exit 127) nos três Dockerfiles (`apps/api`,
>    `apps/web`, e o serviço `migrate`, que reusa o Dockerfile da API). Correção: instalar
>    explicitamente antes de habilitar - `RUN npm install -g corepack@latest && corepack enable`.
> 4. `docker-compose.yml` nunca passou `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`ENCRYPTION_KEY`
>    para o serviço `api` (bug pré-existente, sem relação com o bump do Node - só apareceu porque
>    essa era a primeira vez que a stack completa subia depois que esses três viraram obrigatórios
>    em `env.validation.ts`). Sem eles o container reiniciava em loop com "Configuração de ambiente
>    inválida". Corrigido adicionando os três (e os `_EXPIRES_IN` com default) ao bloco
>    `environment:` do serviço `api`, interpolados do `.env` como os demais.

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

## Problemas conhecidos do ambiente de desenvolvimento

### O dev server da API pode cair sozinho (`nest start --watch`)

Sintoma: a porta 3001 para de responder, ou o processo node desaparece do sistema sem nenhum erro
no terminal - às vezes some entre uma pausa e a retomada do trabalho, sem nenhum comando explícito
de shutdown. Causa raiz ainda não confirmada (hipóteses: processo em segundo plano encerrado quando
a máquina suspende, Docker Desktop reiniciando, o watch mode travando depois de muitos ciclos de
recompilação numa sessão longa) - o que segue é o procedimento de detecção/recuperação, não uma
correção da causa.

**Detecção**: antes de confiar em qualquer teste via curl/Playwright contra a API, confirmar que ela
está respondendo:

```bash
curl -s http://localhost:3001/health
```

Um segundo sintoma relacionado, mais sutil: o processo pode estar de pé mas servindo um build antigo
(`node dist/main.js` em vez do modo watch `nest start --watch`) - nesse caso a porta responde
normalmente, mas rotas de features recentes (mescladas depois que esse processo antigo subiu) dão
404 mesmo estando corretas no código. Antes de confiar num teste, checar o command-line real do
processo:

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select-Object CommandLine
```

`dist/main`/`next start` na saída = build parado no tempo, não código ao vivo.

**Recuperação**: matar o processo e reiniciar em modo watch.

```bash
pnpm --filter @morpheus/api dev
pnpm --filter @morpheus/web dev
```

### Cache do Turbopack pode servir 404 falso numa rota que existe de verdade

Sintoma: uma rota presente no disco (confirmável em `app-paths-manifest.json`) devolve 404 genuíno
do Next.js, geralmente logo depois de uma troca de branch com o `next dev` já rodando. Não é um bug
de código - é o cache `apps/web/.next` desatualizado/corrompido. Fix: `rm -rf apps/web/.next` e
reiniciar o dev server.

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

## Fluxo de PR

Ritmo padrão para qualquer mudança, de uma fase pequena a um arco completo de feature: branch →
implementar → validar (`lint`/`typecheck`/`test`/`build` do(s) pacote(s) tocado(s)) → `gh pr create`
→ **aguardar confirmação explícita de merge** (nunca mesclar proativamente, mesmo com CI verde) →
merge → sincronizar `main`. Reforça a seção de CI acima: a confirmação de merge é sempre verbal, não
existe segundo revisor humano fixo neste projeto.

**Ordem de merge quando várias PRs estão abertas ao mesmo tempo**: mesclar sempre a mais antiga
primeiro, na ordem em que foram abertas - nunca a mais nova só porque o CI dela terminou primeiro.
Isso importa de verdade quando fases sucessivas de um mesmo arco dependem do código já mesclado da
fase anterior estar em `main`.

**Não travar esperando o CI de uma PR terminar antes de começar a próxima fase** - iniciar o
branch/implementação da fase seguinte enquanto o CI da fase atual ainda roda é normal; só a ordem de
*merge* precisa respeitar a regra acima, não a ordem de *início* do trabalho.

**Não empilhar PRs quando dá pra evitar.** Uma PR empilhada (base = branch de outra PR ainda não
mesclada, não `main`) parece natural quando uma fase depende do código de outra ainda não mesclada,
mas o GitHub **não retargeta automaticamente** a PR dependente quando a branch base é apagada depois
que a PR de baixo mescla - ele fecha a PR de cima **sem mesclar**, e uma PR fechada não pode mais ser
reaberta nem ter a base trocada via API. Preferir branches independentes contra `main` por fase
sempre que a fase seguinte só precisa do código anterior pra ser *testada*, não pra ser *escrita*
(o que cobre a maioria dos casos - dá pra escrever o código de uma fase de frontend, por exemplo,
sabendo o formato de um endpoint que ainda não subiu). Se empilhar for realmente necessário,
**retargetar a base da PR de cima pra `main` enquanto ela ainda está aberta, antes de apagar a
branch base** - nunca depois.

## Dados de demonstração (tenant `demo`)

Ao criar/editar amostras no tenant `demo` (dados usados pra navegação manual e pros screenshots do
portfólio), seguir o checklist combinado em [`docs/demo-data-checklist.md`](./demo-data-checklist.md)
- cobertura de status, coerência entre `Inventory`/`Vendor`/`Assessment`, impacto real nos
dashboards (não só na tela de detalhe), e sempre via API real, nunca `seed.ts`/SQL direto.

## Labels e milestones de PR

Toda PR ganha uma label espelhando o prefixo de commit convencional usado no título
(`feat`→`enhancement`, `fix`→`bug`, `docs`→`documentation`, `chore`→`chore`, `style`→`style`,
`build`→`build`; PRs do Dependabot já chegam com `dependencies` + a label do ecossistema aplicadas
automaticamente) e é auto-atribuída ao autor. Milestones agrupam PRs por arco de feature entregue
(ex.: "Renovação anual de homologação", "Avaliação de risco de fornecedores") - aplicado
retroativamente às 85 PRs mescladas até 2026-07-31, 12 milestones no total. Reviewers formais não se
aplicam (ver seção de CI acima - confirmação de merge é verbal, sem segundo revisor humano fixo).
