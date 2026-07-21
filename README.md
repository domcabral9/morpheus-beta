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

## Decisões arquiteturais desta etapa

- **pnpm workspaces + Turborepo**: monorepo TypeScript com cache de build e pipelines de tarefas,
  facilita compartilhar tipos/DTOs entre API e Web nas próximas etapas.
- **Multi-tenancy row-level**: banco único, schema compartilhado, coluna `tenantId` nas tabelas com
  escopo de tenant (modelo `Tenant` já criado). Evita a explosão operacional de um banco/schema por
  cliente, mantendo isolamento lógico - a modelagem completa entra na Etapa 2.
- **SSO via SAML genérico**: a estratégia de autenticação (Etapa 3) será implementada de forma
  plugável, configurável por variáveis de ambiente, sem acoplar a um tenant Azure AD específico
  ainda.
- **Logging estruturado + Correlation ID desde a fundação**: é transversal a todos os módulos de
  negócio futuros (a auditoria, em particular, depende de correlacionar logs entre requisições).
  Retrofitar isso depois de já existirem dezenas de endpoints é caro.
- **Métricas Prometheus desde a fundação**: mesmo raciocínio - infraestrutura de observabilidade é
  barata de ligar agora e cara de adicionar depois.
- **i18n com rotas `[locale]` desde a Etapa 1**: reestruturar as rotas do App Router depois que já
  existirem várias páginas de negócio é um refactor caro; a estrutura de internacionalização entra
  vazia (poucas chaves) mas já no lugar certo.
- **Prisma com client gerado em `packages/database/generated`**: caminho de output explícito (em
  vez do padrão dentro de `node_modules`), seguindo a direção atual do Prisma, e evita ambiguidade
  de qual client está sendo importado em um monorepo.

### Etapa 2 - Modelagem de dados completa

Schema Prisma com ~34 tabelas (ver `packages/database/prisma/schema.prisma`), organizado em:
RBAC (`User`/`Role`/`Permission`, tenant-scoped), questionário (`QuestionCategory`/`Question`/
`QuestionOption`), biblioteca de controles (`ControlFramework`/`Control`, catálogo global),
matriz de risco parametrizável (`RiskMatrixConfig` + níveis de probabilidade/impacto +
`RiskMatrixCell` como grade 2D + `RiskClassification`), avaliação (`Assessment` →
`AssessmentAnswer` → `AssessmentVersion` → `RiskResult`/`TechnicalOpinion`, cada um imutável por
versão), workflow de aprovação configurável (`WorkflowDefinition`/`WorkflowStep`/
`WorkflowStepExecution`), inventário (`SoftwareInventoryItem`), anexos, comentários, auditoria e
notificações. Seed em `packages/database/prisma/seed.ts` popula um tenant demo com RBAC, as 10
categorias de questionário do escopo, uma matriz de risco 3×3 funcional e o fluxo de aprovação
padrão (Gestor da Área → Segurança da Informação → DPO\* → Jurídico\* → Aprovação Final).

Decisões que valem registro:
- **Motor de risco com dois eixos (`RiskDimension`: PROBABILITY/IMPACT/BOTH) por pergunta**: o
  requisito pede "Score, Probabilidade, Impacto, Risco" como quatro saídas distintas de um único
  questionário. Cada pergunta é marcada com qual eixo ela alimenta; o motor soma os scores
  ponderados por eixo, mapeia cada um para um nível via `RiskMatrixConfig`, e cruza os dois numa
  grade 2D (`RiskMatrixCell`) - em vez de um único score linear, que não permitiria, por exemplo,
  "probabilidade alta + impacto baixo" classificar diferente de "probabilidade baixa + impacto
  alto".
- **Pergunta booleana = SINGLE_CHOICE com 2 opções**: em vez de um `QuestionType.BOOLEAN` à parte,
  "Sim"/"Não" são só duas `QuestionOption` com seus próprios scores - mantém o motor de risco
  uniforme para qualquer pergunta de escolha, sem branch por tipo.
- **`RiskResult` e `TechnicalOpinion` são 1:1 com `AssessmentVersion`, não com `Assessment`**: como
  o requisito exige nunca sobrescrever uma versão, o resultado do cálculo e o parecer (com hash e
  número únicos) precisam estar amarrados à versão exata que os gerou, não à avaliação como um todo.
- **`Attachment` usa FKs próprias (`assessmentId?`, `inventoryItemId?`) em vez de um par genérico
  `relatedType`/`relatedId`**: mantém integridade referencial real no Postgres.
- **Inventário separa "tipo de entrega" (`SoftwareType`: SaaS/On-Premises/Desktop/Mobile/API) de
  "onde está hospedado" (`hostingProvider`, texto livre - AWS, Google Cloud, Magalu Cloud,
  datacenter próprio, etc.)**: são dimensões diferentes (o requisito original já pedia cortes
  separados de "SaaS x On-Premise" **e** "Cloud x Local" no dashboard executivo); `hostingProvider`
  é texto livre de propósito, para não exigir migration cada vez que a empresa contratar um
  provedor de nuvem novo.

\* DPO entra condicionalmente (`WorkflowStep.requiresLgpd`); Jurídico é opcional
(`WorkflowStep.isOptional`), conforme o fluxo padrão descrito no escopo.

- **`Area` como entidade normalizada (tenant-scoped), não texto livre**: `Assessment` e
  `SoftwareInventoryItem` referenciam `Area` via FK em vez de um campo `requestingArea: String`.
  Decisão adiantada nesta etapa (mais barata agora do que depois de existir UI/dados reais em cima
  de um campo texto) pensando no placar de maturidade/adesão por área da Etapa 9 - texto livre
  deixaria "TI" e "T.I." virarem áreas diferentes num ranking. Seed já popula 7 áreas comuns.

### Etapa 3 - Autenticação e RBAC

Módulo `auth` (login local + SSO SAML) e `users` (repository/service com as permissões já
achatadas a partir de `UserRole → Role → RolePermission → Permission`). Login exige `tenantSlug`
explícito no corpo (`POST /auth/login`) - ainda não há seleção de tenant por subdomínio/UI, e a
API não esconde essa dependência atrás de um tenant default fixo no código.

- **Access token curto (15m) + refresh token rotativo e revogável (7d)**: refresh tokens são
  persistidos como hash (nunca o valor puro) numa tabela `RefreshToken`, agrupados por `familyId`.
  A cada uso o token é rotacionado (o antigo é marcado revogado, um novo é emitido na mesma
  família); se um token já revogado for apresentado de novo, é sinal de roubo/replay - a família
  inteira é revogada na hora. Sem isso, JWT de refresh só expiraria sozinho, nunca seria possível
  invalidar antes da hora (logout de verdade, resposta a incidente).
