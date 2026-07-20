# Morpheus

Plataforma de homologação e avaliação de risco de software, usada pela equipe de Segurança da
Informação para reduzir Shadow IT: centraliza o processo de avaliação de risco de novos sistemas
contratados pela empresa, do questionário ao parecer técnico em PDF.

> **Status:** Etapa 7 - Geração de parecer técnico em PDF. Quando o workflow de aprovação (Etapa 6)
> chega a um estado terminal (Homologado/Rejeitado), o sistema gera automaticamente o parecer
> técnico em PDF: identificação do software, resultado do motor de risco, respostas do questionário
> por categoria e o histórico completo de aprovação, com número sequencial, hash do instalador e
> QR Code de verificação pública. Próximo: versionamento e auditoria completa (Etapa 8).

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

## Roteiro (próximas etapas)

1. ~~Fundação técnica~~ ✅
2. ~~Modelagem de dados completa~~ ✅
3. ~~Autenticação e RBAC~~ ✅
4. ~~CRUD de avaliações e questionários~~ ✅
5. ~~Motor de risco parametrizável~~ ✅
6. ~~Workflow de aprovação configurável~~ ✅
7. ~~Geração de parecer técnico em PDF (hash, QR Code, número do parecer)~~ ✅
8. Versionamento e auditoria completa
9. Dashboards (usuário, administrador, executivo) + gamificação: placar de maturidade/adesão por
   área (`Area`), combinando volume de submissões, qualidade das respostas e taxa de aprovação -
   inclui o gatilho de notificação (e-mail via SMTP, ver item 10) ao conquistar um nível
10. Inventário de softwares e revisão periódica + serviço de notificações: módulo SMTP genérico
    (`NotificationsModule`, grava em `Notification` e dispara e-mail) usado tanto para o job de
    vencimento de `nextReviewDate` quanto para os eventos de workflow (Etapa 6) e gamificação
    (Etapa 9) - infraestrutura compartilhada, não reimplementada em cada etapa
11. Gestão documental (anexos)
12. Biblioteca de controles (ISO 27001/27002, NIST CSF, CIS v8, LGPD, GDPR, OWASP)
13. i18n, temas e responsividade (polimento)
14. Observabilidade e hardening de segurança
15. Arquitetura de adapters para integrações futuras + Provider Pattern para IA
16. Testes, documentação final e produção - inclui estratégia de deploy em AWS ECS/Fargate:
    imagens (já compatíveis, multi-stage/non-root) publicadas no ECR, Postgres migrando de container
    para RDS gerenciado, segredos saindo do `.env` para Secrets Manager/SSM Parameter Store, o
    serviço `migrate` rodando como ECS Task avulsa (não um serviço) disparada no deploy, e `api`/`web`
    atrás de um ALB. Infraestrutura como código (Terraform ou CDK) a definir quando chegarmos lá.