- **Permissões embutidas no access token, não consultadas a cada request**: calculadas uma vez no
  login/refresh e assinadas no JWT. Troca deliberada de consistência imediata por desempenho -
  mudar o papel de alguém só faz efeito no próximo login/refresh, não instantaneamente.
- **Guard global protegido por padrão**: `JwtAuthGuard` é registrado via `APP_GUARD` e vale para
  toda rota da aplicação, inclusive de módulos futuros - fica pública só com `@Public()` explícito
  no controller/handler. Escolhido no lugar de aplicar guard rota-a-rota porque esquecer de proteger
  uma rota nova é o erro mais comum (e mais caro) em RBAC; aqui ele deixa de ser possível por
  omissão. `/health/*` e `/metrics` precisaram ser marcados `@Public()` explicitamente por causa
  disso (o controller do Prometheus é de uma lib externa - foi preciso estender
  `PrometheusController` só para poder decorar a rota).
- **SAML nunca derruba o bootstrap quando desabilitado**: a estratégia é sempre instanciada (evita
  o problema de `process.env` ainda não estar populado na hora em que os decorators de módulo são
  avaliados), mas com uma config placeholder sintaticamente válida quando `SAML_ENABLED=false`; a
  rejeição acontece de forma explícita (`501 Not Implemented`) tanto no guard (rota de início de
  login) quanto na verificação do perfil (callback) - nunca como crash de inicialização.
- **Bug real encontrado e corrigido nesta etapa**: `z.coerce.boolean()` do Zod faz `Boolean(valor)`
  por baixo dos panos - `Boolean("false")` é `true` em JS, então `SAML_ENABLED=false` no `.env`
  estava sendo lido como `true` e derrubava o boot exigindo `SAML_ENTRY_POINT`/`SAML_CERT`. Corrigido
  com um transform que só aceita literalmente as strings `"true"`/`"false"`.
- **Separação de Funções como serviço isolado (`SeparationOfDutiesService.assertNotSelfApproval`)**:
  a regra ("quem solicitou não pode aprovar") não depende de nenhum conceito de workflow - é uma
  primitiva reutilizável que a Etapa 6 vai chamar dentro do `WorkflowService`, não lógica embutida
  ali.

Fluxo validado de ponta a ponta contra o Postgres real (não só testes unitários): login local,
`/auth/me` com o access token, refresh via cookie httpOnly, logout revogando o token, refresh
recusado depois do logout, e `/auth/saml/login` respondendo `501` com SSO desabilitado.

### Etapa 4 - CRUD de avaliações e questionários

Módulo `questionnaire` (categorias/perguntas/opções, com endpoints de administração separados dos
de resposta) e módulo `assessments` (criação, edição, envio, listagem com paginação e escopo por
permissão). O questionário seedado é o processo real de homologação já usado pela área de Segurança
da Informação (26 perguntas, 7 categorias), substituindo o conjunto de perguntas placeholder da
Etapa 2.

- **Envio de avaliação cria uma `AssessmentVersion` imutável (snapshot)**: em vez de só mudar o
  `status` do registro, `submit()` grava uma cópia congelada das respostas no momento do envio -
  reenvios após ajuste (`PENDING_ADJUSTMENT` -> novo envio) geram `v1.1`, `v1.2`, etc., sem nunca
  sobrescrever uma versão já avaliada.
- **Completude de questionário validada no servidor, não só no formulário**: `assertQuestionnaireComplete`
  cruza as perguntas obrigatórias (`isRequired`) com as respostas antes de aceitar o envio -
  perguntas condicionais (`isRequired=false`, ex.: detalhe de MFA só se MFA = Sim) ficam de fora da
  checagem.
- **Separação de Funções (SoD) já reaproveitada aqui**: só quem criou a avaliação (`requesterId`)
  pode editá-la ou enviá-la; visualização de avaliações de terceiros depende de uma permissão
  separada (`assessments:view-all`) da de ver as próprias (`assessments:view-own`).

### Etapa 5 - Motor de risco parametrizável

Módulo `risk-engine` (cálculo puro, sem acesso a banco, mais fácil de testar) e módulo `risk-matrix`
(CRUD administrativo, gated por `risk-matrix:manage`), acionados automaticamente por
`AssessmentsService.submit()` a cada nova versão de avaliação.

- **Escala alinhada ao processo de automação já em produção (n8n)**: a equipe já roda um motor de
  risco via n8n com saída de 1 a 5 e três classificações (Homologado 4.0-5.0, Aguardando Ajustes
  3.0-3.9, Rejeitado < 3.0) - o Morpheus adotou a mesma escala e os mesmos rótulos em vez de manter
  a escala 0-100 originalmente planejada, para não introduzir uma segunda convenção de score que a
  equipe precisaria traduzir mentalmente.
- **`QuestionOption.score` fica em risco cru (0=seguro, 5=risco máximo); a saída do motor inverte
  para score de segurança (0=ruim, 5=bom)**: mais intuitivo para quem cadastra o questionário
  ("quão arriscada é essa resposta?") continuar pensando em risco, enquanto a saída (`RiskResult`)
  mantém a mesma convenção do n8n (`risk_score: 4.1` = bom).
- **A decisão de classificação usa os thresholds de `RiskClassification.minScore/maxScore` sobre o
  `totalScore` agregado, não a grade 2D (`RiskMatrixCell`)**: mais simples e auditável do que
  derivar a aprovação de uma célula de matriz - a grade 2D continua no schema e ganha CRUD aqui,
  mas fica reservada para a visualização de heatmap da Etapa 9.
- **Cálculo separado da persistência (`RiskEngineService` vs. `RiskEvaluationService`)**: o motor em
  si (média ponderada por peso, inversão de escala, classificação por faixa) não depende do Prisma -
  testável com dados em memória, sem subir banco.
- **Matriz nasce inativa ao ser criada pelo admin**: só é ativada explicitamente (e só se já tiver
  ao menos uma faixa de probabilidade, uma de impacto e uma classificação configuradas), para o
  motor de risco nunca calcular contra uma matriz incompleta.

### Etapa 6 - Workflow de aprovação configurável

Módulo `workflow`: motor de estados que avança uma `AssessmentWorkflowInstance` etapa a etapa contra
a `WorkflowDefinition` ativa/padrão do tenant, mais CRUD administrativo (`workflows:manage`) para
cadastrar definições e etapas sem alterar código.

- **Etapa condicional por LGPD não depende de casar texto de pergunta**: a etapa do DPO
  (`WorkflowStep.requiresLgpd`) só entra no fluxo se a avaliação tiver alguma resposta cuja opção
  selecionada esteja marcada como `QuestionOption.triggersLgpdReview` - mesma ideia de gatilho
  parametrizável já usada em `Recommendation.triggerOptionId`, então o admin decide quais respostas
  configuram "envolve LGPD" pelo CRUD do questionário, sem precisar mexer no motor de workflow.
  Validado nos dois sentidos: a mesma avaliação percorre `Gestor -> Segurança -> Jurídico -> Aprovação
  Final` quando não envolve LGPD, e `Gestor -> Segurança -> DPO -> Jurídico -> Aprovação Final` quando
  envolve.
- **Papel responsável, não usuário específico, decide cada etapa**: `WorkflowStepExecution` fica
  "em aberto" (sem `assignedUserId`) até que qualquer usuário que possua a `Role` responsável decida
  - modelo de fila por papel (como uma caixa de entrada de equipe), não atribuição individual
  antecipada, com o endpoint `GET /workflow/inbox` listando as etapas pendentes nos papéis do usuário
  logado.
- **Separação de Funções reaproveitada da Etapa 3**: `SeparationOfDutiesService`, construído mas sem
  consumidor até aqui, agora bloqueia quem solicitou a avaliação de decidir qualquer etapa dela -
  primeiro uso real da primitiva.
- **`isOptional` vira uma decisão explícita (`SKIP`), não um pulo automático**: diferente da etapa
  condicional por LGPD (que soma/exclui do fluxo antes de qualquer decisão), uma etapa opcional
  (ex.: Jurídico) sempre entra no fluxo e exige que o responsável decida - só que `SKIP` é uma
  decisão válida além de aprovar/reprovar/pedir ajuste, e só nessas etapas.
- **Reenvio após ajuste reaproveita a mesma `AssessmentWorkflowInstance`**: por ser 1:1 com
  `Assessment`, `REQUEST_ADJUSTMENT` devolve o status para `PENDING_ADJUSTMENT` sem fechar a
  instância; quando o solicitante reenvia, o fluxo reinicia da primeira etapa elegível, preservando
  as execuções anteriores como histórico em vez de apagá-las.
- **Decisão de aprovar/reprovar/pular usa o mesmo enum já modelado na Etapa 2**
  (`WorkflowStepStatus`), sem estado novo no schema - só a orquestração (qual etapa vem a seguir,
  quando fechar a instância) é lógica nova desta etapa.

Validado de ponta a ponta contra o Postgres real via HTTP: envio sem LGPD pulando a etapa do DPO,
envio com LGPD passando pelo DPO, bloqueio por permissão (`assessments:approve`) de quem não é
aprovador, caixa de entrada (`/workflow/inbox`) e reprovação (`REJECT`) encerrando a avaliação como
`REJECTED`.

### Etapa 7 - Geração de parecer técnico em PDF

Módulo `technical-opinions` (gerador de PDF via `pdfkit` + QR Code via `qrcode`, sem depender de um
motor HTML→PDF como Puppeteer) e módulo `storage` (adapter de armazenamento) - acionados
automaticamente pelo `WorkflowService` quando uma avaliação chega a um estado terminal
(Homologado/Rejeitado). O layout foi desenhado a partir de um modelo real de parecer já usado pela
equipe de Segurança da Informação, generalizado para qualquer tenant (sem nenhuma marca ou
convenção fixa de uma empresa específica).

- **"Hash" do parecer é do instalador do software avaliado, não do PDF em si**: decisão explícita do
  usuário, alinhada ao modelo real (evidência de verificação antivírus, ex.: VirusTotal) - guardado
  em `Assessment.installerFileHash` (SHA-256, auto-reportado pelo solicitante) e copiado como
  snapshot para `TechnicalOpinion.hash` no momento da emissão.
- **QR Code aponta para um endpoint público de verificação** (`GET
  /technical-opinions/verify/:tenantSlug/:number`, marcado `@Public()`) que devolve só o mínimo
  necessário para confirmar autenticidade (número, classificação, data de emissão) - nunca o parecer
  completo nem dados sensíveis da avaliação.
- **Número sequencial reaproveita a convenção já usada pela equipe** (`SECOPS-SW-MESANO-NUMERO`),
  mas o prefixo é configurável por tenant (`Tenant.opinionNumberPrefix`, default `"SECOPS-SW"`) -
  outros tenants não ficam presos à nomenclatura de uma empresa específica. A sequência reinicia a
  cada mês; corrida de concorrência é tratada com um retry limitado que reconfere se o número
  candidato já existe antes de persistir.
- **Personalização do tenant sem hardcode**: `Tenant.logoUrl` e `Tenant.securityTeamName` são
  opcionais (cabeçalho cai para texto genérico - "Equipe de Segurança da Informação" - se não
  configurados), abrindo brecha para customização por empresa sem precisar tocar em código.
- **Downloads sempre autenticados e nunca por URL pública direta**: `StorageAdapter` (interface com
  `save`/`read`, implementação de disco local em dev) não expõe `getPublicUrl()` de propósito - a
  API sempre faz streaming do PDF através de um endpoint autorizado
  (`GET /technical-opinions/:id/download`), o mesmo contrato que um adapter S3 com bucket privado
  atenderia em produção (Etapa 16), sem precisar de URLs pré-assinadas.
- **Seções do questionário no PDF são geradas dinamicamente por categoria**, não hardcoded a
  "Identificação"/"Segurança"/etc. - qualquer categoria nova que o admin cadastrar via CRUD (Etapa 4)
  aparece automaticamente em pareceres futuros, sem mudança de código.
- **Metodologia de score mantida como já validada na Etapa 5** (probabilidade/impacto calculado a
  partir das perguntas do questionário) em vez de tentar replicar a tabela manual de 4 critérios
  nomeados (Segurança/Compatibilidade/Suporte/Facilidade) do modelo de referência - decisão explícita
  do usuário para não reabrir o motor de risco já testado.

Validado de ponta a ponta contra o Postgres real via HTTP: avaliação aprovada em todas as etapas
gerou parecer com número `SECOPS-SW-072026-001`, hash do instalador, PDF real (~9KB, cabeçalho
`%PDF-` válido) baixado com sucesso, e o endpoint público de verificação respondendo corretamente
tanto para o número válido quanto para um inexistente.

### Etapa 8 - Versionamento e auditoria completa

`AuditLog` já existia no schema desde a Etapa 2 mas não tinha nenhum consumidor até aqui. Módulo
`audit` (global, como `PrismaModule`) grava e consulta a trilha via duas rotas deliberadamente
diferentes:

- **`@Audit(action, entityType)` + `AuditInterceptor` global para CRUDs simples**: a ação e o tipo de
  entidade já são conhecidos em tempo de desenvolvimento (criar/editar/excluir categoria, pergunta,
  matriz de risco, definição de workflow, etc.) - um decorator por rota, sem duplicar lógica de
  gravação em cada controller. Mesma ideia de `@RequirePermissions()` já usada desde a Etapa 3.
- **Chamada explícita a `AuditLogService.record()` para eventos de negócio com ação dinâmica**: login/
  logout (a ação só é conhecida depois de validar/revogar o token), decisão de workflow (aprovar,
  reprovar, pedir ajuste ou pular só se sabe pelo corpo da requisição), envio de avaliação, download
  de parecer.
- **`entityId` em rotas de criação aninhada prioriza o corpo da resposta sobre o param de rota**: em
  `POST /configs/:id/probability-levels`, o `:id` da rota é o config PAI, não a faixa recém-criada -
  gravar o `entityId` errado teria sido um bug sutil e silencioso.
- **Auditoria nunca derruba a ação de negócio**: `AuditLogService.record()` nunca lança - uma falha ao
  gravar (ex.: banco fora do ar num instante ruim) vira só log de aplicação, nunca um 500 numa ação
  que já tinha sucedido de verdade.
- **Histórico de versões (`GET /assessments/:id/versions`)**: expõe a linha do tempo de
  score/classificação/parecer de cada reenvio de uma avaliação, sem repetir os `include` mais pesados
  no endpoint de detalhe (que é hot path) - consulta dedicada, só usada por essa rota.
- **Escopo deliberadamente não coberto**: `WorkflowStep`/`RiskMatrixConfig` continuam mutáveis - editar
  o nome de uma etapa ou uma faixa depois de decisões já tomadas não gera uma nova versão desses
  registros, só do `Question`/`Assessment` (via `AssessmentVersion`, já existente desde a Etapa 4). O
  parecer em PDF já emitido é o registro imutável de verdade; consultas ao vivo do histórico de
  workflow refletem o estado atual da configuração, não um snapshot ponto-a-ponto - trade-off comum em
  sistemas de auditoria, documentado aqui em vez de resolvido com versionamento de configuração
  inteiro.

Validado de ponta a ponta contra o Postgres real via HTTP: login, criação e envio de avaliação,
aprovação em todas as etapas do workflow e download do parecer técnico todos registrados
corretamente em `GET /audit-logs`, com `action`/`entityType`/`entityId` certos para cada evento.

### Etapa 9 - Dashboards e gamificação

Módulo `dashboards`: quatro endpoints de leitura (`/me`, `/admin`, `/executive`, `/leaderboard`), todos
calculados sob demanda por agregação direta (Prisma `groupBy`/consultas) sobre `Assessment`,
`WorkflowStepExecution` e `TechnicalOpinion` - nenhuma tabela nova, nenhum job/cache de
pré-cálculo.

- **`TechnicalOpinion` como base seguro para taxa de aprovação/qualidade/distribuição**: só é emitido
  numa decisão terminal (Etapa 7), e hoje `REJECTED`/`APPROVED` não voltam a ser editáveis (reabertura
  ainda não implementada) - então cada `Assessment` decidido tem no máximo um parecer, o que evita
  ter que resolver "qual é a versão mais recente" na consulta.
- **Placar de maturidade por área (gamificação) com pesos fixos, não mais uma entidade
  configurável**: ao contrário da matriz de risco ou do workflow, isso é um recurso de engajamento,
  não uma regra de compliance - não justifica o custo de outro CRUD administrativo. Qualidade pesa
  mais que volume de propósito (40% vs. 30%): o objetivo é premiar áreas que submetem software já
  bem avaliado, não só quem submete mais.
- **Volume normalizado por relativo, não por um teto arbitrário**: `volumeScore = (volume da área /
  maior volume entre as áreas) × 5` - evita ter que adivinhar um número "bom" de submissões por
  tenant, que varia demais entre empresas pequenas e grandes.
- **Escopo deliberadamente não coberto nesta etapa**: o roteiro original também previa o gatilho de
  notificação por e-mail ao uma área subir de nível. Isso ficou de fora aqui porque (a) o módulo SMTP
  ainda não existe (Etapa 10), (b) `NotificationType` não tem um valor de gamificação ainda, e (c)
  não há hoje um conceito de "responsável pela área" no schema para saber quem notificar. Como o
  placar é recalculado ao vivo (não persistido), também não há ainda onde comparar "nível anterior"
  para detectar a subida - fica para quando o módulo de notificações entrar.

Validado de ponta a ponta contra o Postgres real via HTTP: os quatro endpoints devolvendo dados
reais do tenant demo, incluindo o cálculo do placar batendo exatamente com a fórmula esperada
(score composto 4.85, nível "Referência" para a área com maior volume/qualidade/aprovação).

### Etapa 10 - Inventário de softwares e notificações

Dois módulos novos: `notifications` (genérico, global como `AuditLogModule`) e `inventory`
(`SoftwareInventoryItem`, já modelado desde a Etapa 2 mas sem nenhum consumidor até aqui).

- **`EmailAdapter` como interface, `SmtpEmailAdapter` como implementação** - mesmo padrão do
  `StorageAdapter` (Etapa 7): sem `SMTP_HOST` configurado, o adapter simplesmente loga um aviso em
  vez de tentar enviar - dev/CI não precisam de um servidor SMTP de verdade, e a notificação
  continua sendo gravada em `Notification` normalmente (a linha do sino/inbox no produto não
  depende do e-mail ter sido entregue).
- **`NotificationsService.notify()` nunca lança** - mesmo raciocínio do `AuditLogService` (Etapa 8):
  uma falha ao gravar ou enviar e-mail não pode derrubar a ação de negócio (aprovar uma etapa,
  emitir um parecer) que disparou a notificação.
- **Item de inventário criado automaticamente na aprovação final do workflow**, com categoria/tipo/
  classificação de dados nascendo em valores padrão conservadores em vez de tentativa de inferência
  automática a partir do questionário (frágil, já evitado antes - ver decisão equivalente na Etapa
  7) - o gestor refina depois pelo CRUD (`inventory:manage`).
- **Revisão periódica por job diário (`@nestjs/schedule`), disparo por borda**: a consulta só olha
  itens ainda `ACTIVE` com `nextReviewDate` dentro da janela de aviso (`INVENTORY_REVIEW_WARNING_DAYS`,
  30 dias por padrão); ao marcar como `PENDING_REVIEW` ele some da consulta do dia seguinte -
  notifica só uma vez por vencimento, sem precisar de um campo extra tipo "última notificação
  enviada".
- **Gatilhos de workflow cobertos**: nova etapa liberada (`NEW_REQUEST` para todo usuário com o
  papel responsável), aprovação/reprovação/pedido de ajuste (para quem solicitou) e parecer técnico
  emitido (`OPINION_ISSUED`) - o gatilho de gamificação (subida de nível) que ficou pendente da
  Etapa 9 continua fora do escopo: falta um conceito de "responsável pela área" no schema, e o
  placar sendo recalculado ao vivo (não persistido) não tem onde comparar "nível anterior" para
  detectar a subida.

Validado de ponta a ponta contra o Postgres real via HTTP: notificação `NEW_REQUEST` na primeira
etapa, `APPROVAL`/`OPINION_ISSUED` ao aprovador final, item de inventário criado com
`nextReviewDate` exatamente 12 meses à frente, CRUD manual (`PATCH /inventory/:id`) e
marcar-como-lida (`PATCH /notifications/:id/read`) todos funcionando contra dados reais.

### Etapa 11 - Gestão documental (anexos)

Módulo novo `attachments`, reaproveitando o `Attachment` já modelado desde a Etapa 2 (nunca usado
até aqui) e o `StorageAdapter` da Etapa 7 (mesma dupla local-disk/S3-pronto, sem URL pública -
download sempre passa autenticado pelo controller).

- **Anexo pertence a exatamente uma avaliação ou a um item de inventário, nunca aos dois** -
  validado explicitamente no service (`assertExactlyOneParent`) em vez de modelar como duas FKs
  soltas e confiar em disciplina de uso; upload e listagem exigem um dos dois IDs via DTO.
- **Versionamento por nome de arquivo, nunca sobrescreve** - reenviar `contrato.pdf` no mesmo
  parent não apaga o anterior: cria uma nova linha `Attachment` com `version = max anterior + 1` e
  um novo objeto no storage (chave inclui timestamp). Mesma filosofia de histórico imutável já
  usada em `AssessmentVersion` (Etapa 8) e `TechnicalOpinion` (Etapa 7) - nunca perder uma versão
  anterior de um documento de compliance é mais importante que economizar espaço em disco.
- **Autorização diferente por tipo de parent**: anexo de avaliação segue a mesma regra de
  visibilidade já usada em `assessments` (requester dono, ou `assessments:view-all`/`assessments:approve`
  para outros papéis); anexo de item de inventário usa as permissões já existentes
  `inventory:view`/`inventory:manage` (Etapa 10) - nenhuma permissão nova precisou ser criada.
- **Upload validado na borda**: `FileInterceptor` do Nest com allowlist de MIME type (PDF, Word,
  Excel, PNG/JPEG, ZIP) e limite de 25MB, rejeitados antes de qualquer lógica de negócio rodar -
  consistente com a postura de segurança do resto da API (ValidationPipe global, Helmet, etc).
- **Download sempre autenticado, nunca por URL pública** - o controller le o buffer via
  `StorageAdapter.read()` e retorna como `application/octet-stream` com `Content-Disposition`,
  registrando um `AuditLogService.record()` de `DOWNLOAD` a cada acesso (quem baixou o quê e quando
  fica no trilho de auditoria da Etapa 8).

Validado de ponta a ponta contra o Postgres real via HTTP: upload em uma avaliação com sucesso pelo
requester, reenvio do mesmo nome de arquivo incrementando a versão (v1 → v2) sem apagar a anterior,
listagem ordenada por nome/versão, download retornando os bytes corretos, upload em item de
inventário por um usuário com `inventory:manage`, bloqueio (403) de um usuário sem essa permissão
tentando o mesmo, e rejeição (400) de payload com avaliação e item de inventário ao mesmo tempo.

### Etapa 12 - Biblioteca de controles

Módulo novo `controls`, expondo o catálogo `ControlFramework`/`Control` já modelado desde a Etapa 2
(sem consumidor até aqui) e conectando-o ao questionário via `QuestionControl` (também já existente
e sem uso).

- **Catálogo global, sem CRUD via API** - `ControlFramework`/`Control` representam frameworks
  padronizados (ISO, NIST, CIS, LGPD, GDPR, OWASP), o mesmo conteúdo para qualquer tenant, igual ao
  catálogo de `Permission`. Só leitura (`GET /controls/frameworks`, `GET /controls`), aberta a
  qualquer usuário autenticado - mantido pelo seed, não por um admin por tenant.
- **77 controles curados, não exaustivos** - os frameworks completos seriam inviáveis de manter à
  mão (ISO 27002 tem 93 controles, NIST CSF ~106 subcategorias, CIS v8 153 safeguards, OWASP ASVS
  200+ requisitos). Onde o framework tem uma lista oficial curta e completa no nível superior (os 18
  Controls do CIS v8, os 14 capítulos do OWASP ASVS, os 10 itens do OWASP Top 10), o seed usa essa
  lista completa; nos demais, uma seleção dos itens mais relevantes para avaliação de risco de
  software. Ajustável depois por um CRUD administrativo do catálogo, se necessário.
- **Vínculo pergunta-controle como permissão própria (`controls:manage`), separada de
  `questions:manage`** - mapear controles de conformidade a perguntas é tipicamente trabalho do time
  de GRC/compliance, não de quem edita o conteúdo do questionário; times maiores costumam separar
  essas responsabilidades. Endpoints seguem o mesmo padrão de sub-recurso já usado para opções de
  pergunta (Etapa 4): `POST/DELETE /questionnaire/admin/questions/:id/controls(/:controlId)`.
- **Vínculo é um upsert idempotente na chave composta** (`questionId_controlId`) - vincular um
  controle já vinculado não gera erro nem duplicata, mesmo padrão já usado no upsert de célula da
  matriz de risco (Etapa 5).
- **Tipo de leitura administrativa separado do tipo usado pelo motor de risco** - `Question` ganhou
  um segundo shape de include (`QuestionAdminDetail`, com `controls`) só para as telas
  administrativas; o restante do sistema (responder questionário, engine de risco) continua usando
  o shape original (`QuestionWithOptions`, sem `controls`) - evita carregar/expor a biblioteca de
  controles em fluxos que não precisam dela.
- **Integração com o parecer técnico em PDF (Etapa 7) fica fora de escopo por ora** - mostrar quais
  frameworks uma avaliação cobre no PDF é um bom próximo passo, mas expandiria uma etapa já fechada;
  fica documentado aqui como possibilidade futura, não implementado.

Validado de ponta a ponta contra o Postgres real via HTTP: listagem de frameworks com contagem de
controles, filtro de controles por framework (18 resultados exatos para CIS v8), vínculo de um
controle a uma pergunta por um admin, bloqueio (403) da mesma ação por um usuário sem
`controls:manage`, rejeição (404) ao vincular um controle inexistente, desvínculo, e conferência de
que os vínculos seedados (MFA → ISO 27001 A.9/8.5, NIST CSF PR.AA, CIS v8 Control 6, OWASP ASVS V2)
aparecem corretamente na listagem administrativa de perguntas.

### Etapa 13 - i18n, temas e responsividade

Sem novos módulos - passo de polimento sobre as 5 telas que já existiam no frontend (`apps/web`)
desde a Etapa 1: home, login, dashboard (lista de avaliações), nova avaliação e detalhe da
avaliação. A base de i18n/tema (next-intl + next-themes, roteamento `[locale]`) já estava correta
desde a fundação técnica - o trabalho aqui foi fechar lacunas, não reconstruir.

- **Strings hardcoded corrigidas**: o botão "Entrar" da home e o rótulo "Criticidade" no detalhe da
  avaliação escapavam do catálogo de traduções (aparentemente por terem sido escritos direto em
  português depois que a tradução da tela já estava pronta); a coluna de criticidade na tabela do
  dashboard renderizava o valor cru do enum (`HIGH`) em vez do rótulo traduzido - todos os três
  agora passam por `useTranslations()`.
- **`<title>`/metadata por rota**: o layout usava `export const metadata` estático (sempre em
  português, mesmo na rota `en`) - virou `generateMetadata` assíncrono lendo de um namespace
  `Metadata` dedicado, coerente com o resto do app.
- **Alternador de tema com 3 estados**: antes alternava só claro/escuro, perdendo a opção "seguir o
  sistema operacional" assim que o usuário clicava uma vez. Agora cicla claro → escuro → sistema,
  sem precisar de um novo componente de menu (evita puxar mais uma dependência Radix só para isso).
- **Responsividade real, não só `overflow-x-auto`**: os dois formulários (nova avaliação, detalhe da
  avaliação) tinham grids de 2 colunas fixas que espremiam em telas estreitas - viram coluna única
  abaixo do breakpoint `sm`. A tabela de avaliações no dashboard escondia as colunas de menor
  prioridade (área, data de criação) abaixo de `md`, e criticidade abaixo de `sm`, mantendo sempre
  visíveis software e status - mesmo padrão de tabela responsiva usado por qualquer painel
  corporativo, sem reescrever a tabela inteira como lista de cards. Headers com controles de
  idioma/tema ganharam `flex-wrap` para não estourar em telas muito estreitas.
- **Rótulos de acessibilidade que estavam vazios**: `AppHeader` passava `label=""` para o seletor de
  idioma e o alternador de tema (texto `sr-only` ficava em branco para leitores de tela) - corrigido
  usando as chaves já existentes no namespace `Dashboard`.

Validado via build de produção (`next build` + `next start`) servindo as rotas `pt-BR` e `en`:
título traduzido corretamente por locale, botão "Entrar"/"Sign in" renderizando o texto certo por
idioma, e nenhuma chave de tradução (`Namespace.key`) vazando como texto literal no HTML.

### Etapa 14 - Observabilidade e hardening de segurança

Cinco frentes independentes na API, sem novo módulo de domínio - todas cross-cutting, registradas
como providers/guards/pipes globais em `app.module.ts`/`main.ts`, no mesmo espírito de
`AuditInterceptor`/`JwtAuthGuard` desde as primeiras etapas.

- **Rate limiting (`@nestjs/throttler`)**: limite global de 100 requisições/minuto por IP
  (`THROTTLE_TTL_MS`/`THROTTLE_LIMIT`, configuráveis), com `ThrottlerGuard` registrado *antes* do
  `JwtAuthGuard` - protege até rotas `@Public()` (login, refresh) sem depender de autenticação já
  ter acontecido. `/auth/login` (alvo clássico de força bruta) tem limite próprio de 5/min via
  `@Throttle()`; `/auth/refresh` (chamado automaticamente a cada carregamento de página) tem 20/min.
- **Estrutura de OpenTelemetry**: `tracing.ts` roda como o primeiro `require()` do processo (antes
  até de `reflect-metadata` em `main.ts`) porque a auto-instrumentação só consegue interceptar
  módulos (`http`, `express`, `pg`) que ainda não foram carregados. Sem `OTEL_EXPORTER_OTLP_ENDPOINT`
  configurado, os spans vão para o console - funciona em dev/CI sem precisar de um collector
  rodando, mesmo espírito do `SmtpEmailAdapter` (Etapa 10). O Correlation ID (Etapa 1) continua
  existindo em paralelo, propositalmente não unificado com o trace ID do OTel: são concerns
  diferentes (identificador simples de requisição já usado pelos logs vs. correlação de tracing
  distribuído entre serviços) - unificar os dois seria trabalho de instrumentação customizada, fora
  do que "estrutura" pede aqui.
- **CSRF via double-submit cookie**: como todo endpoint de negócio já usa JWT bearer (nunca cookie)
  para autenticar, CSRF clássico já não se aplica a eles - só `/auth/refresh` e `/auth/logout` são
  autenticados unicamente por um cookie httpOnly, e por isso são os únicos que ganharam um
  `CsrfGuard`. Login emite um segundo cookie (`morpheus_csrf_token`, não-httpOnly de propósito - o
  frontend precisa ler via `document.cookie`) que o `apiFetch` da Web reenvia como header
  `X-CSRF-Token` em toda chamada; o guard compara os dois com `timingSafeEqual`. `sameSite: "strict"`
  no cookie de refresh (desde a Etapa 3) já bloqueava a maior parte do vetor clássico - isto é defesa
  em profundidade, não a única barreira. Efeito colateral esperado: sessões que já existiam antes
  desta etapa vão pedir um novo login uma vez (não têm o cookie CSRF ainda).
- **Sanitização global**: `SanitizationPipe`, registrado antes do `ValidationPipe`, faz trim e remove
  caracteres de controle (exceto tab/LF/CR) recursivamente em todo `body`/`query`/`params` - sem
  tocar em nenhum DTO existente. `ValidationPipe` continua responsável por validar forma/tipos; este
  pipe só normaliza conteúdo textual.
- **Criptografia em repouso (AES-256-GCM)**: `CryptoService` novo (`ENCRYPTION_KEY`, 32 bytes em
  base64), aplicado hoje a `RefreshToken.ipAddress`. Deliberadamente **não** aplicado a
  `AuditLog.ipAddress`, apesar de guardar o mesmo tipo de dado - a trilha de auditoria é um registro
  de compliance que precisa ficar legível para investigação, enquanto o IP da sessão de refresh é
  dado operacional sem motivo para ficar em texto plano só de leitura direta no banco. Sem backfill
  das linhas antigas: só passa a criptografar dali para frente.
- **Filtro global de exceções**: `AllExceptionsFilter` (via `APP_FILTER`) deixa `HttpException`
  (400/403/404/...) passarem como já formatadas pelos controllers/services, mas qualquer exceção não
  tratada agora vira um 500 genérico na resposta - o detalhe completo (stack trace incluído) só
  aparece no log estruturado (pino), nunca no corpo da resposta HTTP.

Validado de ponta a ponta contra o Postgres real via HTTP: 6 tentativas de login seguidas (5
passam pela lógica de autenticação, a 6ª recebe 429); refresh sem header CSRF rejeitado com 403,
com o header correto aceito com 200, com header errado rejeitado com 403; nome de categoria
criado com espaços nas pontas voltando já sem eles (sanitização); `RefreshToken.ipAddress` gravado
como ciphertext no Postgres (`iv.authTag.ciphertext` em base64), confirmado via `psql` direto;
spans reais aparecendo no console ao iniciar a API (criação do módulo Nest, requisições HTTP).

### Etapa 15 - Arquitetura de adapters + Provider Pattern para IA

Módulo novo `integrations` (SIEM/ITSM/colaboração) e módulo novo `ai` (Provider Pattern), reaproveitando
exatamente o padrão já validado duas vezes nesta base (`StorageAdapter` na Etapa 7, `EmailAdapter`
na Etapa 10): interface + token via `Symbol()` + implementação concreta que checa sua própria env
var e vira no-op-com-log quando ela não está configurada.

- **Três adapters, um padrão só**: `SiemAdapter.send()`, `ItsmAdapter.createTicket()` e
  `CollaborationAdapter.postMessage()` são interfaces distintas (contratos diferentes: evento de
  segurança, chamado de ticket, mensagem de canal) mas a implementação concreta de cada uma
  (`WebhookSiemAdapter`/`WebhookItsmAdapter`/`WebhookCollaborationAdapter`) é um POST HTTP genérico
  - sem SIEM_WEBHOOK_URL/ITSM_WEBHOOK_URL/COLLABORATION_WEBHOOK_URL configurada, cada uma só loga um
  aviso e segue, mesmo padrão do SmtpEmailAdapter sem SMTP_HOST.
- **Consumidores reais, não interfaces soltas**: diferente do AiProvider desta mesma etapa (ver
  abaixo), os três adapters de integração já têm uso de verdade - `AuditLogService.record()`
  encaminha todo evento de auditoria ao SIEM (best-effort, numa chamada separada da gravação local,
  uma falha não afeta a outra); `WorkflowService` abre um chamado no ITSM ao reprovar uma avaliação
  (prioridade = a própria criticidade da avaliação) e posta um alerta no canal `security-alerts`
  quando a aprovação final é de uma avaliação HIGH ou CRITICAL.
- **`AiProvider` é deliberadamente só estrutura** - o roteiro original pede "apenas
  estrutura/interfaces" para este item especificamente. `NullAiProvider` prova que a interface
  compila e é injetável (lança `ServiceUnavailableException` se alguém tentar usá-la, em vez de
  fingir uma resposta), mas não tem nenhum consumidor de negócio ainda - um recurso assistido por IA
  de verdade (ex.: sugestão de justificativa, resumo de parecer técnico) fica para uma etapa futura.
  Por isso `AiModule` não é `@Global()` como `IntegrationsModule`: só quem precisar dele no futuro
  importa explicitamente.

Validado de ponta a ponta contra o Postgres real via HTTP: API sobe sem erro de DI com os dois
módulos novos registrados; login real gera um evento `LOGIN` corretamente encaminhado ao
`WebhookSiemAdapter`, visível no log estruturado com o aviso esperado (sem `SIEM_WEBHOOK_URL`) e
com `trace_id`/`span_id` do OpenTelemetry (Etapa 14) corretamente correlacionados. Abertura de
chamado no ITSM e alerta de colaboração cobertos por testes unitários com asserção exata dos
argumentos (`workflow.service.spec.ts`), já que simular o fluxo completo de aprovação multi-etapa
via HTTP exigiria um segundo usuário aprovador só para o smoke test.

### Etapa 16 - Testes, documentação final e produção

Última etapa do roteiro original: fecha três frentes que vinham sendo adiadas de propósito
(testes e2e, diagramas, estratégia de deploy) até o sistema estar funcionalmente completo o
bastante para valer a pena documentá-lo de verdade.

- **Primeiro teste e2e real do projeto**: `apps/api/test/app.e2e-spec.ts`, contra o Postgres de
  dev de verdade (não mockado - diferente de todo `*.spec.ts` até aqui). `supertest` já estava
  instalado como devDependency desde o início, sem uso - esta etapa fecha essa lacuna. Cobre o
  caminho crítico inteiro: login → criar avaliação → responder todas as perguntas do questionário
  (construídas dinamicamente a partir do que `GET /questionnaire/categories` devolve, não
  hardcoded) → enviar → decidir cada etapa do workflow até fechar → avaliação homologada → parecer
  técnico emitido com hash e número. Roda em `pnpm test:e2e` (config própria,
  `test/jest-e2e.json`, separada dos testes unitários), limpa a avaliação criada em `afterAll`
  (best-effort - uma falha na limpeza não derruba o resultado dos testes que já rodaram) para ficar
  repetível.
- **Diagramas de arquitetura** (`docs/architecture.md`): o schema de dados (36 modelos) virou 5
  diagramas ER em Mermaid agrupados por domínio (Tenancy/RBAC, Questionário/Controles, Motor de
  Risco, Avaliação/Workflow, Pós-aprovação/Auditoria) em vez de um diagrama só - 36 entidades numa
  imagem única vira ilegível. Mais um diagrama de topologia de deploy, leitura visual do que o
  Terraform desta etapa provisiona.
- **Terraform para AWS ECS/Fargate** (`infra/terraform/`): VPC dedicada, ECR, RDS gerenciado
  (substitui o Postgres em container), Secrets Manager (segredos gerados aleatoriamente pelo
  próprio Terraform, nunca em texto plano), ECS Fargate para `api`/`web` atrás de um ALB, e a task
  de `migrate` como task avulsa (não serviço) disparada no deploy - mesmo papel do serviço
  `migrate` do `docker-compose.yml`, só que orquestrada por `aws ecs run-task` em vez do Compose.
  **Nunca aplicado contra uma conta AWS real** (sem `terraform` instalado neste ambiente para
  `validate`/`plan`/`apply`) - o aviso completo, junto com as limitações conhecidas (sem HTTPS
  configurado, storage em EFS em vez de S3, sem pipeline de CI/CD), está documentado no início de
  `infra/terraform/README.md`. Decisão registrada explicitamente com o usuário antes de escrever
  qualquer arquivo: Terraform (não CDK), código completo (não só documentação da arquitetura).
- **EFS em vez de reescrever `StorageAdapter` para S3**: Fargate não tem disco persistente
  compartilhado entre tasks, mas trocar a implementação do `StorageAdapter` é trabalho de código de
  aplicação, não de infraestrutura - fora do escopo desta etapa. EFS resolve o problema de
  persistência/compartilhamento sem tocar em uma linha de código: mesma interface, mesmo
  `STORAGE_DIR`, só que montado como volume de rede. Fica documentado como o próximo passo natural
  quando alguém for de fato operar isto em produção.
- **Roteamento do ALB por host, não por path**: a API nunca teve prefixo de rota (`/auth`,
  `/assessments`, `/questionnaire`... todos top-level desde a Etapa 1), então rotear por path no
  ALB exigiria listar e manter toda rota nova de cada módulo futuro no Terraform. Roteamento por
  host (`api.<domínio>` vs. `app.<domínio>`) desacopla completamente a infraestrutura de deploy da
  lista de rotas da aplicação.

Validado: `pnpm test:e2e` passa de ponta a ponta contra o Postgres real (a avaliação de teste
criada é removida ao final, confirmado via `psql` que não sobra nenhum resíduo); suíte completa
(`pnpm turbo run lint test typecheck build --force`) permanece verde com os arquivos novos. O
Terraform em si não foi validado com o CLI (indisponível neste ambiente) - risco documentado
explicitamente, não escondido.

## Roteiro (próximas etapas)

1. ~~Fundação técnica~~ ✅
2. ~~Modelagem de dados completa~~ ✅
3. ~~Autenticação e RBAC~~ ✅
4. ~~CRUD de avaliações e questionários~~ ✅
5. ~~Motor de risco parametrizável~~ ✅
6. ~~Workflow de aprovação configurável~~ ✅
7. ~~Geração de parecer técnico em PDF (hash, QR Code, número do parecer)~~ ✅
8. ~~Versionamento e auditoria completa~~ ✅
9. ~~Dashboards (usuário, administrador, executivo) + gamificação: placar de maturidade/adesão por
   área~~ ✅ (o gatilho de notificação por e-mail ao subir de nível fica para o item 10, junto do
   módulo SMTP)
10. ~~Inventário de softwares e revisão periódica + serviço de notificações~~ ✅
11. ~~Gestão documental (anexos)~~ ✅
12. ~~Biblioteca de controles (ISO 27001/27002, NIST CSF, CIS v8, LGPD, GDPR, OWASP)~~ ✅
13. ~~i18n, temas e responsividade (polimento)~~ ✅
14. ~~Observabilidade e hardening de segurança~~ ✅
15. ~~Arquitetura de adapters para integrações futuras + Provider Pattern para IA~~ ✅
16. ~~Testes, documentação final e produção~~ ✅ - estratégia de deploy em AWS ECS/Fargate:
    imagens publicadas no ECR, Postgres migrando de container para RDS gerenciado, segredos saindo
    do `.env` para Secrets Manager, o serviço `migrate` rodando como ECS Task avulsa (não um
    serviço) disparada no deploy, e `api`/`web` atrás de um ALB - tudo em Terraform
    (`infra/terraform/`, nunca aplicado contra uma conta AWS real). Teste e2e do caminho crítico em
    `apps/api/test/`. Diagramas de arquitetura em `docs/architecture.md`.

## Depois do roteiro

Trabalho sobre a base já fechada acima - não é mais uma etapa numerada do roteiro original, então
os registros aqui são mais curtos que os das etapas.

- **Dashboards reais no frontend**: até aqui a rota `/dashboard` da Web sempre foi só a lista de
  avaliações do usuário - os quatro endpoints de `dashboards` (Etapa 9: `/me`, `/admin`,
  `/executive`, `/leaderboard`) nunca tiveram nenhuma tela. Nova rota `/dashboards` (plural,
  `apps/web/src/app/[locale]/dashboards/`) com abas - Minha visão, Administrativo e Executivo
  (as duas últimas só aparecem para quem tem `assessments:view-all`, mesmo gate do backend) e
  Placar por área. Gráficos com `recharts` atrás de um wrapper próprio
  (`components/ui/chart.tsx`) que injeta cor por CSS custom property, então tema claro/escuro
  troca sem recalcular nada em JS.
  - **Paleta de gráficos com origem, não inventada**: os 8 tons categóricos + a escala de status
    (bom/atenção/sério/crítico) em `globals.css` (`--chart-1`..`--chart-8`, `--chart-good`, etc.)
    vêm da paleta de referência já validada (CVD, contraste, banda de luminosidade) de um skill
    interno de visualização de dados - não foram escolhidos no olho.
  - **Cor por significado, não por posição**: status de avaliação/parecer que já *são* um
    resultado bom ou ruim (`APPROVED`/`Homologado` = bom, `REJECTED`/`Rejeitado` = crítico,
    `PENDING_ADJUSTMENT`/`Aguardando Ajustes` = atenção) usam a escala de status reservada, não a
    paleta categórica - estágios ainda em andamento (rascunho, em análise) ficam num cinza neutro,
    já que não são "mais uma categoria" e sim só "ainda não decidido". A paleta categórica de 8
    tons fica reservada para quando a cor precisa mesmo identificar séries distintas.
  - **Postura de conformidade como barra empilhada única**, não pizza: a proporção
    Homologado/Aguardando Ajustes/Rejeitado é parte-de-um-todo, e a forma certa para isso é uma
    barra horizontal empilhada (dá pra ver a composição num único relance), não um gráfico de
    pizza.
