# Changelog — Morpheus

Log narrativo, cronológico, etapa por etapa/PR por PR, de decisões e implementação. Para
setup, stack e como rodar o projeto, ver [`docs/DEVELOPMENT.md`](./DEVELOPMENT.md) — este
arquivo existe pra tirar o histórico de lá e manter a referência enxuta.

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
- **Home e login com identidade própria** (`security-hero-background.tsx`): fundo escuro fixo
  (independente do alternador de tema - essas duas telas são vitrine, não uso diário) com acento
  vermelho e grade de pontos sutil, adaptado de uma referência visual de segurança ofensiva trazida
  pelo usuário, não copiado literalmente. O resto do app (dashboards, formulários) continua no
  visual neutro claro/escuro de sempre - mais adequado para uso interno constante. O card de
  "Status da API" que existia na home desde a Etapa 1 (prova de conectividade ponta a ponta) saiu
  de cena - fazia sentido como checkpoint técnico daquela etapa, não numa tela pública polida.
- **Home vira redirect direto para o login**: a landing separada (título + botão pequeno "Entrar")
  não agregava nada além de um clique a mais - `/` agora é um redirect server-side de verdade para
  `/login` (mesmo helper `redirect` de `@/i18n/navigation` usado no resto do app), não uma página
  que só parece login. Refino visual do card de login junto: tipografia maior no título, espaçamento
  mais generoso, legenda curta acima do card, `autofocus` no primeiro campo.
- **Fundação de UI para as telas administrativas**: kit de componentes novo em
  `components/ui/` (Dialog, Select, DropdownMenu, Checkbox, RadioGroup, AlertDialog, Separator,
  Skeleton, Table/Pagination, Toast via `sonner`), seguindo a mesma convenção `cva` + `data-slot` +
  `cn()` dos componentes existentes. `react-hook-form` + `zod` entram como o padrão de formulário
  daqui em diante (os dois formulários existentes até então não foram retrofitados). Hook
  `usePermission`/`useHasAnyManagePermission` centraliza o gate de permissão que antes era um
  `.includes()` inline repetido. `AppHeader` ganhou um menu de usuário (`DropdownMenu`) no lugar do
  botão de sign-out solto, e um link "Administração" (visível só para quem tem alguma permissão
  administrativa) para o novo shell `/admin`, com sub-navegação (Questionário, Matriz de Risco,
  Workflow, Auditoria) - cada seção já protegida pela permissão do backend correspondente, mesmo
  antes de ter conteúdo de verdade (as próximas etapas do plano pós-roteiro preenchem cada uma).
- **Inbox de aprovações** (`/approvals`): `workflow/inbox` e `workflow/steps/:id/decide` existiam
  desde a Etapa 9 do roteiro original sem nenhuma tela - lacuna funcional de alto impacto (nenhum
  aprovador conseguia ver ou decidir suas etapas pendentes pela interface). Lista as etapas
  pendentes nos papéis do usuário logado (`Table` novo da fundação de UI), cada linha abre um
  `Dialog` com as opções de decisão (aprovar, reprovar, solicitar ajuste, pular - "pular" só fica
  habilitado se a etapa for opcional) e comentário opcional. Primeiro formulário do projeto com
  `react-hook-form` + `zod`; o campo de decisão usa `Controller` (não `watch`/`setValue` direto) -
  API do `react-hook-form` que o React Compiler consegue memoizar com segurança, evitando o aviso
  de lint "incompatible library" que `watch()` sozinho dispara. `AppHeader` ganhou o link
  "Aprovações", visível só para quem tem `assessments:approve`.
  - **`zod` subiu de v3 para v4** ainda nesta etapa: `@hookform/resolvers@5.x` (instalado na etapa
    anterior) importa `zod/v4/core`, que não existe no `zod` v3 - o build falhava com "module not
    found". Como `zod` ainda não tinha uso nenhum no projeto até este ponto, corrigir a versão base
    agora evitou ter que migrar um monte de schemas v3 mais adiante.
- **Auditoria administrativa** (`/admin/audit-logs`): primeira tela real dentro do shell `/admin` -
  `GET /audit-logs` já existia desde a Etapa 8 sem interface. `Table` paginada (`Pagination` novo da
  fundação de UI) com filtros por tipo de entidade, ação e intervalo de datas acima da tabela. Sem
  filtro por usuário nesta etapa - o endpoint filtra por `userId` exato, e sem uma lista de usuários
  do tenant (isso só chega na Etapa H) expor um campo de texto para um ID não seria um filtro
  utilizável de verdade; melhor deixar de fora agora do que simular um filtro que não funciona.
  - **Efeito de busca sem `setState` síncrono**: o primeiro rascunho zerava `data`/`error` no início
    do `useEffect` antes de disparar a requisição (para mostrar o spinner de novo a cada mudança de
    filtro) - o eslint do React Compiler bloqueia esse padrão (`react-hooks/set-state-in-effect`),
    porque `setState` síncrono dentro do corpo do efeito causa uma renderização em cascata evitável.
    Ajustado para só atualizar o estado dentro do `.then`/`.catch`, igual ao padrão já usado em
    `dashboard/page.tsx` - o resultado anterior fica visível até o novo chegar, sem flash pra vazio.
- **Inventário de software** (`/inventory`, fora do shell `/admin` - `inventory:view` é uma
  permissão própria, separada de qualquer `*:manage`): listagem paginada com filtro por status,
  detalhe por item, e criar/editar via `Dialog` + `react-hook-form` (gated adicionalmente por
  `inventory:manage`). Sem rota de exclusão - o backend não expõe uma, então não há botão de
  excluir. `Dialog` de formulário compartilhado entre criação e edição (`ItemFormDialog`), com union
  discriminada em `mode` para o TypeScript garantir em tempo de compilação que `item` só falta no
  modo de criação.
  - **Gestor e responsável técnico ainda são só um ID de usuário**: `managerId` e
    `technicalResponsibleId` são obrigatórios no formulário, mas não há endpoint de listagem de
    usuários até a Etapa H - diferente do filtro de usuário da tela de auditoria (que pôde ficar de
    fora por ser opcional), aqui o campo é obrigatório para salvar o item, então não dava pra
    simplesmente omitir. Fica como campo de texto pedindo o ID diretamente, com uma nota no
    formulário avisando que um seletor por nome chega junto da tela de gestão de usuários.
  - **Cache `.next` colidindo entre `next dev` e `next build`**: rodar `pnpm turbo run build` com o
    servidor de desenvolvimento ainda ativo (mesmo diretório `.next` para os dois, sem `distDir`
    customizado) deixou o typegen de rotas (`next-env`/`AppRoutes`) desatualizado, e o build passou a
    falhar reclamando que `/inventory` e `/inventory/[id]` "não satisfazem" o tipo de rotas - as
    páginas existiam, só o cache é que estava velho. `rm -rf apps/web/.next` antes do build (e
    reiniciar o `next dev` depois) resolveu; não é um problema do código, só uma armadilha deste
    ambiente de validação que vale lembrar nas próximas etapas.
- **Questionário administrativo** (`/admin/questionnaire`): a mais complexa das telas do plano -
  árvore categoria → pergunta, com sub-formulário de opções e um seletor para vincular/desvincular
  controles de compliance. Lista de categorias expansíveis (cada uma com suas perguntas), criação de
  categoria/pergunta via `Dialog`, pergunta nova já nasce com suas opções inline (`useFieldArray` do
  `react-hook-form`, só para tipos de escolha) e cai numa página de detalhe própria
  (`/admin/questionnaire/questions/[id]`) para editar dados básicos, gerenciar opções (adicionar/
  editar/remover, com `AlertDialog` de confirmação na remoção) e o vínculo com controles.
  - **Vínculo de controle é gated por `controls:manage`, não `questions:manage`**: o backend exige
    uma permissão diferente para `POST/DELETE .../controls` do resto do CRUD de perguntas - o botão
    "Vincular controle" e o de remover vínculo só aparecem se o usuário tiver especificamente
    `controls:manage`, checado à parte do gate geral da página (`questions:manage`).
  - **`triggersLgpdReview` de uma opção não é editável por aqui**: o campo existe no modelo
    (sinaliza pra o workflow que a etapa do DPO entra no fluxo) mas nem `QuestionOptionDto` nem
    `UpdateQuestionOptionDto` o expõem - só pode ser setado via seed hoje. Não fazia parte do escopo
    desta etapa adicionar isso ao backend; fica registrado como lacuna conhecida, não fingido como
    resolvido.
  - **Sem `GET /questionnaire/admin/questions/:id`**: só existe a listagem completa
    (`GET .../questions`). A página de detalhe da pergunta busca a lista inteira e filtra pelo id no
    cliente - razoável para o volume de dados de um banco de perguntas (dezenas, não milhares), mas
    vale trocar por um endpoint dedicado se o catálogo crescer muito.
  - **DELETE devolve 200 com corpo vazio, não 204**: `removeOption`/`unlinkControl` não têm
    `@HttpCode(204)` explícito no backend - o `apiFetch` só tratava `204` como "sem corpo" e chamaria
    `response.json()` numa string vazia nos outros casos, o que lança exceção. Corrigido para tratar
    qualquer corpo vazio como `undefined` antes de tentar o parse, independente do status - conserta
    esses dois endpoints e protege qualquer DELETE futuro com o mesmo formato de resposta.
  - **`useForm` com `z.coerce.number()` precisa de dois tipos, não um**: o mesmo padrão descoberto na
    Etapa B (`Controller` em vez de `watch`) apareceu de novo, mas o typecheck revelou um problema
    novo - `z.coerce.number()` tem tipo de entrada `unknown` e saída `number`, então declarar
    `useForm<MeuTipo>()` com um único tipo colide com o que o `zodResolver` realmente produz. Padrão
    adotado em todos os formulários desta etapa: `useForm<z.input<typeof schema>, unknown,
    z.output<typeof schema>>`, com `onSubmit` recebendo o tipo de saída (já convertido para
    `number`) - substitui os tipos de formulário escritos à mão que existiam antes.
- **Matriz de risco administrativa** (`/admin/risk-matrix`): CRUD de configurações (`GET/POST/PATCH
  .../configs`, ativar via `POST .../configs/:id/activate`), faixas de probabilidade e impacto, e
  classificações (label + cor + texto-base de recomendação), cada seção com `Dialog` de criar/editar
  e `AlertDialog` de confirmação na remoção (o backend bloqueia remover algo já usado em resultados
  de risco calculados). Editor visual da grade (`HeatmapEditor`) - uma tabela probabilidade × impacto
  onde cada célula é um `Select` de classificação, colorido com a cor da própria classificação
  (contraste de texto preto/branco calculado por luminância relativa, mesma heurística usada em
  badges de status).
  - **Célula da grade é só visualização, não o que decide a classificação real**: o motor de risco
    (Etapa 5) deriva a classificação de uma avaliação direto do `totalScore` contra o `minScore`/
    `maxScore` de cada `RiskClassification` - a grade 2D (`RiskMatrixCell`) é um mapa de referência
    visual separado, reservado desde a Etapa 9 do roteiro original. Editar a grade não muda como uma
    avaliação é decidida.
  - **Endpoints de nível/classificação devolvem só a entidade criada, não a config inteira**: ao
    contrário do padrão visto em outras etapas (ex.: vincular controle devolvia a pergunta inteira
    atualizada), `addProbabilityLevel`/`addClassification`/etc. respondem só com o registro novo.
    Em vez de tentar fundir isso manualmente no estado local, cada mutação recarrega a config
    completa (`GET .../configs/:id`) depois - mais simples e sempre correto, e o volume de dados por
    matriz (algumas faixas e classificações) não justifica otimizar a chamada extra.
  - **Mesma armadilha de narrowing em union discriminada da Etapa D**: ao reabrir um `Dialog` de
    editar nível/classificação, computar `mode`/`level` (ou `mode`/`classification`) como variáveis
    separadas a partir de um estado `{mode:"create"} | {mode:"edit", level}` e passá-las como props
    individuais quebra a inferência - o TypeScript não consegue provar que `mode="edit"` implica
    `level` presente quando elas chegam por caminhos de código diferentes. Corrigido com dois blocos
    JSX condicionais (`dialogState?.mode === "create"` / `=== "edit"`) em vez de um só - o mesmo
    padrão já usado no `OptionsSection` da Etapa E.
- **Workflow administrativo** (`/admin/workflow`): CRUD de definições de fluxo de aprovação (lista +
  criação, marcar como padrão do tenant) e CRUD de etapas ordenadas por definição (nome, papel
  responsável, prazo em horas, se é opcional/pode ser pulada, se só entra no fluxo quando a avaliação
  envolve LGPD) - o mesmo `Dialog`/`AlertDialog` de confirmação já usado nas Etapas E e F, e a mesma
  correção de narrowing em union discriminada (dois blocos JSX condicionais para `dialogState`).
  - **Endpoint novo no backend: `GET /roles`** (`apps/api/src/modules/roles/`) - o editor de etapas
    precisa de um seletor de "papel responsável", e nenhum endpoint listava papéis do tenant até
    agora (nem `RolesController`, nem nada exposto via outro módulo). Módulo mínimo, mesmo padrão do
    `AreasModule` (repository + service + controller finos, `select: { id, name }`, sem paginação -
    volume de papéis por tenant é sempre pequeno). Gated por `workflows:manage`, reaproveitando a
    permissão já usada no resto deste módulo em vez de introduzir uma nova só para leitura - se uma
    tela futura (ex.: atribuição de papéis a usuários, Etapa H) precisar do mesmo endpoint com um
    gate diferente, vale revisitar então, já que `RequirePermissions` com múltiplos argumentos exige
    todas as permissões (E lógico), não qualquer uma delas (OU) - não daria pra simplesmente somar
    `users:manage` na mesma linha sem mudar o comportamento pra quem só tem uma das duas.
    *(Revisitado na Etapa H - ver abaixo: `@RequireAnyPermission()`, um decorator novo.)*
  - **Smoke test que altera estado precisa desfazer o que alterou**: testar `set-default` contra a
    API de dev trocou o workflow padrão do tenant pela definição de teste (que ficou sem etapas depois
    de outro teste remover a única que tinha) - efeito colateral real que quebraria a criação de
    novas avaliações no ambiente de dev. Corrigido restaurando o "Fluxo Padrão" original como
    definição padrão antes de seguir - qualquer smoke test que muda estado compartilhado (não só lê)
    precisa terminar revertendo, não só validar que o endpoint respondeu certo.
- **Usuários administrativos** (`/admin/users`): visualização de usuários do tenant + atribuição/
  remoção de papel via `Dialog` - sem criar ou desativar usuário nesta etapa (provisionamento hoje é
  só via SSO just-in-time ou seed; um fluxo de criação manual fica para um incremento futuro, se for
  necessário).
  - **Backend novo: `UsersController`** (`GET /users`, `GET /users/:id`, `POST/DELETE
    /users/:id/roles`) - `USERS_MANAGE` estava seedado desde a Etapa 1 e nunca foi usado por nenhum
    endpoint. `UsersService` ganhou métodos administrativos ao lado dos já existentes (usados pelo
    fluxo de autenticação) - mesmo padrão de `assertXInTenant` das outras etapas para impedir
    atribuir papel de outro tenant (`RolesService.findById`, reaproveitado de dentro de
    `UsersModule` via `imports: [RolesModule]`).
  - **`select` explícito, não `include`, na query de usuários**: o primeiro rascunho usava `include:
    { userRoles: ... }`, que traz o modelo `User` inteiro - incluindo `passwordHash` (hash bcrypt) e
    `ssoSubject`. Pego antes do smoke test, revisando a query, não durante - `include` sempre que só
    alguns campos vão para uma resposta HTTP é um hábito arriscado; `select` explícito nomeando cada
    campo é mais verboso mas não vaza nada por acidente quando o modelo ganha um campo sensível novo
    no futuro.
  - **`@RequireAnyPermission()` - decorator novo** (`apps/api/src/common/decorators/require-any-permission.decorator.ts`
    + `PermissionsGuard` atualizado): resolve a lacuna já identificada na Etapa G - `GET /roles`
    passou a exigir `workflows:manage` OU `users:manage` (antes só aceitava a primeira), já que agora
    duas telas diferentes, com permissões diferentes, precisam da mesma listagem. `RequirePermissions`
    continua com semântica E (todas as permissões exigidas); o guard agora checa as duas metadata
    keys de forma independente, então uma rota pode usar uma, a outra, ou nenhuma - não dá pra
    combinar as duas no mesmo endpoint hoje (não havia caso de uso para isso). Cobertura de teste
    nova em `permissions.guard.spec.ts` com um reflector "keyed" (retorna valores diferentes por
    metadata key) - o mock anterior, de um valor único para qualquer chamada, não conseguia exercitar
    os dois decorators isoladamente.
- **Configurações da plataforma** (`/admin/settings`) - última etapa do plano pós-roteiro: formulário
  simples (`logoUrl`, `securityTeamName`, `opinionNumberPrefix`) para os três únicos campos do
  `Tenant` pensados para serem configuráveis pelo admin (`name`/`slug` ficam de fora - mudar o slug
  quebraria login de todo mundo do tenant). Sem upload de logo - só aceita uma URL por enquanto, não
  existe endpoint de upload de imagem genérico (só o de anexo vinculado a avaliação/inventário).
  - **Backend novo: `TenantsController`** (`GET/PATCH /tenants/current`, `apps/api/src/modules/tenants/`)
    - `SYSTEM_CONFIGURE` estava seedado desde a Etapa 1 e nunca foi usado por nenhum endpoint, mesma
    situação de `USERS_MANAGE` na Etapa H. Módulo mínimo, mesmo padrão dos outros (`findById`/
    `update` finos no repository, `assertTenantExists` no service antes de editar).

## Plano pós-roteiro concluído

Etapas A a I do plano pós-roteiro (fundação de UI, aprovações, auditoria, inventário, questionário,
matriz de risco, workflow, usuários, configurações) estão todas mescladas em `main`. Toda seção de
`/admin` que antes tinha placeholder "em construção" (Etapa A) agora tem conteúdo real, e as duas
permissões seedadas desde a Etapa 1 que nunca tinham sido usadas por nenhum endpoint
(`USERS_MANAGE`, `SYSTEM_CONFIGURE`) finalmente têm um controller por trás.

- **Pontas soltas resolvidas com o que a Etapa H já trouxe**: duas limitações documentadas como
  conhecidas durante o plano principal só existiam porque não havia listagem de usuários do tenant
  ainda - agora que existe (`GET /users`, Etapa H), ambas foram fechadas sem precisar de backend
  novo. `managerId`/`technicalResponsibleId` no formulário de inventário
  (`apps/web/src/app/[locale]/inventory/_components/item-form-dialog.tsx`) trocaram de campo de
  texto pedindo um ID cru para um `Select` por nome + e-mail. O filtro de auditoria
  (`apps/web/src/app/[locale]/admin/audit-logs/page.tsx`) ganhou um `Select` de usuário, alimentando
  o `userId` que o `GET /audit-logs` já aceitava desde a Etapa C.
  - **`GET /users` precisou de um gate mais aberto**: o endpoint era só `users:manage` (Etapa H),
    mas quem usa o formulário de inventário só tem `inventory:manage`, e quem usa o filtro de
    auditoria só tem `audit:view` - nenhum dos dois necessariamente tem `users:manage`. Resolvido
    com `@RequireAnyPermission(USERS_MANAGE, INVENTORY_MANAGE, AUDIT_VIEW)` só no método `list()`
    (as demais rotas do controller - detalhe, atribuir/remover papel - continuam exigindo
    `users:manage` de verdade, via `@RequirePermissions` por método em vez de por classe). Mesmo
    decorator criado na Etapa H para o mesmo problema em `GET /roles`.
- **Tema visual customizado (tweakcn "Light Green")**: usuário indicou um tema pronto do
  [tweakcn.com](https://tweakcn.com) e colou o CSS exportado - aplicado em `apps/web/src/app/globals.css`
  (cores base, `--radius` de `0.625rem` para `1rem`, tokens de sombra `--shadow-*`, tokens de
  tracking de letra, tokens de `--sidebar-*` já prontos para uma futura navegação lateral) e
  `apps/web/src/app/[locale]/layout.tsx` (fonte trocada de Geist para Inter/JetBrains Mono, como o
  tema pede).
  - **Paleta de gráficos mantida fora do tema**: o export do tweakcn trazia `--chart-1` a `--chart-5`
    genéricos, mas o app já tem uma paleta de 8 tons categóricos + escala de status validada pelo
    skill de dataviz (CVD, contraste), usada em todos os dashboards. Trocar por 5 cores não validadas
    de um gerador de tema quebraria essa cobertura de acessibilidade - os `--chart-*` existentes
    ficaram como estavam, só o restante do tema (cores de UI, radius, sombras, tipografia) foi
    aplicado.
  - **Fetch automatizado da página do tweakcn não trouxe os valores**: a página é uma SPA renderizada
    via JS - tanto busca direta quanto via proxy leitor só retornaram a casca estática HTML, sem o
    bloco de CSS. Resolvido pedindo ao usuário para colar o CSS exportado direto (botão "Code" no
    editor do tweakcn) - mais confiável que tentar adivinhar ou raspar valores de uma SPA.
- **Navegação lateral retrátil (estilo AWS Console / Oracle Cloud)**: o `AppHeader` horizontal e a
  sub-navegação horizontal de `/admin` foram substituídos por uma sidebar vertical única
  (`apps/web/src/components/app-sidebar.tsx` + `app-shell.tsx`), usando o componente composto
  `sidebar` oficial do shadcn/ui - os tokens `--sidebar-*` já estavam no tema desde a etapa anterior,
  só faltava o componente para consumi-los. Colapsa para uma régua só de ícones (com tooltip ao
  passar o mouse), vira `Sheet` (drawer) abaixo de 768px, e tem atalho de teclado Cmd/Ctrl+B. Estado
  colapsado/expandido persiste via cookie (`sidebar_state`, lido no novo `(app)/layout.tsx` como
  Server Component) em vez de `localStorage` - evita o flash de estado errado no primeiro render sem
  precisar do hack de script `beforeInteractive` que o tema (claro/escuro) usa.
  - **Route group `(app)`**: `dashboard/`, `dashboards/`, `approvals/`, `inventory/`, `assessments/`
    e `admin/` foram movidos para `apps/web/src/app/[locale]/(app)/` via `git mv`, para que o shell da
    sidebar seja definido uma única vez em vez de em cada uma das 8 páginas que antes renderizavam
    `<AppHeader />` individualmente. `login/` ficou fora do grupo, sem sidebar. Parênteses não entram
    na URL - transparente para o roteamento e para o `next-intl`.
  - **Sub-navegação de `/admin` virou grupo aninhado colapsável** dentro da mesma sidebar, reusando
    `ADMIN_NAV_ITEMS` sem mudar seu formato. De quebra, a duplicação `ADMIN_SECTION_PERMISSIONS` em
    `apps/web/src/lib/use-permission.ts` (um array hardcoded que só "espelhava" `ADMIN_NAV_ITEMS`)
    foi eliminada - `useHasAnyManagePermission` agora deriva direto da lista única.
- **Super-admin cross-org (multi-tenant)**: administradores comuns continuam 100% restritos à
  própria organização - a novidade é uma permissão nova, `platform:cross-tenant`, concedida a um
  papel dedicado ("Super Administrador (Plataforma)") que libera `POST /auth/switch-tenant`. Quem
  tem essa permissão reemite o próprio access token com o `tenantId` trocado para outra organização
  e um seletor na sidebar (`OrgSwitcher`) escolhe qual.
  - **Achado que definiu o design**: não existe um chokepoint central de escopo por tenant no
    backend - cada repository/service filtra `tenantId` manualmente (recebido como parâmetro em
    queries de lista, ou comparado depois de um `findById` sem filtro). Rastrear e alterar isso em
    10+ módulos seria um projeto à parte. A saída foi não mexer em nenhum desses módulos: como todos
    já confiam cegamente em `user.tenantId` vindo do JWT, reemitir um token com `tenantId` diferente
    faz o super-admin "virar" administrador daquele outro tenant para todos os efeitos práticos, sem
    tocar uma linha de lógica de negócio existente.
  - **Sessão trocada não é sócio real do tenant alvo** (sem `User` row lá) - o token reemitido carrega
    o catálogo *completo* de `Permission`, não uma role real (que não existe pra ele naquele tenant).
    Voltar pro tenant de casa (`switchTenant(homeTenantId)`) busca as permissões *reais* do usuário no
    banco - nunca fica "mais poderoso" na própria organização do que o RBAC normal permite.
  - **`sub` do JWT nunca muda entre trocas** - só `tenantId`/`permissions`. A trilha de auditoria já
    deriva `tenantId` de `request.user.tenantId` (`AuditInterceptor`), então toda escrita feita "como"
    outro tenant cai automaticamente no `AuditLog` daquele tenant, com o `userId` do super-admin real -
    zero mudança no interceptor. A própria troca de tenant também gera um `AuditLog`
    (`action: SWITCH_TENANT`, adicionado ao enum `AuditAction` - única migration desta etapa).
  - **Refresh token nunca é tocado**: `AuthService.refresh()` sempre re-deriva do banco (volta pro
    tenant de casa) - não dá pra fazer o refresh "lembrar" uma sessão trocada sem inventar estado de
    sessão novo no backend. Em vez disso, o frontend guarda qual tenant está "sendo visto" em
    `sessionStorage` (nunca cookie/localStorage - não trafega pra rede, some ao fechar a aba, e é
    limpo explicitamente em `login()`/`logout()` pra nunca vazar entre usuários diferentes na mesma
    aba) e reaplica `switch-tenant` automaticamente logo após todo refresh silencioso.
  - **Gap de isolamento pré-existente corrigido junto**: `assessments.service.ts`'s
    `getOwnedOrThrow(id)` não comparava `tenantId` (só existência) - diferente de todo o resto do
    app (`inventory.service.ts`, `users.service.ts`). Ficaria mais perigoso justo quando "ter um
    `tenantId` diferente no token" vira um caso de uso legítimo em vez de só cenário de erro/ataque.
  - **Segundo tenant de teste (`demo2`) no seed**: deliberadamente enxuto (só tenant + 2 áreas, sem
    questionário/matriz de risco/workflow próprios) - o objetivo era só ter uma organização
    genuinamente separada para provar isolamento, não replicar o seed inteiro. Precisou rodar antes
    da seção que reseta as perguntas do tenant 1 (`question.deleteMany`), porque essa seção já não é
    mais segura de rodar num banco de dev que já tem alguma `Assessment` respondida de verdade (o
    comentário original assumia "nenhuma Assessment é seedada" - válido só na primeira seed).
- **Criar/desativar usuário**: a Etapa H tinha deixado só visualização + atribuição de papel
  (comentário explícito no controller: "sem criar ou desativar usuário"). Agora `/admin/users` tem
  `POST /users` e `PATCH /users/:id/active`, ambos `users:manage`. Sem senha local na criação - só
  SSO just-in-time ou o seed definem `passwordHash` hoje, então um usuário criado por aqui só
  consegue entrar via SSO até um fluxo de "definir senha" existir.
  - **Replicar papéis, pedido explícito do usuário**: o formulário tem um toggle - ligado, esconde
    a lista manual de papéis e mostra um seletor de usuário-referência (reaproveita a lista de
    usuários já carregada na própria página, com `userRoles` inline - zero fetch novo); desligado,
    mostra a lista de papéis do tenant via `Checkbox`. É uma alternativa à lista manual, não um
    complemento - escolher "replicar" ignora qualquer papel marcado manualmente.
  - **Guard de auto-desativação**: `setActive` recebe o id de quem está agindo, não só o tenant,
    especificamente para bloquear um admin desativando a própria conta (erro claro, botão desabilitado
    no frontend com `title` explicando por quê) - sem essa checagem seria possível se auto-trancar
    fora do sistema sem ter outro super-admin/admin pra reverter.
  - **Reaproveitamento total dos helpers existentes**: `create()` de repository já existia (usado só
    pelo provisionamento SSO), a projeção `UserAdminRaw` já retornava `userRoles` inline,
    `assertUserInTenant`/`assertRoleInTenant`/`assignRole` já existiam - o novo `create()` de service
    só orquestra peças já prontas, sem padrão novo. Zero migração de banco.
- **Gestão de papéis (`/admin/roles`)**: `ROLES_MANAGE` estava seedada desde a Etapa 1 e nunca foi
  usada por nenhum endpoint — só existia `GET /roles` (lean, `id`+`name`), consumida por seletores
  em outras telas. Agora tem CRUD completo: criar/editar papel, gerenciar seu conjunto de
  `Permission` (`PATCH /roles/:id/permissions`, substituição total — não add/remove incremental,
  edição de permissão é naturalmente um checklist com um botão "Salvar"), excluir. `GET /roles`
  original fica intocado (endpoints novos vivem em `GET /roles/admin`, `GET /roles/:id`, etc.,
  todos `roles:manage`-only) — os 3+ consumidores existentes continuam funcionando sem mudança.
  - **Achado crítico de schema que definiu os guards de exclusão**: `RolePermission.roleId` é
    `CASCADE` (ok), mas `WorkflowStep.responsibleRoleId` é **`RESTRICT`** (excluir um papel em uso
    numa etapa de workflow estouraria um erro de FK cru sem guard) e `UserRole.roleId` é
    **`CASCADE`** (excluir um papel **desatribuiria silenciosamente** de todo mundo que o tem, sem
    aviso nenhum). `RolesService.remove` checa os dois antes de excluir, com mensagem clara em cada
    caso — nenhum dos dois comportamentos de banco é aceitável exposto direto pela API.
  - **`isSystem` finalmente implementado**: a coluna existe desde a Etapa 2 com um comentário no
    schema prometendo que papéis seedados não podem ser excluídos pela UI, mas nenhum código lia
    esse campo até agora. Bloqueia exclusão e renomeação; edição de permissões continua livre
    (ajustar o que "Administrador" pode fazer é RBAC normal, não deveria exigir recriar o papel).
  - **Replicar permissões**: mesmo padrão exato de `replicateRolesFromUserId` de ontem, aplicado a
    papéis (`replicateFromRoleId` em `CreateRoleDto`) — alternativa à lista manual, não complemento.
  - **Novo `GET /roles/permissions`** (catálogo global) não existia em lugar nenhum — vive no
    próprio `RolesController` por ser o único consumidor. Ordem de declaração dos métodos importa
    aqui: precisou vir antes de `GET /roles/:id` na classe, porque o Nest casa rotas por ordem de
    declaração e o `:id` genérico "engoliria" o path `/permissions` se viesse primeiro.
- **Configurações em abas (`/admin/settings`)**: primeira etapa de um backlog maior (settings
  avançados, dropdown de login, busca rápida, upload de logo, pareceres técnicos, prints do README —
  plano completo fora do repo). `ADMIN_NAV_ITEMS` é uma lista flat sem conceito de agrupamento, e a
  sidebar só suporta um nível de `Collapsible`/`SidebarMenuSub` (usado pelo grupo "Administração"
  inteiro) — em vez de aprofundar o menu pra caber SMTP/SSO/IA, a página `/admin/settings` virou uma
  tela com abas (`Geral`/`SMTP`/`SSO`/`IA`), reaproveitando o componente `Tabs` já usado em
  `dashboards/page.tsx`. `ADMIN_NAV_ITEMS` continua com as mesmas 7 entradas — zero mudança de
  navegação, só a página interna ganhou abas. As 3 abas novas são só placeholder "em construção" por
  enquanto (mesmo padrão de `ComingSoon`, mas com chaves i18n próprias em `AdminSettings.tabs`, já
  que `Admin.nav.*` é metadata de item de menu, não texto de aba de uma página). Zero mudança de
  backend nesta etapa.
- **Dropdown de organização no login + 3 tenants novos completos**: até aqui, `/login` tinha um
  campo de texto livre pra `tenantSlug` (default `"demo"`) - sem forma de descobrir o nome de uma
  segunda organização sem perguntar. Novo endpoint público `GET /tenants/public` (sem autenticação,
  rate-limited a 20/60s, retorna só `{name, slug}[]`, nunca `id`) alimenta um `Select` no lugar do
  campo de texto. `GET /tenants` original (autenticado, `platform:cross-tenant`-only, usado pelo
  seletor de organização do super-admin) fica intocado - são dois endpoints com propósitos e
  superfícies de exposição bem diferentes.
  - **Trade-off aceito de propósito**: expor nome de todas as organizações pré-autenticação vaza a
    lista de clientes pra qualquer visitante em um SaaS de produção real. Aceitável aqui por ser
    projeto de portfólio/demo, não uma base de clientes pagantes - documentado inline no código.
  - **3 tenants novos totalmente seedados** (`zion`, `matrix`, `machine-city`/"Cidade das Máquinas",
    temáticos ao nome do projeto) com a mesma profundidade do tenant `demo` (áreas, RBAC, 21
    perguntas, matriz de risco, workflow de 5 etapas, 1 admin + 1 usuário comum com senha
    conhecida) - login direto pelo dropdown, não só via super-admin switch-tenant como o `demo2`
    (que continua existindo, minimalista, só pra teste de isolamento). Só o admin de `demo` ganha a
    role de super-admin de plataforma - menos contas com `platform:cross-tenant` reduz o raio de
    impacto dessa credencial.
  - **`seedFullTenant()`**: a lógica que antes existia só pra `demo`, inline em `main()`, virou uma
    função parametrizada chamada 4x. Catálogo global (`Permission`, `ControlFramework`/`Control` -
    confirmado via schema que nenhum dos dois tem `tenantId`) segue seedado uma única vez fora da
    função; todo o resto é genuinamente tenant-scoped e existe uma vez por tenant. Mesmos dados de
    questionário/matriz/workflow reaproveitados como consts compartilhadas entre os 4 tenants (é
    conteúdo genérico de risk assessment, não haveria uma versão "mais leve" que fizesse sentido
    autorar à parte).
  - **Achado no processo**: `prisma.question.deleteMany()` (reset de perguntas antes de re-seedar)
    já falhava com violação de FK pra `demo` num banco de dev já usado manualmente (Assessments
    reais referenciando as perguntas) - limitação pré-existente e conhecida. Como isso agora roda
    dentro de uma função chamada pra 4 tenants, um erro não tratado ali bloquearia a seed inteira
    dos 3 tenants novos também. Envolvido num try/catch que detecta especificamente `P2003`
    (violação de FK) e pula o reset nesse caso - o loop de criação de perguntas logo abaixo já é
    idempotente (`existing ?? create`), então pular o delete não quebra nada, só deixa de "resetar"
    um tenant que já tem dado real.
  - Logos dos 3 tenants novos (`apps/web/public/tenant-logos/*.png`, gerados a partir de uma imagem
    única do usuário e recortados nesta sessão) referenciados como `Tenant.logoUrl` estático - ainda
    não há upload real (isso é a próxima etapa do plano), mas já aparecem prontos pra quando a
    tela/PDF passarem a consumir esse campo de verdade.
- **Busca rápida (cmd-k)**: feature 100% nova - `cmdk` como dependência nova,
  `components/ui/command.tsx` (primitiva shadcn, compõe com `@radix-ui/react-dialog` já existente) e
  `components/command-palette.tsx` (o índice de busca, montado uma vez em `AppShell`). Índice é só
  `PRIMARY_NAV_ITEMS` + `ADMIN_NAV_ITEMS` (`@/lib/nav-items.ts`) - não é busca de conteúdo (avaliação,
  usuário, etc.), só atalho pra uma tela que já está no menu. Filtro de permissão usa a mesma lógica
  da sidebar via um helper novo `getVisibleNavItems()` extraído pra `nav-items.ts` (ambas nunca
  divergem sobre o que é visível; `app-sidebar.tsx` foi refatorado pra usar o mesmo helper).
  - **Bug real encontrado na verificação visual, não só um risco teórico**: o filtro padrão do cmdk é
    sensível a diacríticos - digitar "papeis" não encontrava "Papéis". Corrigido com um `filter`
    customizado no componente `Command` (normaliza via `.normalize("NFD").replace(/\p{Diacritic}/gu, "")`
    dos dois lados antes de comparar) - sem isso, o exemplo literal que o usuário deu ao pedir a
    feature ("digito 'papeis' e ele me disponibiliza um botão de acesso rápido") não funcionaria.
  - Atalho global `Cmd/Ctrl+K` registrado uma vez em `AppShell` (`preventDefault()` pra não abrir a
    busca de favoritos do navegador), `Escape` fecha sem navegar.
- **Upload real de logo do tenant**: até aqui `logoUrl` era só um campo de texto livre pra URL
  externa. Agora `POST /tenants/current/logo` (multipart, PNG/JPEG até 2MB) salva via
  `StorageAdapter` em `tenant-logos/{tenantId}/logo.{ext}` (mesmo padrão já usado por
  `TechnicalOpinionService` pro PDF - não pelo módulo de attachments, que é escopado só a
  assessment/inventory) e atualiza `Tenant.logoUrl` pra essa chave; `GET /tenants/current/logo`
  serve os bytes autenticado. `logoUrl` no PATCH JSON (`UpdateTenantDto`) foi removido de
  propósito - só o upload real gerencia esse campo agora.
  - **Duas semânticas possíveis na mesma coluna**: `logoUrl` começando com "/" é um caminho
    estático do Next.js (os 3 tenants novos da Etapa 2 usam isso, `/tenant-logos/{slug}.png`);
    sem "/" é uma chave real de `StorageAdapter`. Um helper `isStorageBackedLogo()` (exportado de
    `tenants.service.ts`) decide qual é qual - o PDF só tenta embutir o segundo tipo, evitando
    acoplar o gerador de PDF (pacote da API) ao filesystem do app Next.js.
  - **Fechei o loop que já existia como stub**: `PdfGeneratorService.renderHeader()` tinha um
    `if (data.logoUrl)` vazio desde etapas antigas - o logo nunca aparecia no parecer técnico de
    verdade. `OpinionPdfData.logoUrl` virou `logoBuffer` (já resolvido pra `Buffer` antes de
    chegar no gerador - PDF não faz I/O), `TechnicalOpinionService.resolveLogoBuffer()` lê via
    `storage.read()` só quando `isStorageBackedLogo`, com try/catch (arquivo removido do storage
    não derruba a emissão do parecer, só cai pro cabeçalho sem logo). `doc.image(buffer, x, y,
    {fit:[...]})` embutido de verdade, confirmado via inspeção dos bytes do PDF gerado
    (`/Subtype /Image` presente).
  - **Bug real e sério encontrado ao testar de verdade (curl), não só nos testes unitários**: todo
    upload de arquivo na API (o attachments existente também, não só este novo) estava quebrado -
    `SanitizationPipe` é um pipe global (`main.ts`) que sanitiza recursivamente qualquer
    `body`/`query`/`params`, e um `Buffer` também é `typeof "object"`. Sem um guard, a recursão
    tratava cada byte de `file.buffer` como uma entrada de objeto (`Object.entries` de um Buffer
    dá pares índice->byte) e devolvia `{0: 137, 1: 80, ...}` no lugar do Buffer real -
    `fs.writeFile` então falhava com `ERR_INVALID_ARG_TYPE`. Corrigido com um guard
    `ArrayBuffer.isView(value)` logo no início do `sanitize()`, antes da recursão genérica de
    objeto. Os testes unitários existentes nunca pegaram isso porque usavam mocks de
    `StorageAdapter`/arquivo, nunca um Buffer de verdade passando pelo pipe real.
  - Frontend: `apiFetch`/`apiFetchBlob` compartilham a mesma lógica de headers/auth/CSRF via um
    `buildRequestInit()` interno (`api-client.ts`) - a única mudança pra suportar upload foi não
    forçar `Content-Type: application/json` quando `body instanceof FormData` (o browser define o
    boundary do multipart sozinho). `useApi().postForm()`/`getBlob()` novos. Página de settings
    (aba Geral): campo de URL virou file picker + preview (caminho estático renderiza direto,
    chave de storage busca via `getBlob` e `URL.createObjectURL`).
- **Verificação visual das telas admin pré-#29** (`/admin/questionnaire`, `/admin/risk-matrix`,
  `/admin/workflow`, `/admin/audit-logs`): essas 4 telas nunca tinham sido vistas num navegador de
  verdade (só curl/lint/build até então). QA com Playwright temporário no scratchpad, login como
  `admin@morpheus.demo`, percorrendo cada tela mais 1-2 interações reais (drill-down em matriz de
  risco e workflow, dialog de editar categoria do questionário, filtro de ação na auditoria).
  - **Bug real encontrado, não só um risco teórico**: a coluna "Ação" da tela de Auditoria
    renderizava o texto bruto da chave de tradução (`AuditLogs.actions.SWITCH_TENANT`) em vez de
    um rótulo, e a opção nem aparecia no filtro - `SWITCH_TENANT` foi adicionado ao enum
    `AuditAction` do schema (feature de troca de tenant por super-admin) mas nunca propagado pro
    tipo/lista `AuditAction`/`AUDIT_ACTIONS` (`audit-log-types.ts`) nem pros mapas de tradução
    (`pt-BR.json`/`en.json`). Corrigido nos 3 arquivos; confirmado via QA que a coluna e o filtro
    agora mostram "Troca de organização" (pt-BR) / "Tenant switch" (en) sem erro de console.
  - As outras 3 telas (questionário, matriz de risco, workflow) renderizam e funcionam
    corretamente - sem bug de código encontrado. Nota à parte, não é bug de código: o banco de dev
    tinha dados órfãos de smoke tests de sessões anteriores (categoria/pergunta "Smoke Test" no
    questionário, "Smoke Test Matriz"/"Matriz Smoke Test" na matriz de risco, "Smoke Test Workflow"
    na tela de workflow) - removidos a pedido do usuário depois de confirmar via script (0
    respostas/`RiskResult`/instâncias de workflow ligados a eles, então seguro apagar de verdade,
    sem sub-rota de DELETE pro recurso inteiro na API - só pros filhos tipo faixas/etapas/opções,
    de propósito, categoria/matriz/workflow usam soft delete via `isActive`). **Achado relevante
    nessa limpeza**: "Smoke Test Matriz" (resíduo v3) tinha virado sem querer a única matriz de
    risco *ativa* do tenant `demo` - novas avaliações estavam calculando risco com os limiares do
    teste, não com "Matriz Padrão". Reativado "Matriz Padrão" via `POST
    /risk-matrix/admin/configs/:id/activate` (endpoint real, não escrita direta no banco) antes de
    apagar os órfãos.
- **Dúvida real do usuário sobre a tela de login, avaliada antes de virar código**: por que
  selecionar outra organização no dropdown de login (Etapa 2) e usar a conta
  `admin@morpheus.demo` dava "Credenciais inválidas"? Investigação: são dois mecanismos
  deliberadamente separados - login (`auth.service.ts`) sempre exige um `User` real *daquela*
  organização (cada tenant novo tem seu próprio admin, `admin@{slug}.morpheus.demo`, mesma senha
  `Demo@12345`); troca de contexto sem senha nova (`switchTenant()`, botão "Organização" na
  sidebar via `org-switcher.tsx`) só existe **depois de logado**, restrita a quem tem
  `platform:cross-tenant`. Decisão (não a alternativa mais ambiciosa de login direto cross-tenant,
  que exigiria buscar usuário por e-mail sem escopo de tenant primeiro - mudança de modelo maior,
  não trivial): manter o comportamento como está e só adicionar um texto de apoio abaixo do
  dropdown (`LoginPage.tenantSlugHint`, pt-BR/en) explicando que login direto exige credenciais
  daquela organização específica, e acesso cross-tenant é via login na organização de origem +
  seletor no topo.
- **Pareceres técnicos: tela de gestão (Etapa 6, fase 1 - listar/filtrar/visualizar/baixar)**: a
  emissão do parecer já funcionava (PDF numerado, QR code, hash, disparado automaticamente pelo
  `WorkflowService` em decisão terminal), mas não existia nenhuma tela pra ver os pareceres já
  emitidos - só download direto por ID ou verificação pública por número. Escopo desta fase,
  deliberadamente restrito (customização de template, aprovação/lifecycle do parecer, geração
  assistida por IA e assinatura digital ficam de fora, sem precedente no schema pra nenhum deles).
  - `GET /technical-opinions` (paginado; filtros `number` (prefixo), `classificationLabel`,
    `issuedById`, `assessmentId`, `from`/`to` sobre `issuedAt`) - **sem permissão nova**: reusa a
    mesma regra que já existia em `assertCanView()` (um parecer só), agora como cláusula `where`
    pra lista inteira em `findAllForTenant()` - com `ASSESSMENTS_VIEW_ALL` ou `ASSESSMENTS_APPROVE`
    vê tudo do tenant, senão só pareceres de avaliações que o próprio usuário solicitou. Mesmo
    padrão de `AssessmentsService.findAllForUser` (`canViewAll ? undefined : user.id`) - não um
    padrão novo.
  - Não existe conceito de "status" no `TechnicalOpinion` (é imutável assim que emitido) - o mais
    próximo é `classificationLabel` (texto livre vindo da matriz de risco do tenant, ex.
    "Homologado"/"Rejeitado"/"Aguardando Ajustes"), por isso o filtro se chama assim e não
    `status`, pra não sugerir um ciclo de vida que não existe.
  - Tela nova em `/technical-opinions` (fora de `/admin/`, de propósito - um usuário comum sem
    `ASSESSMENTS_VIEW_ALL`/`ASSESSMENTS_APPROVE` ainda vê os próprios pareceres; a visibilidade
    real é resolvida no backend, não por um gate de permissão fixo como `AdminSectionGate`).
    Entrada nova em `PRIMARY_NAV_ITEMS` sem `permission` (mesmo raciocínio). Botão "Baixar" usa
    `api.getBlob()` (já existia desde a Etapa 4) + um `<a download>` temporário com
    `URL.createObjectURL` - primeira vez que esse padrão de download-pro-disco aparece no app
    (Etapa 4 só tinha usado `getBlob` pra preview inline, nunca pra salvar arquivo).
  - Validado via curl real: listagem, filtro por prefixo de número, filtro por classificação sem
    resultado, download retornando `application/pdf`, 401 sem token. Confirmado também que os 3
    pareceres já existentes no banco de dev (resíduo de smoke tests de sessões anteriores) foram
    todos solicitados pelo mesmo usuário de teste - então o resultado idêntico entre admin e
    usuário comum nesse ambiente é coincidência dos dados, não um teste vazio de visibilidade; a
    regra em si já está coberta por 4 testes unitários novos que verificam a cláusula exata
    passada ao repository por combinação de permissão.
- **README: prints atualizados + seção sobre documentação Swagger (Etapa 7)**: rodada por último de
  propósito, depois de todas as etapas que mudam layout visualmente. Prints antigos (só 4 telas de
  dashboard, capturados antes da Etapa 1) recapturados via o mesmo padrão de Playwright temporário
  no scratchpad já usado nas etapas anteriores - agora refletem a sidebar atual (item "Pareceres
  técnicos", seletor "Organização"). Três prints novos: seleção de organização no login (Etapa 2),
  busca rápida já demonstrando o fix de diacríticos ("papeis" encontrando "Papéis", Etapa 3) e
  gestão de papéis em `/admin/roles` (PR #29, nunca tinha aparecido no README). Confirmado antes de
  escrever o texto que `@nestjs/swagger` já está configurado (`main.ts`) servindo em `/docs` com
  Bearer auth - não assumido, checado. Parágrafo novo (pt-BR/en) explicando que a documentação da
  API é gerada automaticamente do código, não mantida à parte, pensada pra futuras integrações;
  sem criar um `docs/API.md` separado - o Swagger interativo em `/docs` já cumpre esse papel, um
  markdown paralelo só duplicaria manutenção.
- **Visualizar parecer técnico em PDF direto no navegador** (primeiro item de um backlog novo de
  ideias trazido pelo usuário após uso real do sistema - escolhido de propósito por ser o
  menor/mais isolado do grupo, entre inventário como módulo dedicado, campos customizados de API,
  vínculo parecer↔inventário, fluxo de aprovação de ativo manual, FAQ, exportação e
  ART/cláusula de segurança de terceiros). Botão "Visualizar" novo ao
  lado do "Baixar" já existente (Etapa 6), reaproveitando o mesmo `GET
  /technical-opinions/:id/download` - nenhuma mudança de backend.
  - **Duas abordagens tentadas e descartadas antes da que funcionou, via QA real (não assumido)**:
    (1) `window.open("", "_blank")` síncrono seguido de `newTab.location.href = objectUrl` depois
    do `await` do fetch - a aba abria mas nunca navegava, ficava presa em `about:blank`. (2) `<a
    target="_blank">` sintético (mesmo padrão do botão "Baixar", só trocando `download` por
    `target="_blank"`) - mesmo resultado. As duas esbarram na mesma restrição do Chromium: navegar
    uma *outra* janela/aba pra uma URL `blob:` criada depois, num contexto de navegação diferente
    de onde ela foi criada, é bloqueado (proteção contra blob URLs vazando entre abas). Solução
    final: abrir o PDF num `<iframe>` dentro de um `Dialog` (shadcn) na própria página - iframe não
    esbarra nessa restrição por não ser uma navegação de topo pra outro contexto.
  - Validado via curl (endpoint já teria sido validado na Etapa 6) e Playwright: `src` do iframe
    confirmado como `blob:...` depois do clique, sem erro de console, dialog fecha corretamente via
    botão "X" e clique fora - `Escape` especificamente **não** fecha o dialog quando o foco está
    preso dentro do iframe (limitação conhecida de iframes: eventos de teclado não sobem pro
    documento pai), aceito como comportamento esperado já que "X" e clique fora cobrem o caso.
    Renderização visual do PDF em si não foi possível conferir via Playwright headless (mesma
    limitação já documentada na Etapa 5 pro parecer com logo - Chromium headless não renderiza o
    plugin de PDF) - `src` correto + ausência de erro é a evidência disponível dentro dessa
    limitação de ferramental.
- **Vincular item do inventário ao parecer técnico de homologação** (segundo item do backlog trazido
  pelo usuário após uso real - avaliado antes com um agente de pesquisa read-only: era o de menor
  esforço isolado dentre os 5 itens do bloco "inventário como módulo de verdade", zero migration).
  `SoftwareInventoryItem.assessmentId` já era opcional desde sempre - a modelagem já previa itens
  sem homologação, só faltava expor o vínculo com o parecer de verdade.
  - Backend: `itemDetailInclude` (`inventory.repository.ts`) ganhou um include aninhado
    `assessment.versions` (`orderBy: createdAt desc, take: 1`) `.technicalOpinion` - Prisma resolve
    "a versão mais recente da avaliação" numa query só, sem N+1. `InventoryService` achata isso num
    campo `technicalOpinion: {id, number, classificationLabel, issuedAt} | null` antes de devolver
    pro controller (`attachTechnicalOpinion()`) - a API não deveria expor a rota de navegação do
    schema (`assessment.versions[0].technicalOpinion`), só o resultado. Aplicado em `list`,
    `getById`, `create` e `update` (não em `createFromApprovedAssessment`, cujo retorno nunca é
    exposto via HTTP - só usado internamente pelo `WorkflowService`).
  - Frontend: coluna nova "Parecer" na listagem e campo novo "Parecer técnico" no detalhe, os dois
    como link pra `/technical-opinions?number=...` quando existe, "—"/texto explicando "entrada
    manual" quando não. A página de pareceres técnicos (Etapa 6) não lia nenhum parâmetro de URL
    até aqui - ganhou leitura do `number` via `useSearchParams()` na montagem (só uma vez, via
    inicializador preguiçoso do `useState`), senão o link prometeria um filtro que não aplicava
    nada de verdade ao chegar lá.
  - Validado via curl real (`technicalOpinion` populado pro item vindo de homologação, `null` pro
    de entrada manual) e Playwright: clicar no número do parecer no detalhe do inventário chega em
    `/technical-opinions` com o campo "Número" já preenchido e a lista já filtrada pra 1 resultado.
- **Painel de Ajuda / FAQ** (terceiro item do backlog pós-uso - standalone, sem dependência de
  nenhum outro módulo, escolhido como sequência natural depois do vínculo inventário↔parecer).
  Conteúdo 100% estático (5 seções - Avaliações, Aprovações, Inventário, Pareceres técnicos, Conta e
  organização - com 2 a 3 perguntas cada), sem nenhuma mudança de backend.
  - `apps/web/src/components/ui/accordion.tsx` novo - primeiro uso de `Accordion` no projeto
    (`radix-ui` unificado, já era dependência existente por causa do `Collapsible`; `tw-animate-css`,
    já importado em `globals.css`, já traz as keyframes `accordion-down`/`accordion-up` que o
    padrão shadcn espera, então não precisou de CSS novo).
  - `/faq` (`apps/web/src/app/[locale]/faq/page.tsx`) - item novo em `PRIMARY_NAV_ITEMS`
    (`nav-items.ts`), sem `permission` (visível a qualquer usuário autenticado, mesmo padrão de
    `/dashboards`). Conteúdo é uma lista fixa em TS de `{sectionKey, icon, questionKeys[]}` -
    cada seção vira um `Card` com um `Accordion` dentro; perguntas/respostas vêm de chaves i18n
    (`Faq.sections.<key>.q<n>Question`/`q<n>Answer`), não de `t.raw()` (sem precedente disso no
    projeto) - adicionar uma pergunta nova é só estender `questionKeys` + as duas chaves de texto.
  - Como o item entra em `PRIMARY_NAV_ITEMS`, ele aparece de graça na busca rápida (Etapa 3,
    `cmdk`) sem nenhuma mudança no `command-palette.tsx` - as duas fontes de navegação (sidebar e
    palette) já compartilham a mesma lista.
  - Validado via `build`/`typecheck`/`lint` limpos e Playwright: as 5 seções renderizam em pt-BR e
    en, o accordion abre e fecha (conteúdo visível → clique → oculto → clique → visível de novo),
    e digitar "ajuda" na busca rápida encontra e navega pra "Ajuda / FAQ".
- **Links de documentação por item de inventário** (quarto item do backlog pós-uso - início do
  cluster "inventário como módulo de verdade". Pedido original do usuário: "customização em caso de
  APIs, como não é algo tão palpável" - ter onde anexar link do épico no Jira, do Swagger/OpenAPI,
  etc). Modelo novo `InventoryDocumentationLink` (1:N com `SoftwareInventoryItem`, `label` + `url`),
  migration `add_inventory_documentation_links`. Não restrito por `type` no schema/backend (um item
  de qualquer tipo pode ganhar links) - só a UI esconde a seção fora de `API_INTEGRATION`, que é o
  caso de uso motivador.
  - Backend: `InventoryRepository.setDocumentationLinks()` substitui a lista inteira a cada save
    (`$transaction([deleteMany, createMany])`, mesmo padrão de `RolesRepository.setPermissions`) -
    não há edição pontual de um link. `create()` usa nested `create` do Prisma direto. DTOs novos
    (`DocumentationLinkDto`, `IsUrl({require_protocol:true})`, `ArrayMaxSize(10)`) compartilhados
    entre create/update.
  - Frontend: primeiro uso de `useFieldArray` fora do editor de perguntas do questionário (mesmo
    padrão de `QuestionCreateDialog` - `append`/`remove`/`fields.map`). Seção "Links de
    documentação" só renderiza quando `useWatch({name:"type"}) === "API_INTEGRATION"` no formulário
    - trocar o tipo não apaga os links já digitados (só esconde a seção), evitando perda de dado
    por toggle acidental.
  - **Bug pré-existente encontrado e corrigido durante QA, sem relação com esta feature**: o
    formulário de edição de item de inventário mandava `homologationDate` em todo PATCH, mas
    `UpdateInventoryItemDto` nunca teve esse campo (é um fato histórico da homologação original -
    só `nextReviewDate`, o ciclo de revisão, é editável). Com `forbidNonWhitelisted: true` no
    `ValidationPipe` global, isso rejeitava **qualquer** save do dialog de edição com 400 ("property
    homologationDate should not exist") - achado ao testar o fluxo completo de editar/remover um
    link via Playwright, não fazia parte do pedido original. Corrigido no frontend: o payload de
    PATCH omite `homologationDate`; o campo agora aparece desabilitado no modo edição, com um texto
    explicando que é imutável.
  - Validado via curl real (create com 2 links, replace parcial, clear total, PATCH de outro campo
    não mexe nos links, URL inválida rejeitada com 400) e Playwright (seção aparece/some conforme o
    tipo, adicionar/remover link, criar → editar → remover um link → salvar → detalhe reflete só o
    link restante). Testes novos em `inventory.service.spec.ts` cobrindo `create()`/`update()` com
    `documentationLinks`.
- **Exportar inventário (CSV/JSON)** (quinto item do backlog pós-uso). `GET /inventory/export`
  reaproveita os mesmos filtros de `GET /inventory` (`status`, `areaId`) só que sem paginação -
  devolve todas as linhas que baterem com o filtro atual da tela. PDF fica de fora de propósito
  (o pedido do usuário incluía os três formatos, mas CSV/JSON já cobrem o caso de uso de planilha/
  integração; um PDF de relatório teria motivação e forma diferentes, mais parecido com o parecer
  técnico do que com uma exportação tabular - avaliar como item separado se pedido).
  - Sem lib de terceiros pro CSV (nenhuma no repo - `csv-stringify`/`json2csv` etc. - mesmo
    minimalismo já usado no PDF do parecer, que usa `pdfkit` direto sem wrapper): escrita manual
    com escaping RFC 4180 (`inventory-export.util.ts`). BOM UTF-8 na frente do CSV - sem isso o
    Excel, consumidor mais provável de um CSV em pt-BR, interpreta acentos como Latin-1 e corrompe
    "Área", "não", etc.
  - Rota `@Get("export")` precisou ser declarada **antes** de `@Get(":id")` no controller - senão
    o Nest bate `:id` primeiro e tenta buscar um item cujo id é literalmente `"export"`. Resposta
    via `@Res({passthrough:false})` + `res.set()`/`res.send()`, mesmo padrão já usado no download
    de PDF do parecer técnico (`TechnicalOpinionController.download`) - não `StreamableFile`, since
    o volume de um inventário de demo não justifica streaming de verdade.
  - `InventoryService` passou a injetar `AuditLogService` diretamente (`AuditLogModule` é
    `@Global()`, não precisou tocar em `inventory.module.ts`) para registrar o export como
    `DOWNLOAD` no audit log (mesmo padrão manual do `getPdfForDownload` do parecer técnico - não dá
    pra usar o decorator `@Audit()` porque a resposta sai via `@Res()` cru, fora do fluxo que o
    interceptor de auditoria enxerga). Não existe um valor `EXPORT` no enum `AuditAction` do schema
    - reaproveitado `DOWNLOAD` (mesma semântica de "usuário levou um arquivo pra fora do sistema")
    em vez de abrir uma migration só por um rótulo mais específico.
  - Frontend: dropdown "Exportar" (`DropdownMenu`) do lado de "Novo item", com as duas opções -
    disponível pra qualquer usuário com `inventory:view` (não fica atrás de `canManage`, mesmo
    escopo de permissão do backend). Reaproveita o `status` já selecionado nos filtros da tela.
  - Validado via curl (headers `Content-Type`/`Content-Disposition` corretos nos dois formatos,
    BOM presente nos bytes do CSV, filtro por `status` aplicado, 401 sem token) e Playwright
    (`page.waitForEvent("download")` nos dois formatos, nome de arquivo sugerido, conteúdo
    baixado batendo com o filtro ativo na tela). Testes novos em `inventory.service.spec.ts`
    cobrindo `exportItems()`.
- **ART/cláusula de segurança da informação do fornecedor** (sexto e último item do backlog pós-uso
  processado nesta rodada - pedido original: _"Tudo que for contrato de terceiros, deve ter uma
  opção de constar existe ART (Análise de Riscos) e também cláusula de segurança da informação
  assinado. Faz parte do fluxo de avaliação de fornecedores."_). Escopo definido com o usuário antes
  de implementar (backlog trazia só a ideia, sem desenho): os dois campos vivem no `Assessment`
  (fato sobre a relação com o fornecedor, declarado na origem do fluxo, não no item de inventário
  pós-homologação), são só declaração sim/não (sem upload de arquivo dentro do sistema - "isso pode
  ser feito por fora"), e precisam aparecer **em destaque no painel do aprovador**, não só no
  formulário de criação - pra que o aprovador pense "ok, ele disse que tem, agora ele precisa me
  mostrar de alguma forma" antes de decidir.
  - `Assessment.hasRiskAnalysis`/`hasInfoSecClause` (`Boolean @default(false)`, migration
    `add_assessment_vendor_compliance_flags`) - fatos diretos do fornecedor, não pergunta pontuada
    do questionário de risco (que é um subsistema à parte, orientado a score/matriz de risco) -
    por isso viram campo direto no model, no mesmo padrão de `linkedTicket`/`installerFileHash`, e
    não uma `Question` nova. `@default(false)` só pra migration não travar em linhas já existentes -
    o `CreateAssessmentDto` exige os dois campos (`@IsBoolean()`, sem `@IsOptional()`), então toda
    avaliação nova precisa declarar os dois de propósito, não fica sujeita ao default silenciosamente.
  - `WorkflowRepository.findPendingStepsForRoles()` (a query por trás de `GET /workflow/inbox`)
    tinha um `select` bem enxuto no `assessment` aninhado (`id`, `softwareName`, `criticality`,
    `requesterId`) - estendido com `vendor`, `hasRiskAnalysis`, `hasInfoSecClause` pra chegar até o
    dialog de decisão do aprovador.
  - Frontend: dois `Checkbox` novos em "Nova avaliação", agrupados num bloco "Conformidade do
    fornecedor" com texto de apoio. No `DecisionDialog` de `/approvals`, um bloco destacado logo
    abaixo do `DialogHeader` (antes do formulário de decisão) mostra fabricante + os dois badges
    (verde "Sim"/vermelho "Não") + um lembrete de que é autodeclarado. Mesmos dois badges também no
    detalhe da avaliação (`/assessments/[id]`).
  - Validado via curl (400 ao criar sem os dois campos, valores persistidos e devolvidos
    corretamente) e um fluxo Playwright de ponta a ponta montado via `fetch` direto na API pra
    contornar o questionário de 21 perguntas (criar avaliação → responder todas as perguntas →
    submeter → aparece na fila do aprovador) seguido de navegação real no browser: seção de
    conformidade visível no formulário, dialog de decisão mostrando "Fabricante: ...", "ART: Sim"
    (verde), "Cláusula de segurança da informação: Não" (vermelho), e os dois campos no detalhe da
    avaliação. Teste novo em `assessments.service.spec.ts` cobrindo `create()`.
- **Módulo de inventário de verdade** (item 1 do backlog pós-uso, o maior restante - dashboards +
  filtros por campo/tipo, cobrindo também os ativos que nunca passaram por homologação). Escopo
  definido com o usuário via `AskUserQuestion` antes de implementar: quais gráficos entrar (visão
  geral por status/criticidade/tipo, homologado x manual, revisões vencidas/a vencer, por área/
  provedor de hospedagem, cobertura de ART/cláusula) e quais filtros novos (área, tipo, criticidade,
  origem, ART, cláusula). Isso levou a mais uma decisão de escopo: os campos `hasRiskAnalysis`/
  `hasInfoSecClause` (Etapa "declaração de ART e cláusula InfoSec", acima) existiam só no
  `Assessment` - itens de entrada manual não tinham como declarar isso. Confirmado com o usuário:
  os mesmos dois campos foram replicados no `SoftwareInventoryItem` (migration nova,
  `@default(false)`), com uma regra de negócio nova - **somente leitura quando o item vem de
  homologação** (herdado do `Assessment` na criação via `createFromApprovedAssessment`, evita
  divergência entre os dois registros), e **editável só em itens de entrada manual**.
  - Backend: `InventoryService.update()` ganhou um guard - `ForbiddenException` se o payload tentar
    mudar `hasRiskAnalysis`/`hasInfoSecClause` num item com `assessmentId` setado. `ListInventoryQueryDto`/
    `ExportInventoryQueryDto` ganharam `type`/`criticality`/`origin` (`HOMOLOGATED`/`MANUAL`, deriva
    de `assessmentId` null/not-null)/`hasRiskAnalysis`/`hasInfoSecClause` (`@IsBooleanString()`,
    convertidos pra boolean no service antes de chegar no repository - evita a pegadinha de
    `Boolean("false") === true`). `InventoryRepository` ganhou um `buildWhereClause()` compartilhado
    entre `findMany`/`findAllMatching` (list e export usam exatamente os mesmos filtros, sem
    duplicar a lógica de `where`) e um `getStats(tenantId, reviewDueSoonDays)` novo com 14 queries
    em paralelo (`Promise.all` de `groupBy`/`count`) - endpoint `GET /inventory/stats`, sempre do
    tenant inteiro (sem os filtros da listagem, é uma visão geral). `CreateInventoryItemDto` exige
    os dois campos (sem `@IsOptional`), `createFromApprovedAssessment` (e o branch defensivo de
    "já existe, atualiza") passam a herdar os valores do `Assessment` de origem.
  - Frontend: `/inventory` virou `Tabs` "Lista"/"Visão geral" (`InventoryListView`/
    `InventoryDashboardView`, extraídos como componentes próprios - o `page.tsx` ficou só o
    cabeçalho + as duas abas). Filtros novos como `Select`s numa grade 4 colunas dentro do card
    "Filtros" (Área/Tipo/Criticidade numa linha, Origem/ART/Cláusula na seguinte), + botão "Limpar
    filtros" quando algum está ativo. Coluna nova "Conformidade" na tabela com dois badges compactos
    (ART/InfoSec, verde quando `true`). `ItemFormDialog` ganhou os dois checkboxes de conformidade -
    condicionalmente: se `mode === "edit" && item.assessmentId`, vira dois badges somente leitura
    com texto explicando a herança, em vez de checkbox editável (e o payload de PATCH omite os dois
    campos por completo nesse caso - mesmo cuidado já visto no `homologationDate`, o backend rejeita
    a request inteira se os campos chegarem, não só ignora o valor).
  - Dashboard (`InventoryDashboardView`) segue a skill de dataviz: dimensões com significado bom/ruim
    (status do ativo, criticidade, ART/cláusula) usam os tokens de status (`--chart-good/warning/
    serious/critical`) via um helper novo (`lib/inventory-dashboard-colors.ts`); dimensões sem
    significado bom/ruim (origem, tipo, área, provedor de hospedagem) usam um hue categórico único
    (`--chart-1`) sem colorir por barra - **bug real encontrado e corrigido durante o QA**: o
    componente `HorizontalBarChart` compartilhado não tinha um `fill` de fallback no `<Bar>` quando
    nenhum `colorFor` era passado, então essas barras caíam no `fill` herdado da cascata CSS (preto)
    em vez de uma cor de verdade - corrigido replicando o padrão exato já usado em
    `admin-dashboard-view.tsx` (`fill="var(--chart-1)"` direto no `<Bar>`).
  - **Limitação de ferramental confirmada durante o QA, não um bug**: screenshots via Playwright
    (headless *e* com janela real) não mostram as barras dos gráficos Recharts neste ambiente,
    mesmo com espera generosa pela animação - confirmado que isso **já afeta o dashboard existente**
    (`/dashboards`, não tocado nesta etapa) do mesmo jeito, então não é uma regressão introduzida
    aqui. Verificação feita por inspeção estrutural do DOM em vez de captura visual: `fill`, `width`
    e `height` de cada `<path>` de barra conferem exatamente com os dados reais devolvidos por
    `GET /inventory/stats` (larguras proporcionais às contagens, cores semânticas corretas por
    dimensão) nos 8 gráficos.
  - Validado via curl (400 ao criar item manual sem os dois campos; edição de ART em item manual
    aceita com 200; edição de ART em item homologado rejeitada com 403; filtros combinados
    `origin`+`type`+`criticality`+`hasRiskAnalysis` retornando exatamente o subconjunto esperado) e
    um fluxo de ponta a ponta via `fetch` (solicitante diferente do aprovador, por causa da
    Separação de Funções - `admin` não pode aprovar a própria avaliação) confirmando que o item de
    inventário criado automaticamente na aprovação herda `hasRiskAnalysis`/`hasInfoSecClause` do
    `Assessment` de origem. Testes novos em `inventory.service.spec.ts` cobrindo o guard de
    somente-leitura e `getStats()`. Suite completa da API: 175/175 testes passando.
- **Dados de exemplo variados no inventário** - depois de mesclar o módulo de inventário, o usuário
  testou os filtros novos e percebeu que ART/Cláusula só retornavam resultado com "Todos"/"Não": o
  banco de dev não tinha nenhum item com esses campos em `true` nem variedade de área. Populado via
  API (não no `seed.ts` - decisão do usuário, "só no banco atual", não precisa ser reproduzível a
  cada `pnpm seed`) - 7 itens manuais cobrindo as 7 áreas do tenant `demo`, tipos/criticidades/
  provedores de hospedagem variados, e 2 avaliações completas aprovadas de ponta a ponta (fluxo real
  de homologação, não inserção direta no banco) pra também variar a origem homologado x manual.
- **Aprovação em massa + histórico de decisões visível** (dois pedidos feitos juntos pelo usuário
  depois de usar o painel de aprovações reais: 2.1 "deve conter um botão de aprovação em massa,
  podendo selecionar quais devem receber a decisão", 2.2 "onde que vai a informação de comentário da
  decisão? Ela deve ir para os itens aprovados em algum lugar, certo?"). Escopo do item 2.1
  confirmado com o usuário antes de implementar: uma decisão só aplicada a todos os selecionados
  (não decisão individual por item agrupada no envio).
  - **2.2 era uma lacuna real, não só uma pergunta** - investigado antes de responder: o comentário
    de uma decisão (`WorkflowStepExecution.comments`) só aparecia em UM lugar do sistema, o PDF do
    parecer técnico gerado (`PdfGeneratorService`) - nenhuma tela do app mostrava o histórico depois
    que a etapa saía de "pendente". Descoberta relevante: `GET /workflow/assessments/:assessmentId`
    já existia no backend (`WorkflowService.getInstanceForUser`, com autorização própria já pronta -
    `view-all`, `approve`, ou o próprio solicitante) mas **nunca tinha um consumidor no frontend** -
    fechar essa lacuna foi só trabalho de tela: `WorkflowHistorySection` novo
    (`apps/web/src/app/[locale]/assessments/_components/`), embutido no detalhe da avaliação entre
    o aviso de "não editável" e o questionário, mostrando cada etapa (nome, badge de status, quem
    decidiu, quando, e o comentário).
  - **2.1**: `BulkDecideStepsDto` novo (`stepExecutionIds[]`, mesma `decision`/`comments` de
    `DecideStepDto`). `WorkflowService.bulkDecideSteps()` reaproveita `decideStep()` item a item
    (não duplica SoD/papel responsável/efeitos colaterais de aprovar-reprovar) dentro de um
    try/catch por item - uma etapa que falha (SoD, já decidida por outra pessoa nesse meio tempo)
    não derruba as demais, só entra no resultado como falha (`{stepExecutionId, success, error?}[]`).
    `POST /workflow/steps/bulk-decide` novo (sem conflito de rota com `steps/:stepExecutionId/decide`
    - tamanhos de path diferentes, ao contrário do caso `:id` vs. literais do inventário).
  - Frontend: checkbox por linha + "selecionar todas" no cabeçalho em `/approvals`
    (`stopPropagation()` no `<TableCell>` do checkbox pra não abrir o dialog de decisão individual
    ao clicar nele, já que a linha inteira também é clicável). Botão "Decidir selecionados (N)"
    aparece só com 1+ selecionados, abre `BulkDecisionDialog` novo (mesmo formulário do dialog
    individual, mas listando todos os itens selecionados e mostrando um toast de sucesso total ou
    parcial no final, removendo da lista só os que tiveram sucesso).
  - Validado via curl (3 avaliações reais aprovadas em lote, mais um id inválido de propósito pra
    confirmar falha parcial isolada sem derrubar as demais; endpoint de histórico confirmado com
    uma avaliação de 5 etapas todas decididas, comentários batendo) e Playwright (seleção de linhas
    específicas sem tocar nas demais, dialog de decisão em massa, toast de sucesso, seção de
    histórico renderizando badge/autor/data/comentário por etapa). Testes novos em
    `workflow.service.spec.ts` cobrindo `bulkDecideSteps()` (sucesso em lote e falha parcial).
    Suite completa da API: 177/177 testes passando.
- **Validação de duplicidade no cadastro manual de inventário** - item 3 do mesmo lote de feedback
  acima ("no momento que a pessoa digitar o nome de um software, deve existir uma pesquisa ativa pra
  saber se já foi homologado e não deixar a jornada de inserção seguir, pra evitar duplicidade").
  Escopo confirmado com o usuário via AskUserQuestion antes de implementar: a regra vale só dentro da
  mesma área (`areaId`), qualquer origem (homologado ou manual) - áreas diferentes podem legitimamente
  ter o mesmo software sob contratos/administração distintos, então não bloqueia entre áreas; UX
  combina busca ao digitar (debounced) com bloqueio duro no submit.
  - `GET /inventory/check-duplicate?name=&areaId=` novo (rota literal antes de `:id`, mesmo cuidado
    de ordenação já usado por `stats`/`export`), gated por `inventory:manage` (mesma permissão exigida
    pra criar um item). Match é case-insensitive e ignora espaços nas pontas
    (`name: { equals: name.trim(), mode: "insensitive" }` no Prisma) - sem paginação nem lista de
    múltiplos resultados, só o primeiro match (`findFirst`) já que a regra é binária (existe ou não).
  - Frontend (`ItemFormDialog`, só no modo `create` - editar um item já existente sempre "bateria"
    consigo mesmo): `useWatch` em `name`/`areaId`, debounce de 400ms via `setTimeout`/`clearTimeout`
    dentro do próprio `useEffect` de dependência, chamando o endpoint novo. Quando encontra match,
    mostra um aviso inline (nome/fabricante/status/origem do item existente) e desabilita o botão
    "Salvar". Guarda contra corrida entre o debounce e um submit muito rápido: `onSubmit` refaz a
    mesma checagem de forma síncrona logo antes do POST e aborta com toast de erro se encontrar
    duplicidade, mesmo que o aviso visual ainda não tivesse aparecido.
  - Validado via curl (nome idêntico com case/espaços diferentes na mesma área retorna o match; nome
    sem correspondência retorna `null`; mesmo nome em área diferente retorna `null`, confirmando que
    a regra não vaza entre áreas) e Playwright (preencher área + nome de um item já existente faz o
    aviso aparecer e o botão "Salvar" desabilitar; trocar pra uma área sem conflito limpa o aviso e
    reabilita o botão).
  - **Extensão pra tela de solicitação de avaliação** - perguntado ao usuário logo depois do merge
    ("este match acontece na tela de cadastro manual ou no momento da solicitação da avaliação?"):
    confirmado que também deveria valer em `/assessments/new`, pra evitar pedir homologação de algo
    que já está no inventário da mesma área (homologado ou manual). Mesmo endpoint
    (`GET /inventory/check-duplicate`) reaproveitado - mas a permissão da rota precisou ser relaxada:
    tinha `inventory:manage` (certo pro cadastro manual, que exige essa permissão pra criar), só que
    quem solicita uma avaliação normalmente só tem `assessments:create` + `inventory:view` (não
    `inventory:manage`). Como a rota é só leitura e sem efeito colateral, a correção foi remover o
    `@RequirePermissions` extra e deixar só o `inventory:view` já herdado do controller - ambos os
    papéis (solicitante e quem gerencia inventário) têm essa permissão no seed padrão. Frontend
    (`assessments/new/page.tsx`, formulário com `useState` puro, sem `react-hook-form`) replica o
    mesmo padrão de debounce 400ms + aviso inline + bloqueio do botão de submit + checagem síncrona
    final antes do POST.
  - Validado via curl (usuário sem `inventory:manage`, só `assessments:create`, agora recebe 200 em
    vez de 403) e Playwright com a conta de solicitante (`usuario@morpheus.demo`): aviso aparece e
    botão desabilita ao preencher um nome já existente na área Financeiro; digitar um nome novo limpa
    o aviso e reabilita o botão.
- **Caixa de busca rápida visível no header** - o cmd-k (Etapa 3 do plano `streamed-sleeping-newell.md`)
  já existia, mas só como atalho de teclado implícito - o usuário percebeu que precisa de um "modo
  visual" também: "uma pequena caixa ao lado do sidebar com um icone pequeno de 'lupa', e um texto
  transparente escrito 'Busca rápida CTRL + K'", os dois modos coexistindo.
  - `CommandPalette` deixou de gerenciar seu próprio `open` (`useState` interno) e passou a receber
    `open`/`onOpenChange` como props - precisava, já que agora existem dois jeitos de abrir a mesma
    paleta (atalho de teclado e o clique na caixa visível) e os dois precisam controlar a mesma
    instância, não duas independentes.
  - Caixa nova em `AppShell` (não dentro do `AppSidebar`) - decisão de posicionamento: "ao lado do
    sidebar" leu-se como o header, logo depois do `SidebarTrigger`/separador, não como mais um item
    dentro do menu lateral. Isso também evita ter que lidar com o modo `collapsible="icon"` da
    sidebar (a caixa fica sempre visível, independente do estado de colapso do menu). Visual: ícone
    de lupa + texto "Busca rápida" (reaproveita `CommandPalette.title`, já existente) + par de `<kbd>`
    "Ctrl"/"K" à direita, escondido abaixo do breakpoint `sm` pra não quebrar em mobile.
  - Validado via Playwright: clique na caixa abre a paleta, Escape fecha, Ctrl+K abre a mesma
    instância (não uma segunda), filtro por texto ("papeis") funciona normalmente; screenshots em
    3 larguras (desktop, 900px, 390px) confirmando que não quebra layout em nenhuma.
- **Renovação anual de homologação - Fase 1: schema + máquina de estados central** (feature grande,
  planejada em sessão dedicada de escopo com o usuário via `AskUserQuestion`/plan mode - plano completo
  em `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md`, 6 fases). Fase 1 não tem gatilho
  automático ainda (isso é Fase 3) - só deixa a máquina de estados pronta pra quando o scheduler
  existir.
  - Schema: `AssessmentStatus` ganhou `PENDING_RENEWAL`; `Assessment` ganhou `renewalDueAt`/
    `renewalCycleStartedAt` (nulos exceto durante o ciclo); `Tenant` ganhou
    `annualClosingWindowStart`/`...End`/`...Enabled` (usados só a partir da Fase 2, mas migrados agora
    - decisão do plano de fazer uma migration só, no início); `NotificationType` ganhou
    `RENEWAL_PENDING`/`RENEWAL_OVERDUE`; `SoftwareInventoryItem` ganhou o índice composto
    `[tenantId, areaId, status]` (vai sustentar a checagem de área bloqueada da Fase 4 -
    `EXISTS(...status='EXPIRED')`, sem precisar de um campo `Area.isBlocked` novo).
  - `EDITABLE_STATUSES` em `AssessmentsService` ganhou `PENDING_RENEWAL` - uma avaliação em renovação
    fica editável/reenviável pelo solicitante original de novo, reusando a MESMA
    `AssessmentWorkflowInstance` (schema já tinha um comentário dizendo que reaberturas deveriam
    reusar a mesma instância - nunca tinha sido implementado até agora). `submit()` ganhou um terceiro
    `changeReason` ("Renovação anual") e chama `workflowService.startWorkflow()` normalmente - **zero
    mudança** na inbox de aprovações (`GET /workflow/inbox`), nos dialogs de decisão, ou no
    bulk-decide, confirmado via curl (etapa nova da renovação aparece na inbox do papel responsável
    sem nenhuma alteração nesses endpoints).
  - `update()` bloqueia troca de `areaId` enquanto `status === "PENDING_RENEWAL"` (evita burlar o
    bloqueio de área que a Fase 4 vai implementar, só reatribuindo a avaliação pra outra área).
  - `InventoryService.createFromApprovedAssessment()`: o branch `if (existing)` - até agora nunca
    exercitado em produção, já que `APPROVED`/`REJECTED` nunca eram reenviáveis - passa a também
    resetar `nextReviewDate` (+12 meses) e `status: "ACTIVE"` na aprovação de uma renovação, mesmo que
    o item estivesse `EXPIRED`. É a decisão #7 do plano inteira, num branch de baixo risco.
  - Validado via testes novos (`assessments.service.spec.ts`, `inventory.service.spec.ts` - edição/
    reenvio só pelo solicitante original, bloqueio de troca de área, reset de `nextReviewDate`/status
    na renovação) e um fluxo manual completo via curl + SQL direto: flipou uma avaliação `APPROVED`
    real pra `PENDING_RENEWAL`, confirmou edição/reenvio pelo dono (200), bloqueio pra outro usuário e
    pra troca de área (403 nos dois), reenvio bem-sucedido reabrindo o workflow (versão nova `v1.1`,
    `changeReason` "Renovação anual"), e a etapa nova aparecendo na inbox do aprovador sem nenhuma
    mudança de código nesse endpoint - depois revertido pro estado original (dado de amostra
    compartilhado).
    Suite completa da API: 182/182 testes passando.
- **Renovação anual de homologação - Fase 2: configurações de organização (janela de fechamento)**
  (mesmo plano, `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md`). Só a tela +
  persistência das 3 datas por tenant - nenhum scheduler ainda usa esses valores (isso é Fase 3).
  - `UpdateTenantDto` ganhou `annualClosingWindowStart`/`...End` (`@Matches` no formato `MM-DD`,
    regex `^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$`) e `annualClosingWindowEnabled` (`@IsBoolean`),
    todos opcionais - reusa o `updateCurrent()`/`update()` genéricos já existentes pra
    `securityTeamName`/`opinionNumberPrefix`, sem mudança estrutural em service/repository.
  - Nova aba "Renovação anual" em `/admin/settings` (`RenewalWindowForm`, mesmo padrão de
    `react-hook-form` + `zodResolver` da aba "Geral" já existente) - checkbox de habilitado (via
    `Controller`, já que não existe componente `Switch` no design system) + dois campos `MM-DD` que
    ficam desabilitados quando a janela está desligada. Validação client-side é condicional
    (`superRefine`): com a janela desligada, os campos podem ficar em branco sem travar o salvamento.
  - `TenantAdmin` (frontend) e i18n (`en`/`pt-BR`) atualizados com os 3 campos novos.
  - Validado via `update-tenant.dto.spec.ts` (novo - `validate()`/`plainToInstance` direto no DTO:
    aceita `MM-DD` válido, rejeita formato com ano, rejeita mês/dia fora do intervalo, aceita tudo
    omitido, rejeita `annualClosingWindowEnabled` não-booleano) e curl manual: `PATCH /tenants/current`
    com datas válidas retorna 200 com os valores persistidos, com `"2026-11-01"` retorna 400
    ("annualClosingWindowStart deve estar no formato MM-DD"), revertido pro estado original
    (`null`/`null`/`false`) via SQL direto ao final (dado de tenant compartilhado).
    Suite completa da API: 187/187 testes passando.
- **Renovação anual de homologação - Fase 3: scheduler de gatilho de renovação** (mesmo plano,
  `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md` - "a parte mais delicada", segundo o
  próprio plano). Novo módulo `RenewalModule` (`apps/api/src/modules/renewal/`), autocontido via
  `PrismaService`/`NotificationsService`/`AuditLogService` (todos globais) - não importa
  `AssessmentsModule`/`InventoryModule`, evitando risco de circularidade no grafo de imports.
  - `renewal-window.util.ts`: `computeRenewalTrigger()` implementa o algoritmo da janela de fechamento
    anual derivado com o usuário via 5 exemplos numéricos (ver plano) - nunca reduz o prazo padrão de
    30 dias corridos, só estende: se o gatilho natural (`nextReviewDate`) cai dentro da janela do
    tenant, antecipa o gatilho pro início da janela e nunca deixa o vencimento antes do fim dela; senão,
    se só o vencimento (gatilho + 30 dias) cai dentro da janela, estende o vencimento até o fim dela;
    senão, nada muda. Resolve a janela (`MM-DD`, sem ano fixo) contra o ano da data sendo testada e o
    ano anterior, cobrindo também janelas que cruzam a virada do ano (ex.: 20/dez a 10/jan) - caso não
    coberto pelos exemplos do usuário, mas coberto defensivamente já que é um cenário plausível pra
    exatamente o problema que a feature resolve (freeze de fim de ano).
  - `renewal.repository.ts`: `findEligibleItems()` busca itens de inventário com `assessmentId` não
    nulo, `status` em `ACTIVE`/`PENDING_REVIEW`, cuja `Assessment` ainda está `APPROVED` (disparo por
    borda - uma vez reaberta, o item não é reprocessado até o ciclo se resolver); `startRenewalCycle()`
    seta `Assessment.status = PENDING_RENEWAL` + `renewalDueAt`/`renewalCycleStartedAt`;
    `findAdministradorRoleId()` busca o papel seedado "Administrador" do tenant (`@@unique([tenantId,
    name])` garante que é único).
  - `renewal.scheduler.ts`: `RenewalScheduler.checkRenewalTriggers()`, `@Cron("15 6 * * *")` - roda
    15 minutos depois do `InventoryReviewScheduler` (6h), pra sempre ver o estado do dia já atualizado.
    Pra cada item elegível, calcula o gatilho efetivo; se já passou, reabre a `Assessment`, notifica o
    solicitante original (`RENEWAL_PENDING`) - ou, se ele está inativo (proxy pra "saiu da empresa"),
    notifica o papel "Administrador" no lugar (decisão #4 do plano) - e grava `AuditLog` com
    `action: "REOPEN"` (primeiro uso real dessa ação, antes só vestigial no enum).
  - Validado via `renewal-window.util.spec.ts` (9 testes - os 5 exemplos numéricos do usuário
    reproduzidos matematicamente, incluindo o caso "janela mais curta que 30 dias" que prova que a
    regra nunca reduz o prazo padrão, mais o caso de janela cruzando a virada do ano) e
    `renewal.scheduler.spec.ts` (6 testes - nenhum item elegível, gatilho ainda não chegou, reabertura +
    notificação do solicitante ativo, solicitante inativo notifica o papel Administrador, nenhum papel
    Administrador encontrado não quebra o job, janela de fechamento antecipando o gatilho antes da data
    natural). Restart do servidor de dev confirmou o grafo de DI do `RenewalModule` resolve sem erros
    ("Nest application successfully started"). Sem endpoint HTTP nesta fase (é um cron job puro) - sem
    verificação manual via curl, por isso a cobertura extra nos testes unitários.
    Suite completa da API: 202/202 testes passando.
- **Renovação anual de homologação - Fase 4: bloqueio de área + vencimento sem resolução** (mesmo
  plano, `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md`). Fecha o loop: quando o prazo
  de renovação vence sem aprovação, a área trava novas submissões até resolver.
  - `RenewalScheduler.checkLapsedRenewals()` (novo `@Cron("30 6 * * *")`, 15min depois do gatilho de
    renovação): marca `EXPIRED` os itens de inventário cuja `Assessment` está `PENDING_RENEWAL` com
    `renewalDueAt` vencido (`renewal.repository.findLapsedItems()`, filtrando `status != EXPIRED` -
    mantém o job idempotente, não reprocessa nem renotifica item já marcado). Notifica gestor +
    responsável técnico do item e o papel "Administrador" (tipo `RENEWAL_OVERDUE`), grava `AuditLog`
    (`action: "UPDATE"`). Não mexe em `Assessment.status` - continua `PENDING_RENEWAL`, ainda acionável
    pelo solicitante/reatribuído.
  - `AssessmentsRepository.isAreaBlocked()`/`findBlockedAreaIds()`: sinal derivado e autolimpante -
    `EXISTS(SoftwareInventoryItem WHERE tenantId=X AND areaId=Y AND status='EXPIRED')`. Sem campo
    `Area.isBlocked` novo; resolve sozinho quando a renovação é aprovada (item volta pra `ACTIVE`, ver
    Fase 1).
  - `AssessmentsService.create()` ganha `assertAreaNotBlocked()`, chamada antes de criar - lança
    `ConflictException` (409) com corpo `{ message, error: "AREA_BLOCKED" }`. Corpo estruturado (não só
    mensagem em português) pro frontend distinguir esse caso sem dar match de string -
    `ApiError` (`apps/web/src/lib/api-client.ts`) ganhou um terceiro campo opcional `code`, populado a
    partir de `body.error`.
  - `GET /assessments/blocked-areas` (novo, precisa vir antes de `:id` no controller - mesmo cuidado já
    documentado pra `check-duplicate`/`stats` no inventário) retorna as áreas bloqueadas do tenant.
  - Frontend (`assessments/new/page.tsx`): busca `/areas` e `/assessments/blocked-areas` em paralelo no
    mount; desabilita as opções bloqueadas no `<NativeSelect>` de área (com rótulo "(bloqueada -
    renovação pendente)") e evita selecionar uma área bloqueada como padrão. Fallback pra tentativa
    direta via API (ou corrida entre o fetch e uma renovação vencendo): captura `ApiError.code ===
    "AREA_BLOCKED"` no submit e abre um `Dialog` explicando o bloqueio (popup, não toast - pedido
    explícito do usuário) e quem pode resolver (Administrador reatribuindo o solicitante).
  - **Nota de escopo** (já registrada no plano): `User` não tem `areaId` hoje, então não existe uma
    noção computável de "usuários daquela área" pra um popup de sessão inteira. A abordagem acima
    (bloqueio + modal no ponto de ação) cumpre a decisão de bloquear toda a área sem esse trabalho de
    RBAC extra.
  - Validado via testes novos (`assessments.service.spec.ts` - `create()` rejeita área bloqueada com
    `ConflictException`, aceita normalmente quando não bloqueada, `listBlockedAreas()` repassa o
    tenant certo; `renewal.scheduler.spec.ts` - `checkLapsedRenewals()`: nenhum item vencido, marca
    `EXPIRED` + notifica gestor/responsável técnico/Administrador, dedup quando gestor e responsável
    técnico são a mesma pessoa, ausência do papel Administrador não quebra o job) e um fluxo manual
    completo via curl + SQL direto num item real do tenant demo: flipou pra `EXPIRED`, confirmou
    `GET /assessments/blocked-areas` retornando a área, `POST /assessments` nessa área retornando 409
    `AREA_BLOCKED`, `POST /assessments` numa área diferente retornando 201 normalmente (prova que o
    bloqueio é por área, não global) - revertido o item pra `ACTIVE` e a avaliação de teste apagada ao
    final, confirmado `GET /assessments/blocked-areas` voltando a `[]` (prova que o sinal é
    autolimpante).
  - Verificação visual: `@playwright/test` adicionado como devDependency de `apps/web` (não havia
    dependência de teste de browser no repo até agora) - script ad-hoc (não commitado, só usado nesta
    sessão) logou como `usuario@morpheus.demo`, confirmou que a opção "Financeiro" aparece desabilitada
    com o rótulo "(bloqueada - renovação pendente)" e que a página pré-seleciona a primeira área NÃO
    bloqueada ("Jurídico") - screenshot 1. Depois simulou uma corrida real (área livre no load da
    página, item vira `EXPIRED` entre o load e o submit) e confirmou o fallback: `POST /assessments`
    recebe 409, o modal "Área bloqueada para novas avaliações" abre corretamente, e o `<select>` se
    atualiza sozinho pra refletir a área recém-bloqueada - screenshot 2. Estado revertido ao final
    (ambos os itens de inventário de volta a `ACTIVE`; nenhuma avaliação de teste foi criada, já que o
    bloqueio impediu a criação em ambos os cenários).
    Suite completa da API: 209/209 testes passando.
- **Renovação anual de homologação - Fase 5: reatribuição de solicitante (Administrador)** (mesmo
  plano, `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md`). Cobre o caso do solicitante
  original ter saído da empresa durante um ciclo de renovação em andamento.
  - `PATCH /assessments/:id/renewal/reassign` (novo, `ReassignRenewalRequesterDto` -
    `{newRequesterId, reason?}`), `@RequirePermissions(PERMISSIONS.ASSESSMENTS_REOPEN)` - permissão
    que já existe e já é seedada em todo papel "Administrador", nunca checada em lugar nenhum até
    agora (zero mudança de seed necessária).
  - `AssessmentsService.reassignRenewalRequester()`: valida `status === "PENDING_RENEWAL"` (400 fora
    disso - não é uma feature geral de "trocar solicitante" pra qualquer avaliação), valida que o novo
    solicitante pertence ao tenant e está ativo, troca `requesterId`, grava `AuditLog` (`action:
    "UPDATE"`, metadata com solicitante anterior/novo + motivo) e notifica o novo solicitante
    (`RENEWAL_PENDING`). Sem `@Audit()` no controller - o service já grava o log manualmente com
    metadata rica, evitando duplicar.
  - **Bug real encontrado e corrigido de passagem**: `EDITABLE_STATUSES` da tela de detalhe da
    avaliação (`apps/web/.../assessments/[id]/page.tsx`) nunca tinha ganhado `PENDING_RENEWAL` na
    Fase 1 - o backend já aceitava edição/reenvio nesse status desde então (testado via curl na
    própria Fase 1), mas a UI mostrava a avaliação como somente-leitura pro solicitante. Sem esse
    fix, a reatribuição desta fase não teria como se completar de verdade via UI (o novo solicitante
    veria a mesma tela travada). Corrigido junto por ser pré-requisito direto da feature, não escopo
    à parte.
  - Frontend: novo `ReassignRequesterCard` (`apps/web/.../assessments/_components/`), visível só sob
    `usePermission("assessments:reopen")` numa avaliação `PENDING_RENEWAL` - select de novo
    solicitante (`GET /users`, excluindo o solicitante atual da lista), motivo opcional, atualiza o
    estado da página (`onReassigned`) direto com a resposta do PATCH.
  - Validado via testes novos em `assessments.service.spec.ts` (rejeita fora de `PENDING_RENEWAL`,
    rejeita novo solicitante de outro tenant, rejeita novo solicitante inativo, reatribuição com
    sucesso atualiza `requesterId`/audita/notifica) e um fluxo manual completo: via curl, flipou uma
    avaliação `APPROVED` real pra `PENDING_RENEWAL`, reatribuiu como Administrador (200), confirmou
    403 pra quem não tem o papel, confirmou 400 tentando reatribuir uma avaliação `APPROVED` (fora do
    ciclo), confirmou que o solicitante antigo perde acesso de edição (403) depois da troca; via
    Playwright (browser real), confirmou visualmente que o solicitante atual não aparece como opção
    no select, e que a tela reflete o novo solicitante depois do sucesso (toast + descrição do card
    atualizados). Estado revertido ao final (dado de amostra compartilhado).
    Suite completa da API: 213/213 testes passando.
- **Renovação anual de homologação - Fase 6: polimento de UI** (mesmo plano,
  `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md` - última fase, opcional segundo o
  plano original, mas priorizada pelo usuário depois de ver a Fase 5 em ação). Dois pedidos concretos:
  filtro de status na listagem de avaliações e visibilidade do ciclo de renovação no dashboard
  administrativo (explicitamente enquadrado como item de saúde/performance operacional do sistema,
  não só estético).
  - `/dashboard` ("Minhas avaliações"): novo filtro de status (`Select` com todos os 8 valores de
    `AssessmentStatus` + "Todos os status"), reaproveitando `Status.*` (i18n já existente) pros
    rótulos - `GET /assessments?status=X` já aceitava o parâmetro desde a Fase 1, mudança é só
    frontend.
  - `DashboardsRepository.countBlockedAreas()` (novo): mesmo sinal derivado de
    `AssessmentsRepository.isAreaBlocked` (Fase 4) - conta áreas distintas com pelo menos um item
    `EXPIRED`. `DashboardsService.getAdminDashboard()` passa a retornar `blockedAreasCount` junto do
    resto. `pendingRenewalCount` não precisou de campo novo - já vem de dentro de
    `assessmentsByStatus.PENDING_RENEWAL` (`countAssessmentsByStatus` já agrupa por todos os status).
  - `AdminDashboardView`: dois `StatTile` novos - "Pendente renovação" (`warning` se > 0) e "Áreas
    bloqueadas" (`critical` se > 0, já que bloqueio de área é uma parada mais dura que um ciclo
    simplesmente em andamento).
  - Validado via `dashboards.service.spec.ts` (novo mock `countBlockedAreas`, asserção de
    `blockedAreasCount` no resultado) e verificação visual completa via Playwright (browser real):
    filtro por "Pendente renovação" na listagem mostrou só a amostra de demonstração criada
    anteriormente (`Contract Analyzer AI`); dashboard administrativo mostrou os dois tiles novos com
    os valores certos (`Pendente renovação: 1`, `Áreas bloqueadas: 0`, cores âmbar/verde
    respectivamente). `typecheck`/`build` limpos nos dois pacotes.
    Suite completa da API: 213/213 testes passando (cobertura nova entrou como asserção extra num
    teste já existente de `dashboards.service.spec.ts`, não um teste novo - contagem total não muda).

Com a Fase 6, as 6 fases do plano de renovação anual de homologação estão completas.
- **Limpeza de dados de amostra + samples de API** (item de backlog, 2026-07-24). Removidos 4
  avaliações e 6 itens de inventário de teste/placeholder (`E2E Test Software ...`, `Smoke Test
  Item`, `Sistema Inventario/Auditoria/Parecer PDF Test`, `tesste`) via `DELETE` direto no Postgres
  numa transação - o schema já cobre a cascata certa (`Assessment` → versões/respostas/instância de
  workflow+etapas/pareceres via `onDelete: Cascade`; `SoftwareInventoryItem.assessmentId` usa
  `onDelete: SetNull`, então itens de inventário sobrevivem independentes da avaliação de origem).
  A pedido do usuário, também enriquecido com 2 amostras reais de `API_INTEGRATION`: adicionados
  links de documentação (Swagger + Jira) no item `Internal Billing API` já existente, e criado um
  item novo, `Freight Tracking API` (LogiTrack Systems, área Operações, Swagger + Postman), via
  `POST /inventory` de verdade (não SQL direto, pra passar pela validação normal). **Gotcha**: texto
  acentuado em PT-BR (`"Logística"`) enviado via `curl -d` neste ambiente Windows/Git Bash corrompeu
  a codificação UTF-8 silenciosamente (armazenou `Log�stica`, mas a API respondeu 200/201 normal) -
  corrigido via `UPDATE` direto no Postgres removendo o acento. Fica registrado como cuidado pra
  próxima vez que precisar inserir texto acentuado via curl neste setup.
- **README: seção de metodologia da matriz de risco (PT + EN)** (pedido do usuário, 2026-07-24,
  explicitamente depois da renovação anual e da limpeza de amostras acima, pra ter dados
  realistas nos prints). Nova seção `## Matriz de risco (metodologia)` / `## Risk matrix
  (methodology)`, posicionada entre "O que o Morpheus faz"/"What Morpheus does" e "Controles de
  segurança"/"Implemented security controls" - explica a abordagem probabilidade × impacto,
  menciona alinhamento com NIST SP 800-30 (*Guide for Conducting Risk Assessments*) como referência
  de mercado, e destaca que nada é fixo em código (faixas, classificações, cor, texto de
  recomendação, score mínimo de aprovação e a matriz inteira são versionáveis por tenant, via
  `RiskMatrixService`/`RiskEngineService` já existentes desde a Etapa 5 - nenhuma mudança de código,
  só documentação).
  - Screenshots novos: `risk-matrix-config.png`/`-en.png` (tela `/admin/risk-matrix/[id]`, grade de
    decisão/heatmap completa) pareados com `dashboard-executivo.png`/`-en.png` (dashboard executivo,
    gráfico de postura de conformidade) - capturados via Playwright (já uma devDependency real de
    `apps/web` desde a Fase 4 da renovação anual), logado como `admin@morpheus.demo`, um passe em
    `pt-BR` e outro em `en` (URLs com prefixo de locale, `/pt-BR/...` e `/en/...`).
  - De quebra, resolvido o item de backlog "screenshots do README em inglês reusavam print em
    PT-BR" **só pra tela de dashboard executivo** (não as outras telas do README) - a tabela de
    "Screenshots" (seção em inglês) passou a referenciar `dashboard-executivo-en.png` em vez do
    arquivo PT-BR que reusava antes. As demais telas do README continuam com esse gap, registrado
    à parte no backlog.
  - Config usada como referência: "Matriz Padrão" (tenant demo, ativa, versão 1) - já tinha faixas
    de probabilidade/impacto e classificações (Rejeitado/Aguardando Ajustes/Homologado) configuradas
    de sessões anteriores, sem precisar criar nada novo pro print.
  - Sem mudança de código nesta entrada - só `README.md` e os 4 arquivos de screenshot.
- **README: screenshots em inglês pras telas restantes** (pedido do usuário, 2026-07-24, logo depois
  da entrada acima). Fecha o item de backlog "seção em inglês reusava prints em PT-BR" pras 6 telas
  que ainda faltavam: "Minha visão"/"My view", "Administrativo"/"Admin", "Placar por
  área"/"Area leaderboard", login com seletor de organização, busca rápida (Cmd/Ctrl+K) e
  "Administração - papéis"/"Roles". Capturados via Playwright, logado como `admin@morpheus.demo`, um
  passe em `pt-BR` e outro em `en`.
  - **De quebra, também atualizados os 4 prints PT-BR** que tinham ficado desatualizados pela
    limpeza de amostras da entrada anterior (`dashboard-minha-visao.png`, `-administrativo.png`,
    `-placar-por-area.png`, `busca-rapida.png` mostravam avaliações/itens de teste já deletados,
    ex. `tesste`, `Sistema Auditoria Test`) - agora refletem o estado real e limpo do tenant demo.
  - `busca-rapida{,-en}.png` também acabou mostrando, de brinde, o filtro de status novo da Fase 6 da
    renovação anual (`Todos os status`/`All statuses`) e o badge "Pendente renovação"/"Pending
    renewal" na listagem - sem ter sido o objetivo da captura, mas reforça que os prints refletem o
    estado real e atual do produto.
  - Gotcha de seletor: `page.click('text=Busca rápida')` bateu em 2 elementos (o botão de trigger no
    header E o `<h2 data-slot="dialog-title">` do próprio diálogo, que aparentemente fica montado no
    DOM mesmo fechado) - trocado por `page.getByRole("button", { name: ... })`, que resolve pelo
    nome acessível e não ambiguou.
  - Sem mudança de código - só `README.md` e os arquivos de screenshot (4 PT-BR atualizados + 6 EN
    novos).
- **Investigação: barras dos gráficos "sumindo" em 3 screenshots** (usuário reportou, 2026-07-24,
  apontando `dashboard-administrativo.png`, `dashboard-placar-por-area.png` e
  `dashboard-placar-por-area-en.png` - as barras do recharts apareciam totalmente ausentes, só os
  eixos/labels). Investigado a fundo com Playwright direto no app rodando (não só olhando os
  screenshots existentes) antes de mexer em qualquer código, pra não "consertar" um bug que não
  existisse:
  - Confirmado que **não é um bug de aplicação**: inspecionado o DOM ao vivo (`admin@morpheus.demo`,
    tenant demo) - os `<path>` do recharts (`.recharts-bar-rectangle path`) sempre tinham geometria
    correta (`width`/`height` != 0), `fill` resolvendo pra cor real via `getComputedStyle` (as cores
    vêm de `colorForOutcomeKey()` em `dashboard-colors.ts`, que retorna `var(--chart-good)` etc.,
    variáveis CSS reais e definidas), `opacity: 1`, `visibility: visible`, e passavam em
    `elementFromPoint()` (ou seja, são o elemento clicável no topo daquele ponto - nada as cobre).
    Repetido em 4 trials seguidos sem nenhuma falha.
  - Isolado o culpado: é uma peculiaridade específica do **primeiro `page.screenshot({fullPage:
    true})` do Chromium headless logo após um `click()` de troca de aba** (Radix `Tabs`) que monta
    um `<BarChart>` novo - o pipeline de composição às vezes não inclui o frame que pinta os `fill`
    baseados em `var(--x)` nesse primeiro fullPage capture, mesmo com `wait`s generosos (testado até
    2500ms) e mesmo forçando leitura de `getBoundingClientRect()`/`getComputedStyle()` antes (que
    intuitivamente forçaria layout mas não resolveu). Reproduzido de forma 100% determinística nessa
    sequência exata (login → `/dashboards` → click na aba → `fullPage` screenshot).
  - **O que resolve, comprovado por teste A/B no mesmo estado de página**: tirar qualquer screenshot
    de viewport comum (`page.screenshot()`, sem `fullPage`) IMEDIATAMENTE ANTES do `fullPage` real -
    isso força o Chromium a flushar o pipeline de pintura, e o `fullPage` seguinte (mesmo sem esperar
    mais nada) sai correto. Não achamos necessidade de investigar mais fundo o motivo exato dentro do
    Chromium - o ponto prático é que é 100% contornável e não afeta usuário real (usuário nunca tira
    um "fullPage screenshot" da própria tela; scroll/resize/mouse-move do uso normal já forçam pintura
    o tempo todo).
  - Screenshots regeneradas com esse contorno (script Playwright descartável, deletado depois):
    `dashboard-administrativo.png`, `dashboard-placar-por-area.png` (pt-BR) e
    `dashboard-placar-por-area-en.png` (en) - as 3 confirmadas visualmente com as barras aparecendo.
  - **Como aplicar**: se aparecer de novo um screenshot de gráfico recharts "sem barra" capturado via
    Playwright/Chromium headless, antes de suspeitar do código, tirar um screenshot descartável
    (viewport, sem `fullPage`) logo antes do real - resolve na maioria dos casos. Sem mudança de
    código nesta entrada - só os 3 arquivos de screenshot.
- **Fix: "Administração" inacessível com a sidebar colapsada** (item de backlog aberto desde
  2026-07-23, retomado 2026-07-24). Causa raiz: `SidebarMenuSub`/`SidebarMenuSubButton`
  (`components/ui/sidebar.tsx`) têm `group-data-[collapsible=icon]:hidden` - com a sidebar em modo
  ícone, o `Collapsible` de "Administração" ainda abria/fechava normalmente, mas o conteúdo
  (`CollapsibleContent > SidebarMenuSub`) ficava sempre escondido via CSS, então clicar no ícone não
  levava a lugar nenhum. Confirmado com Playwright antes de mexer: DOM tinha o item, só que
  `display: none` no submenu.
  - **Solução escolhida** (das duas opções levantadas na sessão anterior): em vez de auto-expandir a
    sidebar inteira ao clicar, "Administração" agora vira um `DropdownMenu` (flyout) quando a sidebar
    está colapsada e não é mobile - mesmo padrão já usado no menu do avatar no rodapé deste mesmo
    arquivo (`DropdownMenuTrigger asChild` em cima de um `SidebarMenuButton` sem a prop `tooltip`,
    pra não colidir com o wrapping interno de `Tooltip` que `SidebarMenuButton` já faz quando
    `tooltip` é passado). Com a sidebar expandida (ou em mobile, onde `collapsible="icon"` não se
    aplica - vira overlay), o comportamento de `Collapsible` inline continua exatamente igual a antes.
  - Novo estado: `useSidebar()` (já existente em `components/ui/sidebar.tsx`, não precisou de nada
    novo) expõe `state`/`isMobile`; `adminAsFlyout = !isMobile && state === "collapsed"` decide qual
    dos dois blocos renderizar (`AppSidebar` em `app-sidebar.tsx`).
  - Validado via Playwright ao vivo (`admin@morpheus.demo`): colapsou a sidebar pelo trigger,
    confirmou visualmente o flyout com os 7 sub-itens (`Questionário`, `Matriz de risco`, `Workflow`,
    `Auditoria`, `Usuários`, `Papéis`, `Configurações`), clicou em "Questionário" e confirmou
    navegação real pra `/admin/questionnaire`. Sidebar expandida testada em seguida, comportamento
    de antes intacto.
  - `pnpm turbo run typecheck` e `lint` (`--filter=./apps/web`) passaram limpos (só warnings
    pré-existentes não relacionados, em `admin/settings/page.tsx` e `assessments/[id]/page.tsx`).
- **Feat: busca de conteúdo real na "Busca rápida"** (item de backlog aberto desde a PR #47,
  2026-07-23, retomado 2026-07-24). Até aqui o Cmd/Ctrl+K só indexava itens de navegação
  (`PRIMARY_NAV_ITEMS`/`ADMIN_NAV_ITEMS`, filtro 100% client-side do próprio cmdk) - passou a também
  buscar avaliações, itens de inventário e pareceres técnicos de verdade. Escopo confirmado com o
  usuário via `AskUserQuestion` antes de implementar: casar só pelo nome do software (não
  fornecedor/área), mais simples e cobre o caso de uso principal.
  - **Backend**: novo módulo `apps/api/src/modules/search/` (`SearchModule`/`SearchController`
    `GET /search?q=`/`SearchService`/`SearchRepository`) - autocontido via `PrismaService` global,
    sem importar `AssessmentsModule`/`InventoryModule`/`TechnicalOpinionModule` (mesmo padrão do
    `RenewalModule`: evita qualquer risco de circularidade no grafo de imports). `SearchService`
    reaproveita EXATAMENTE a mesma regra de visibilidade de cada módulo de origem, sem nenhuma
    permissão nova: `assessments:view-all`/`assessments:view-own` (avaliações),
    `assessments:view-all`/`assessments:approve` (pareceres, mesma regra de
    `TechnicalOpinionService.findAllForTenant`), `inventory:view` (inventário). Quem não tem acesso a
    um tipo de conteúdo recebe lista vazia pra aquele grupo, não erro - a busca degrada
    graciosamente, não trava a paleta inteira. Limite de 5 resultados por grupo. 6 testes unitários
    novos (`search.service.spec.ts`) cobrindo cada combinação de permissão + formatação do resultado.
  - **Frontend**: `command-palette.tsx` ganhou 3 novos `CommandGroup`s ("Avaliações", "Inventário",
    "Pareceres técnicos"), populados via busca debounced (400ms, a partir de 2 caracteres - mesmo
    padrão já usado na checagem de nome duplicado em `assessments/new/page.tsx`/`item-form-dialog.tsx`).
    Cada resultado navega pro lugar certo: avaliação → `/assessments/:id`, item de inventário →
    `/inventory/:id`, parecer → `/technical-opinions?number=...` (mesmo deep-link que já existia do
    vínculo inventário→parecer). Itens de navegação continuam filtrando instantaneamente como antes
    (cmdk client-side), sem nenhuma mudança - os grupos de conteúdo são só aditivos.
  - **Gotcha de lint**: a regra `react-hooks/set-state-in-effect` (React Compiler) rejeita qualquer
    `setState` síncrono direto no corpo de um efeito, incluindo o padrão "zera resultado quando os
    campos ficam vazios" - resolvido de dois jeitos: (1) o reset ao fechar a paleta saiu de um
    `useEffect` observando `open` e virou parte do próprio `handleOpenChange` (evita o anti-padrão
    "efeito só pra derivar estado" de vez, sem precisar de eslint-disable); (2) pra sinalizar
    "buscando" antes da resposta assíncrona chegar, não tem como fugir de um `setState` direto no
    efeito - usado `// eslint-disable-next-line react-hooks/set-state-in-effect` com justificativa,
    mesmo padrão já aceito no projeto em `assessments/new/page.tsx`/`item-form-dialog.tsx` pro aviso
    de duplicidade.
  - Validado via Playwright ao vivo (`admin@morpheus.demo`, tenant demo, query "contract"): os 3
    grupos novos apareceram com os dados reais da amostra de demonstração (`Contract Analyzer AI` -
    avaliação em `PENDING_RENEWAL`, item de inventário `Ativo`, parecer `SECOPS-SW-072026-004`
    "Aguardando Ajustes"), clique em cada um navegou pro destino certo (`/assessments/:id`,
    `/inventory/:id`, `/technical-opinions?number=...`). Confirmado também que digitar 1 caractere
    não dispara nenhuma requisição (`search calls: 0`), e que limpar o campo volta a mostrar só os
    grupos de navegação, sem resíduo de busca anterior.
  - `pnpm turbo run typecheck` (api+web) limpo; `pnpm turbo run test --filter=@morpheus/api`: 219/219
    passando (26 suites); `lint` (api+web) limpo, só warnings pré-existentes não relacionados.
- **CI (GitHub Actions) + Dependabot** (pedido do usuário, 2026-07-24, no âmbito de montar um ciclo de
  SSDLC/Security by Design pro projeto). Nenhum dos dois existia até aqui - repo sem nenhum workflow
  configurado, sem alertas de vulnerabilidade, sem atualização automática de dependência.
  - **Dependabot alerts + automated security fixes**: ativados via API (`PUT
    /repos/.../vulnerability-alerts` e `/automated-security-fixes`), sem precisar de nenhum arquivo -
    são configurações de repositório, gratuitas em qualquer plano do GitHub (público ou privado).
    Confirmado via `gh api` que ambos ficaram `enabled`.
  - **`.github/dependabot.yml`** (atualizações de versão agendadas, distinto dos alerts acima que já
    são imediatos): ecossistema `npm` apontando pra raiz (`/`) - cobre o monorepo pnpm inteiro
    (`@morpheus/api`, `@morpheus/web`, `@morpheus/database`, `@morpheus/config`) de uma vez, já que o
    Dependabot detecta `pnpm-workspace.yaml`/lockfile único automaticamente quando `directory` aponta
    pra raiz. Mais `docker` (`apps/api`, `apps/web`, uma entrada por Dockerfile) e `github-actions`
    (pro workflow novo abaixo). Frequência semanal (escolhida pelo usuário via `AskUserQuestion`,
    mesmo ritmo do `morpheus-ops`), `open-pull-requests-limit: 10`, e um `group` de
    `minor-and-patch` no ecossistema npm pra não gerar uma enxurrada de PRs individuais a cada rodada.
  - **`.github/workflows/ci.yml`**: primeiro workflow do repo. `pull_request`/`push` em `main`, Node
    22 (mesma versão das imagens `node:22-alpine` de produção, não a mínima `>=20` do `engines`),
    `corepack enable` + `actions/setup-node` com `cache: pnpm` (mesmo padrão dos Dockerfiles). Quatro
    steps espelhando exatamente a validação manual já usada em toda PR deste projeto:
    `pnpm turbo run typecheck`/`lint`/`test`/`build` - o `test` aqui é só unitário (mockado, sem
    Postgres), o mesmo que já roda localmente; `test:e2e` (que precisaria de um serviço Postgres no
    runner) ficou fora de propósito, não foi pedido. Decisão confirmada via `AskUserQuestion`: montar
    esse CI básico junto, não deixar pra depois, pra que os PRs futuros do Dependabot já cheguem
    validados automaticamente em vez de precisarem de checagem manual local um por um.
  - **Gotcha real durante a validação local**: rodar `pnpm turbo run lint` no monorepo inteiro (sem
    `--filter`) acusou ~12 mil erros `Delete ␍` em todo o `apps/api` - o gotcha de CRLF/
    `core.autocrlf` já documentado, mas dessa vez atingindo a árvore inteira, não só um arquivo.
    Confirmado com `git diff --stat` que é 100% ruído local (nenhuma mudança real fora do
    `tenants.repository.ts` de sempre) - e como o runner do GitHub Actions é Linux (sem conversão
    CRLF do checkout local Windows), o CI novo não deve ver esse problema. Não corrigido (não pedido,
    e re-normalizar a árvore inteira só pra isso seria ruído desnecessário nesta entrega).
  - **Bug real pego pela primeira execução do CI**: `@morpheus/web#typecheck` falhou no runner do
    Actions - `zod` (`^4.4.3`) incompatível com `@hookform/resolvers@5.4.0` (última versão publicada;
    não existe release mais nova que resolva isso) em 8 arquivos (`admin/settings`,
    `admin/workflow/*`, `approvals/*`, `inventory/item-form-dialog`). Erro:
    `Types of property '_zod.version.minor' are incompatible... Type '4' is not assignable to type
    '0'` - o resolver do hookform foi tipado contra `zod@4.0.x` e nunca foi atualizado pra `zod`
    4.1+, que muda um tipo interno de "versão" usado nesse guard de compatibilidade. **Não é falha
    de nenhuma mudança recente** - reproduzido de forma isolada num `git worktree` separado com
    `pnpm install --frozen-lockfile` do zero (sem nada do `node_modules` de sessões anteriores),
    provando que já estava quebrado no `main` antes desta PR, só nunca detectado porque nunca existiu
    uma instalação 100% fresca validada (CI não existia, e o `node_modules` local de longa duração
    "mascarava" o problema de algum jeito).
  - **Correção testada e aplicada**: fixado `"zod": "~4.0.5"` em `apps/web/package.json` (era
    `"^4.4.3"`) - `4.0.5` é a última versão de patch da 4.0.x, testada isoladamente no mesmo worktree
    até o typecheck passar 100% limpo. `~` (não `^`) de propósito: permite só patches dentro da
    4.0.x via Dependabot, bloqueando um novo salto pra 4.1+ até o `@hookform/resolvers` publicar uma
    versão compatível - senão o mesmo problema silenciosamente voltaria no próximo bump automático.
    Typecheck limpo em todo o app é evidência de que nenhum código usa API do zod introduzida depois
    da 4.0.5 (senão apareceria como erro "propriedade não existe" em outro lugar). Revalidado
    localmente: `pnpm turbo run typecheck lint test build` - só o ruído de CRLF já conhecido, 213
    testes passando, build ok.
  - **Segundo bug real pego pela mesma execução do CI** (depois do fix acima, novo push, novo run):
    `@morpheus/api#lint` falhou no runner - dessa vez não é o ruído de CRLF, são 49 violações
    genuínas de `prettier/prettier` (vírgula final faltando, assinatura de função não quebrada em
    múltiplas linhas) espalhadas por 25 arquivos reais (`renewal`, `roles`, `users`, `workflow`,
    `technical-opinions`, `inventory`, etc). Nunca detectado porque todo `lint` deste projeto,
    sessão após sessão, sempre rodou escopado com `--filter` pro pacote tocado na hora - um `lint`
    completo e sem filtro nunca tinha sido concluído até essa primeira execução do CI.
  - **Correção**: `npx eslint "{src,test}/**/*.ts" --max-warnings 0 --fix` dentro de `apps/api` -
    100% mecânico (é literalmente o que o Prettier já ia aplicar). Conferido arquivo por arquivo via
    `git diff` que toda mudança é só quebra de linha/vírgula, nenhuma lógica ou asserção de teste
    alterada. Revalidado de novo: `pnpm turbo run typecheck lint test build` limpo, 213 testes
    passando.
  - **Como aplicar daqui pra frente**: com o CI agora cobrindo o lint completo (sem `--filter`) em
    todo PR, esse tipo de drift de formatação não deve mais se acumular silenciosamente - cada PR
    já vai flagar sua própria violação na hora, em vez de empilhar centenas ao longo de meses.
  - **Branch protection no `main`**: com o CI finalmente verde (`validate` passando de verdade, não
    só o workflow existindo), ativado via API
    (`PUT /repos/.../branches/main/protection`) - `required_status_checks.contexts: ["validate"]`,
    `enforce_admins: true` (vale até pro dono do repo, sem bypass silencioso pelo botão de merge),
    `allow_force_pushes`/`allow_deletions: false`. De propósito **sem**
    `required_pull_request_reviews` - esse projeto não tem um segundo revisor humano formal, a
    confirmação de merge já é verbal (ver ritmo padrão no topo deste arquivo); exigir aprovação de
    PR quebraria esse fluxo sem agregar nada. Antes de ativar, os dois bugs reais acima (zod pin +
    prettier) precisaram ser corrigidos - ativar a proteção com o check vermelho teria travado
    imediatamente toda PR aberta, incluindo as que já estavam em andamento.
  - **Decisão combinada com o usuário sobre correções de vulnerabilidade**: em vez de mesclar PRs de
    segurança do Dependabot assim que aparecem, tratar numa janela semanal fixa (mesmo ritmo do
    `morpheus-ops`) - com uma válvula de escape: severidade `critical` com exploit publicamente
    conhecido é tratada fora da janela, na hora. Não implementado em automação (é uma prática
    combinada, não uma regra de CI) - registrar os findings de vulnerabilidade no `morpheus-ops`
    antes de cada janela de correção também foi combinado, mas ainda não tem um processo/script
    definido (próximo passo, se o usuário pedir).
- **Feedback de uso real (2026-07-26) - sessão sem expiração, tela de login fora do padrão de tema,
  `/admin` quebrado**: usuário testou as telas após o setup de CI/SSDLC e trouxe 3 pontos.
  - **Sessão não expirava**: o access token já vivia só 15 min (`JWT_ACCESS_EXPIRES_IN`), mas o
    refresh token (cookie `httpOnly` `morpheus_refresh_token`) tinha `JWT_REFRESH_EXPIRES_IN=7d` -
    como o access token nunca é persistido (só em memória, apagado a cada reload) e o front chama
    `POST /auth/refresh` silenciosamente no boot usando esse cookie, derrubar/subir o ambiente nunca
    forçava novo login dentro dessa janela de 7 dias. **Corrigido**: `JWT_REFRESH_EXPIRES_IN=4h` em
    `.env`/`.env.example` - o cookie e o JWT usam o mesmo valor (`AuthController.setRefreshCookie`
    deriva o `maxAge` dele), então a sessão inteira expira em 4h sem precisar de nenhum mecanismo
    novo. Confirmado via `curl` no `POST /auth/login`: `Max-Age=14400`. O caminho de
    logout-por-expiração já existia pronto (`AuthProvider` marca `unauthenticated` quando o refresh
    falha, `useRequireAuth` redireciona pra `/login`) - não precisou de nenhuma mudança de fluxo.
  - **`/admin/users`, `/admin/roles`, `/admin/settings` etc. voltavam 404, `/admin` sozinho
    funcionava**: não era bug de código - os arquivos de rota existiam e o manifest do Next.js
    (`app-paths-manifest.json`) já listava todas as sub-rotas corretamente. Causa real: cache de dev
    do Turbopack (`apps/web/.next`) corrompido/desatualizado. **Resolvido** limpando o cache
    (`rm -rf apps/web/.next`) e reiniciando `pnpm dev` - todas as sub-rotas voltaram a 200
    imediatamente. Nenhuma mudança de código; guardar esse passo como primeiro diagnóstico da
    próxima vez que uma rota existente 404ar sem motivo aparente.
  - **Esquema de cores da tela de login não seguia o mesmo tema das telas internas**: `LoginPage` e
    `SecurityHeroBackground` usavam cores fixas (`bg-black`, `text-white`, `zinc-*`, um acento
    vermelho `--hero-accent: #e0263c` hardcoded) independente do alternador de tema - decisão
    deliberada de uma sessão anterior (comentário no código: login era tratado como "vitrine",
    diferente do uso diário). Usuário pediu para reverter isso: mesmo esquema das telas internas +
    botão de alternar tema. **Feito**: `SecurityHeroBackground` passou a usar os tokens do tema
    (`bg-background`/`text-foreground`/`var(--primary)` para o glow decorativo, `var(--border)` para
    a grade de pontos) em vez de cores fixas, e o `<div className="dark ...">` que forçava dark
    sempre foi removido. `LoginPage` trocou todas as classes `zinc-*`/`white/*`/`black/*` pelos
    tokens shadcn padrão (`bg-card`, `text-muted-foreground`, `text-destructive`, `border-border`,
    inputs/`Select` sem override de cor) e ganhou um `<ThemeToggle>` ao lado do `<LocaleSwitcher>` no
    header, mesmo padrão do `AppShell`. Validado com Playwright (`chromium`, screenshot claro e
    escuro) - tema muda em tempo real, cores batem com o resto do app. Screenshots do portfólio
    (`docs/screenshots/login-organizacao{,-en}.png`) regeneradas para refletir o novo visual - nessa
    regeneração a API caiu no meio do processo (mesma race condition de `nest start --watch` já
    documentada: recompilação incremental apagou `dist/app.module.js` momentaneamente, `main.js`
    tentou importar e o processo inteiro morreu com `MODULE_NOT_FOUND`), confirmado via `GET
    /tenants/public` retornando conexão recusada; resolvido reiniciando `pnpm dev` - sem relação com
    o código desta mudança.
- **Rename: `/dashboard` vira "Home"** (feedback de uso real, 2026-07-26). Usuário notou a
  confusão de nomes entre `/dashboard` (rótulo de menu "Avaliações", mas é na prática a tela que
  abre logo após o login) e `/dashboards` (a tela de estatísticas de verdade, no plural). Escopo
  fechado via `AskUserQuestion`: a tela vira "Home" só no nome/rótulo (menu e sidebar) - a URL
  continua `/dashboard` (evita quebrar links/favoritos) e a lista de avaliações continua sendo o
  conteúdo principal da tela (não tem outro lugar dedicado hoje), com uma seção nova de "Atalhos
  rápidos" acima da tabela (por enquanto só o card "Nova avaliação" - espaço já pensado pra crescer
  se entrarem os outros itens discutidos: resumo, notificações, notícias, saúde do ambiente restrita
  a super-admin - nenhum desses foi implementado agora, ficou registrado como direção futura).
  - `nav-items.ts`: item `/dashboard` trocou `labelKey: "assessments"` → `"home"` e o ícone
    `ClipboardList` → `Home` (lucide-react) - chave "assessments" renomeada pra "home" no namespace
    `Nav` de `pt-BR.json`/`en.json` (não sobrou órfã).
  - `dashboard/page.tsx`: heading "Olá, {name}" mantido como está (já cumpre o papel de boas-vindas
    pessoal) - adicionado um grid de atalhos (mesmo padrão visual da grade de cards de
    `/admin/page.tsx`) entre o heading e a tabela de avaliações, hoje com um único card ("Nova
    avaliação" → `/assessments/new`).
  - **Nota de escopo não pedida agora**: o screenshot `docs/screenshots/busca-rapida{,-en}.png` no
    README ainda mostra a sidebar com o rótulo antigo "Avaliações" - não regenerado nesta mudança
    (só os screenshots de login foram pedidos explicitamente); sinalizar se o usuário quiser
    atualizar também.
- **Nova doc: `docs/security.md` (2026-07-26)** - depois da primeira janela semanal de revisão do
  Dependabot render de verdade (27 alertas, 13 deles todos advisories do Next.js resolvidos por um
  único bump de patch), o usuário pediu pra formalizar o processo por escrito - mas com uma divisão
  de responsabilidade clara entre os dois repos: o *processo* (o "como pensamos" - fluxograma,
  camadas de risco, a janela semanal) fica documentado aqui, em `morpheus-beta`, porque é conteúdo
  de portfólio; os *dados* de cada janela (o que foi encontrado, mesclado, adiado) ficam no
  `morpheus-ops`, pra não colocar um arquivo de estado que muda toda semana dentro da narrativa de
  desenvolvimento deste repo. Mesma lógica de separação já usada para o inventário de componentes.
  - `docs/security.md`: processo completo com um fluxograma mermaid (`Dependabot detecta` →
    `crítico+exploit? sim → imediato / não → janela semanal` → `classificação em 4 camadas de
    risco` → `mescla ou adia` → `registra em morpheus-ops`), linkado a partir de
    `docs/DEVELOPMENT.md` (seção "CI e proteção do `main`") e da lista de documentação do
    `README.md`.
  - **"Perfumaria" pedida explicitamente no `README.md`**: o usuário notou que quase ninguém que
    visita o projeto vai cavar até `docs/`, então pediu uma versão visível direto no README - um
    fluxograma mermaid compacto (5 nós, mais simples que o de `docs/security.md`) mais um link, logo
    depois da lista de "Controles de segurança implementados"/"Implemented security controls" (PT e
    EN), sem precisar clicar em nada pra ver que o processo existe.
  - `morpheus-ops/reports/vulnerability-log.md` (novo, análogo ao `component-inventory.md` mas
    **mantido à mão, não gerado por script** - envolve julgamento humano sobre risco, diferente de
    um inventário objetivo de versões) ganhou sua primeira entrada real, com os dados concretos da
    janela de 2026-07-26 (ver detalhe completo dessa janela na entrada anterior deste changelog).
- **Janela de revisão semanal - Camada 2 (2026-07-28)**: bump `node:22-alpine` → `node:26-alpine`
  em `apps/api/Dockerfile` e `apps/web/Dockerfile` (PRs Dependabot #61/#62, consolidados num único
  PR já que são a mesma mudança lógica). Validado de ponta a ponta com `docker compose up --build`
  real (não só CI) - achou dois bugs reais, ambos documentados com detalhe em
  `docs/DEVELOPMENT.md` (seção "3. Stack completa via Docker"):
  1. Node 26 não vem mais com `corepack` embutido - `RUN corepack enable` passou a falhar em todos
     os três Dockerfiles que dependem dele (`api`, `web`, e `migrate`, que reusa o da API).
  2. `docker-compose.yml` nunca teve `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`ENCRYPTION_KEY` no
     bloco `environment:` do serviço `api` - bug pré-existente sem relação com o Node, só apareceu
     agora porque era a primeira vez que a stack completa subia depois desses três terem virado
     obrigatórios em `env.validation.ts`.
  Depois dos dois fixes, validação manual completa: login (`POST /auth/login` com o usuário demo),
  `GET /auth/me`/`/assessments`/`/inventory` autenticados, e via Playwright o fluxo completo no
  browser (login → Home com o atalho "Nova avaliação" → `/admin/settings`, sem 404). `pnpm turbo
  run typecheck lint test build` rodou limpo (só o ruído de CRLF já conhecido no lint do `api`,
  invisível no CI Linux). Log completo da janela, com os dois bugs e a decisão de tier, registrado
  em `morpheus-ops/reports/vulnerability-log.md`.
- **Janela de revisão semanal - Camada 3 (2026-07-29)**: majors de dev-tooling (TypeScript 5→7,
  `@eslint/js`/`eslint`/`eslint-config-prettier` 9→10, `globals` 15→17, `@types/node` 20/22→26 -
  PRs Dependabot #66-#68, #70-#72). Sem risco de runtime (tudo devDependency), mas majors quebram
  `typecheck`/`lint` de verdade às vezes - por isso essa camada nunca é "CI verde = pode mesclar",
  precisa rodar local. Dessa vez quebrou de verdade, em duas frentes independentes:
  1. **TypeScript 7 (#70) quebra o typecheck do `apps/web`** - confirmado comparando com `main`
     limpo num `git worktree` isolado (mesmo método usado para provar os dois bugs pré-existentes
     que a primeira execução do CI pegou, ver entrada anterior deste changelog): com TS 5.9.3 o
     typecheck passa limpo, com TS 7.0.2 aparece um erro real de duplicidade de tipos do `zod`
     (`zod@3.25.76` de `apps/api` vs `zod@4.0.17` de `apps/web`, `ParsePayload`/`$ZodCheck`
     incompatíveis). Bate com o aviso de peer dependency: `typescript-eslint@8.65.0` só declara
     suporte a `>=4.8.4 <6.1.0` - a versão 7 nem era esperada. **Adiado.**
  2. **ESLint 10 (#66/#71/#72, o trio anda junto) quebra o lint do `apps/web` de verdade, não é só
     aviso** - `eslint-plugin-react@7.37.5` (dependência de `eslint-config-next`) crasha com
     `TypeError: contextOrFilename.getFilename is not a function` ao tentar detectar a versão do
     React, porque o ESLint 10 removeu `context.getFilename()` da API de regras. **Adiado.**
  3. **`globals` 15→17 (#67) e `@types/node` 20/22→26 (#68) passaram limpos** - `pnpm turbo run
     typecheck lint test build` completo, sem quebra nenhuma (só o ruído de CRLF de sempre no lint
     do `api`). **Mesclados** num PR único.
  Comentário técnico deixado nos PRs #66/#70/#71/#72 explicando o motivo do adiamento (não fechados
  - ficam esperando o ecossistema `typescript-eslint`/`eslint-plugin-react` alcançar essas majors).
  Log completo em `morpheus-ops/reports/vulnerability-log.md`.
- **Janela de revisão semanal - Camada 4 (2026-07-29)**: `zod` 3→4 em `apps/api` (PR Dependabot #69).
  Marcada desde a primeira janela como precisando de teste manual isolado, não só CI verde - mesma
  família de risco do incidente anterior desta semana com o `zod` do `apps/web` (pin `~4.0.5` feito
  justamente por incompatibilidade de tipos com `@hookform/resolvers`). O diff real da PR #69
  surpreendeu: além de `apps/api` (`^3.24.1`→`^4.4.3`), também bumpa o `zod` do `apps/web`
  (`~4.0.5`→`~4.4.3`) - o Dependabot agrupa o mesmo pacote entre workspaces quando o `dependabot.yml`
  aponta pro root do monorepo. Os dois lados foram testados juntos.
  - **`apps/api`**: `zod` é usado num único arquivo, `env.validation.ts` (validação de env vars no
    boot). Sem teste automatizado existente pra esse arquivo - validação manual via script
    descartável exercitando `validateEnv()` com 10 casos (válido, `DATABASE_URL` faltando, secrets
    curtos, `ENCRYPTION_KEY` inválido/ausente, SAML habilitado com/sem campos obrigatórios, coerção
    de `API_PORT`/booleans). Todos os 10 casos se comportaram identicamente - a única diferença é
    cosmética: zod v4 mudou a mensagem padrão de campo obrigatório ausente de "Required" pra "Invalid
    input: expected string, received undefined" nos campos sem `.refine()`/`.min()` customizado (só
    afeta erro de boot mal configurado, nunca chega num usuário final).
  - **`apps/web`**: `pnpm peers check` não acusou nada (diferente da tentativa anterior com `~4.0.5`)
    - sinal de que `@hookform/resolvers@5.4.0` já suporta a faixa 4.4.x. Confirmado na prática, não só
    por tipos: ambiente de dev completo (`docker compose -f docker-compose.dev.yml up` + `pnpm dev`)
    e teste real via Playwright no formulário de "Novo item de inventário" (15 campos, vários
    `zodResolver`) - submeter vazio mostra erro em todos os campos obrigatórios (bordas vermelhas:
    Nome, Fabricante, Categoria, Área, Gestor, Responsável técnico), preencher um campo limpa o erro
    dele individualmente na hora, sem submeter de verdade (não queria sujar o banco com item de
    teste). `pnpm turbo run typecheck lint test build` completo limpo (219 testes do `apps/api`
    passando, só o ruído de CRLF de sempre no lint).
  **Válvula de escape acionada?** Não. Log completo em `morpheus-ops/reports/vulnerability-log.md`.
- **Janela de revisão semanal - continuação, PR #81 (2026-07-30)**: com as 4 camadas originais
  fechadas, o Dependabot fechou sozinho a antiga PR agrupada `#77` (ficou obsoleta/conflitante
  depois dos merges de ontem) e abriu uma nova, `#81`, com 22 atualizações em vez de 34 - o resto já
  tinha sido coberto. Perfil idêntico à Camada 1 original: grupo `minor-and-patch`, só patch/minor
  em pacotes já conhecidos (`next` 16.2.11→16.2.12, `prisma`/`@prisma/*` 7.9.0→7.9.1, família
  `radix-ui`, `react-hook-form`, `recharts`, `turbo`, etc.), nenhum major. Cruzado com os 9 alertas
  de segurança abertos no momento (`find-my-way`, `brace-expansion`, `js-yaml`, `postcss`,
  `fast-uri`, `sharp`, `valibot`) - nenhum é resolvido por essa PR, são todos dependências
  transitivas de ferramental fora do escopo desse bump, então é atualização de rotina, não correção
  de CVE. `pnpm turbo run typecheck lint test build` limpo (219 testes, só o CRLF de sempre; lint do
  `apps/web` trouxe 3 warnings pré-existentes, zero erros - 2 imports não usados já conhecidos mais
  um novo aviso do React Compiler sobre `watch()` do `react-hook-form` não poder ser memoizado,
  inofensivo). CI verde. Log em `morpheus-ops/reports/vulnerability-log.md`.
- **Nova feature (2026-07-30) - Avaliação de risco de fornecedores (Vendor), Fase 1: schema + seed.**
  Depois de uma reunião com uma equipe de Sec GRC, o usuário pediu pra estender o Morpheus além da
  homologação de software: avaliar formalmente o fornecedor por trás dele - questionário inspirado
  no NIST SP 800-161 (gestão de risco de cadeia de suprimentos), score automático, classificação em
  4 Tiers de monitoramento (Tier 1 = melhor cenário/menos acompanhamento, Tier 4 = pior/acompanhamento
  mais próximo - inverso do score, onde valor maior = mais favorável), reavaliação periódica
  ajustada por criticidade de negócio do fornecedor. Escopo completo derivado numa sessão de plano
  dedicada (`AskUserQuestion` + investigação do código real) - decisões confirmadas: preenchimento
  por analista interno (não é formulário público), sem workflow de aprovação (score/tier calculados
  automaticamente na conclusão), e `Assessment.vendor` (texto livre) ganha um `vendorId` opcional
  linkando um `Vendor` real, sem quebrar avaliações existentes.
  - Schema: 9 modelos novos (`Vendor`, `VendorQuestionCategory`/`VendorQuestion`/
    `VendorQuestionOption` - catálogo separado do de software, porque tierização é score agregado 1D,
    não matriz probabilidade×impacto 2D -, `VendorTierConfig`/`VendorTierThreshold`,
    `VendorAssessment`, `VendorAnswer`/`VendorAnswerOption`) + `Assessment.vendorId` nullable +
    `NotificationType.VENDOR_REASSESSMENT_DUE` + `VendorAssessmentStatus`. Migration 100% aditiva
    (27 `CREATE`, zero `DROP`) - confirmado via SQL que as 3 `Assessment`s existentes no banco de dev
    ficaram com `vendorId` null e `vendor` intocado.
  - Seed: 2 permissões novas (`vendors:view`, também concedida às roles aprovadoras;
    `vendors:manage`), `VendorTierConfig` "Config Padrão" com os 4 thresholds (12/6/4/3 meses de
    cadência base por tier), e um catálogo de ~28 perguntas (4 categorias: Dados
    Cadastrais/Contratuais, PSI, Gestão de Vulnerabilidades/Incidentes, Continuidade/Disponibilidade)
    reaproveitado por todos os tenants demo - reusa o mesmo helper `YES_NO()` e a mesma escala 0-5 de
    risco cru por opção já usada no questionário de software (o `RiskEngineService.computeScores`
    existente inverte pra score final onde maior = mais favorável - será reutilizado sem mudança nas
    fases seguintes).
  - Plano completo (todas as fases, decisões de escopo, algoritmo de cadência de reavaliação) em
    `C:\Users\kaosikner\.claude\plans\streamed-sleeping-newell.md` (arquivo de plano local, não
    versionado no repo).
- **Avaliação de risco de fornecedores, Fase 2 (2026-07-30): backend `VendorsModule`.** Núcleo da
  feature - CRUD de `Vendor`, CRUD admin do catálogo de perguntas e do tier config, e o endpoint
  central `POST /vendors/:id/assessments/:assessmentId/complete` que calcula score/tier
  automaticamente (sem workflow de aprovação, decisão #2 do plano).
  - **Reaproveitou o `RiskEngineService.computeScores()` existente sem nenhuma mudança** - a função é
    pura e já não tinha acoplamento a `Assessment`. `VendorsService.buildScorableAnswers()` espelha
    `AssessmentsService.resolveScorableAnswers()` (SCALE usa `scaleValue` direto, escolha usa a média
    das opções selecionadas, TEXT é ignorado), com `riskDimension` fixo em `"BOTH"` (tierização é
    score 1D, sem split probabilidade/impacto).
  - `vendor-tier.util.ts`/`vendor-reassessment.util.ts`: funções puras novas, testadas isoladamente
    (mesmo estilo de `renewal-window.util.ts`) - `tierForScore()` com fallback defensivo (paralelo ao
    `findBand` do motor de risco), `computeNextReviewDate()` implementando a regra de cadência
    (decisão #5: base do tier × multiplicador de criticidade, clampado 3-12 meses).
  - `Assessment` ganha o fio de integração: DTOs de create/update aceitam `vendorId?` opcional;
    quando presente, o backend resolve o `Vendor` real (valida que pertence ao tenant) e sobrescreve
    o texto livre `vendor` com `Vendor.name` (decisão #3 - snapshot denormalizado, evita mudar todo
    lugar que já interpola `assessment.vendor` como string). `AssessmentsModule` importa
    `VendorsModule` (uma via só, sem circularidade).
  - **Testes**: 26 novos (`vendor-tier.util.spec.ts`, `vendor-reassessment.util.spec.ts`,
    `vendors.service.spec.ts` + 2 no `assessments.service.spec.ts` pra cobrir a resolução de
    `vendorId`), todos passando (245 no total do `apps/api`).
  - **Validação manual completa via curl** (ambiente de dev real, não só CI): criar fornecedor →
    responder 8 das ~28 perguntas com respostas 100% favoráveis → concluir → `totalScore: 5`,
    `tier: 1`, `tierLabel: "Baixo risco"`, `nextReviewDueAt` exatamente 12 meses à frente (Tier
    1 = base 12 meses × criticidade MEDIUM = ×1.0) - `Vendor` denormalizado corretamente. Confirmado
    que tentar concluir a mesma avaliação de novo dá `422`. Confirmado que linkar um `Vendor` real
    numa `Assessment` de software sobrescreve o texto livre digitado errado pelo nome real do
    fornecedor. Dados de teste removidos do banco depois (convenção do projeto).
- **Avaliação de risco de fornecedores, Fase 3 (2026-07-30): scheduler de reavaliação.**
  `VendorReassessmentScheduler` (`apps/api/src/modules/vendors/vendor-reassessment.scheduler.ts`),
  registrado dentro do próprio `VendorsModule` (diferente do `RenewalModule`, que virou módulo
  separado especificamente pra evitar circularidade com `AssessmentsModule`/`InventoryModule` - esse
  risco não existe aqui, `VendorsModule` já é autocontido).
  - `@Cron("45 6 * * *")`, escalonado depois dos dois jobs de renovação anual (6h15/6h30). Query
    idempotente em `VendorsRepository.findDueForReassessment()`: fornecedores ativos já avaliados
    (`currentTier` não nulo) com `nextReviewDueAt` vencido e `reassessmentNotifiedAt` ainda nulo -
    trava limpa automaticamente na próxima `VendorAssessment` concluída
    (`VendorsService.completeAssessment` já zerava esse campo desde a Fase 2).
  - Mesmo padrão duplo de notificação do `RenewalScheduler.checkRenewalTriggers`: notifica quem
    concluiu a última `VendorAssessment` (se ainda ativo); se inativo ou se nunca houve avaliação
    concluída, notifica o papel "Administrador" via `notifyRole()`. Novo tipo
    `NotificationType.VENDOR_REASSESSMENT_DUE` (já estava no schema desde a Fase 1). Grava
    `AuditLogService.record` (`action: "UPDATE"`, `entityType: "Vendor"`) por fornecedor notificado.
  - **Testes**: `vendor-reassessment.scheduler.spec.ts`, 6 novos casos (nenhum vencido, responsável
    ativo, responsável inativo, nunca avaliado antes, sem papel Administrador configurado, múltiplos
    fornecedores numa mesma execução) - todos passando (251 no total do `apps/api`).
- **Avaliação de risco de fornecedores, Fase 4 (2026-07-30): frontend completo.** Primeira fase com
  superfície visual de verdade - navegação, telas, formulário de avaliação, admin do catálogo, aba de
  tierização em Settings e o picker de fornecedor na Assessment de software.
  - **Pequenas adições de backend habilitantes** (junto com o frontend, não uma fase à parte):
    `GET /vendors/:id/assessments/:assessmentId` (retomar rascunho/ver histórico sem restrição de
    status - reaproveita `VendorsRepository.findAssessmentById`, já existente) e
    `DELETE /vendors/admin/options/:id` (o `VendorsService.removeOption` já existia desde a Fase 2,
    só não estava exposto no controller). `WorkflowRepository` ganhou `vendorId`/`linkedVendor`
    (snapshot `id/name/currentTier/currentTierLabel`) nos dois selects de `assessment` usados pelo
    inbox de aprovação, pra badge de tier chegar ao frontend sem uma chamada extra. 3 novos testes em
    `vendors.service.spec.ts` cobrindo `getAssessment`.
  - **Navegação**: `/vendors` (permissão `vendors:view`) em `PRIMARY_NAV_ITEMS`,
    `/admin/vendor-questionnaire` (permissão `vendors:manage`) em `ADMIN_NAV_ITEMS`.
  - **`/vendors`**: lista com busca (debounce) + paginação, dialog de criar/editar; **`/vendors/:id`**:
    dados, `TierBadge` ("Tier N · Rótulo", nunca número cru - decisão #4 do plano), histórico de
    avaliações, botão "Nova avaliação". **`/vendors/:id/assessments/:assessmentId`**: formulário de
    ~28 perguntas agrupado por categoria (mesmo padrão Card-por-categoria de
    `assessments/[id]/page.tsx`), salvar rascunho (`PATCH`) e concluir (`PATCH` + `POST .../complete`)
    - uma única rota dinâmica cobre tanto "recém-criado" (a criação do rascunho acontece no clique de
      "Nova avaliação", antes da navegação) quanto "retomar rascunho existente"/"ver concluída", sem
      precisar de uma rota `/new` separada.
  - **`/admin/vendor-questionnaire`**: CRUD de categoria/pergunta/opção, espelhando
    `admin/questionnaire/` mas sem `riskDimension` (tierização é score 1D) e sem o vínculo a
    controles de compliance (não se aplica ao catálogo de fornecedor).
  - **Aba "Tierização de fornecedores" em `/admin/settings`**: diferente das outras abas, não edita
    `Tenant` - busca/salva o `VendorTierConfig` ativo direto (`GET/POST /vendors/admin/tier-configs/*`),
    só visível a quem tem `vendors:manage` (checado além do gate geral `system:configure` da página).
  - **`VendorCombobox`** (`components/vendor-combobox.tsx`, novo `components/ui/popover.tsx` -
    reaproveitando o pacote `radix-ui` unificado já instalado, sem dependência nova) em
    `assessments/new/page.tsx`: busca `GET /vendors?search=`, com fallback "usar texto livre" e
    **"+ cadastrar novo fornecedor" abrindo um modal inline** (`VendorQuickCreateDialog` - só
    `name`+`businessCriticality`, refinamento decidido com o usuário em 2026-07-30) em vez de navegar
    pra fora do formulário.
  - **Badge de tier no `decision-dialog.tsx`**: aditivo, ao lado dos badges de ART/InfoSec já
    existentes - só aparece quando a `Assessment` tem um `Vendor` vinculado com tier calculado.
  - **Validação real em navegador** (não só typecheck/lint/build): script Playwright descartável
    rodou o fluxo completo contra o dev environment real - criar fornecedor → responder as 28
    perguntas com a primeira opção de cada → salvar rascunho → concluir → `Tier 1 · Baixo risco`
    (100% favorável, confirma o mesmo comportamento do teste unitário da Fase 2) → tier refletido no
    detalhe do fornecedor → catálogo admin carrega as 4 categorias/28 perguntas do seed → aba de
    tierização mostra as 4 faixas → combobox encontra o fornecedor por busca e cria um novo via modal
    inline. 15/15 checks passando. Dados de teste (fornecedores criados durante a validação) removidos
    do banco depois.
- **Avaliação de risco de fornecedores, Fase 5 (2026-07-30): `README.md` (PT-BR + EN).** Fecha o
  plano - só documentação, sem código.
  - Reenquadramento da abertura ("O que o Morpheus faz"): deixa de ser só "reduzir Shadow IT" e passa
    a ser gestão de risco de segurança da informação em duas frentes complementares (software +
    fornecedor). Shadow IT continua mencionado, mas como um efeito colateral do canal único de
    adoção formal, não a moldura inteira do produto - e com a ressalva explícita de que o ganho é
    tornar a adoção formal o caminho natural, não detecção ativa (o Morpheus não faz scanning de
    rede/CASB).
  - Novo item 7 na lista numerada de funcionalidades: avaliação de risco de fornecedores.
  - Nova seção "Avaliação de risco de fornecedores (metodologia)" / "Vendor risk assessment
    (methodology)", logo após "Matriz de risco (metodologia)": questionário de 28 perguntas em 4
    categorias, preenchido por analista interno (não é formulário público), citação ao NIST SP
    800-161 (*Cybersecurity Supply Chain Risk Management Practices*), e a lógica de Tier 1=melhor→
    Tier 4=pior com cadência de reavaliação configurável por tier e ajustada pela criticidade do
    fornecedor. Sem screenshot novo nessa fase.
- **Rastreabilidade Inventory↔Vendor, Fase 1 (2026-07-30): backend.** Depois de validar a feature de
  fornecedores em navegador, ficou claro um gap real: `SoftwareInventoryItem.vendor` era só uma
  string livre (snapshot do nome) - não existia FK real pra `Vendor`, mesmo quando a `Assessment` de
  origem já tinha um vinculado. Fase 1 fecha esse gap no backend (frontend nas próximas fases).
  - **Schema**: `SoftwareInventoryItem.vendorId String?` + relação `linkedVendor Vendor?` (`onDelete:
    SetNull`, mesmo padrão de `assessmentId`/`assessment`), `@@index([tenantId, vendorId])`. Migration
    100% aditiva (`ADD COLUMN` + índice + FK, zero `DROP`).
  - `CreateInventoryItemDto`/`UpdateInventoryItemDto` ganham `vendorId?: string` opcional -
    `InventoryRepository.itemDetailInclude` passa a trazer `linkedVendor: {id, name, currentTier,
    currentTierLabel}` (mesmo shape já usado em `WorkflowRepository.stepExecutionDetailInclude` pro
    badge de tier no `decision-dialog.tsx`).
  - `InventoryService.createFromApprovedAssessment()` (+ a interface `ApprovedAssessmentForInventory`)
    propaga `vendorId` nos dois branches (criação e renovação/`existing`); `workflow.service.ts`
    repassa `assessment.vendorId`, que já estava selecionado desde a Fase 4 da feature de
    fornecedores - zero query nova.
  - **Novo endpoint `GET /vendors/tracking`** (`VendorsRepository.findForTracking`): 3 baldes -
    fornecedores nunca avaliados, com reavaliação vencida, e com reavaliação nos próximos 30 dias -
    base pra aba de "Acompanhamento" da Fase 3. Diferente de `findDueForReassessment` (usado pelo
    scheduler), não filtra por `reassessmentNotifiedAt` - é uma tela persistente, não um job de
    notificação única. Registrado antes de `GET /vendors/:id` no controller (rota literal precisa vir
    primeiro, senão `:id` casa antes).
  - **Testes**: `vendors.service.spec.ts` (`getTracking`), `inventory.service.spec.ts`
    (propagação de `vendorId`, incluindo o caso `null` de avaliação sem fornecedor vinculado) - 256
    testes no total em `apps/api`, todos passando. `pnpm --filter @morpheus/api lint/typecheck/build`
    verde.
  - Escopo do pacote completo (1→2→3, confirmado com o usuário via `AskUserQuestion`) e a correção de
    que a tier/score continua automática (sem gate de aprovação) documentados no plano
    (`streamed-sleeping-newell.md`) - Fases 2-4 (frontend + amostras + portfólio) seguem em PRs
    separados.
- **Rastreabilidade Inventory↔Vendor, Fase 2 (2026-07-30): frontend - formulário manual + card de
  ART no detalhe do item.**
  - `item-form-dialog.tsx` (cadastro/edição manual de item de inventário): campo de fornecedor em
    texto livre vira `VendorCombobox` (mesmo componente já usado em `assessments/new`) - busca,
    fallback de texto livre, e "+ cadastrar novo fornecedor" inline. O valor do combobox é derivado
    direto do form (`useWatch` em `vendor`/`vendorId`) em vez de um `useState` paralelo - `reset()`
    já resincroniza os dois campos quando o dialog abre, evitando um efeito redundante (e um lint
    error real de `react-hooks/set-state-in-effect` que a primeira versão, com `useState` +
    `useEffect`, disparava).
  - `[id]/page.tsx` (detalhe do item): novo bloco "ART do fornecedor", ao lado do bloco já existente
    de ART autodeclarada por Assessment (sem alterar aquele) - 3 estados: sem fornecedor vinculado
    (botão "Vincular fornecedor"), fornecedor vinculado mas nunca avaliado (botão "Iniciar ART"), e
    fornecedor com tier calculado (`TierBadge` + link pro fornecedor).
  - **Novo `link-vendor-dialog.tsx`**: vincular fornecedor + iniciar a ART é um fluxo só (decisão
    confirmada com o usuário) - ao selecionar/criar um Vendor no combobox, dispara em sequência
    `PATCH /inventory/:id` (grava `vendorId`) → `POST /vendors/:id/assessments` → navega pra tela da
    avaliação. O fallback de texto livre do combobox não faz sentido aqui (iniciar uma
    `VendorAssessment` exige um `Vendor` real), então só mostra um aviso nesse caso.
  - **Testes**: `pnpm --filter @morpheus/web lint/typecheck/build` verde. Validação real em
    navegador via Playwright descartável: item manual novo com fornecedor cadastrado na hora (cadastro
    rápido) → detalhe mostra "Iniciar ART" → navega pra avaliação; item já existente sem fornecedor
    (`Contract Analyzer AI`) → "Vincular fornecedor" → busca o mesmo fornecedor → navega direto pra
    avaliação. 8/8 checks. Dados de teste removidos do banco depois (inclusive revertendo o
    `vendorId` que o script deixou vinculado no item pré-existente usado no teste).
- **Rastreabilidade Inventory↔Vendor, Fase 3 (2026-07-30): aba "Acompanhamento" em `/vendors` +
  amostras reais.** Fecha o pacote (Fases 1-3).
  - `/vendors/page.tsx` ganha `Tabs` ("Fornecedores" | "Acompanhamento"). Nova
    `vendor-tracking-view.tsx` consome `GET /vendors/tracking` (Fase 1) e mostra 3 cards: nunca
    avaliados, reavaliação vencida e reavaliação nos próximos 30 dias - cada linha linkando pro
    fornecedor, com `TierBadge` e data quando aplicável. É o equivalente, do lado de fornecedores, da
    inbox `/approvals` de Assessment - mas como `VendorAssessment` não tem workflow de aprovação
    (decisão mantida nesta sessão: tier continua automática), é uma visão de monitoramento, não uma
    fila de decisão.
  - **Amostras reais no tenant demo** (dado vivo via API real, não `seed.ts` - mesmo padrão já usado
    pro histórico do projeto): 6 `Vendor` novos, cobrindo os 4 tiers + 1 nunca avaliado, vinculados a
    itens de inventário já existentes via `PATCH /inventory/:id` (reaproveitando os nomes de
    fornecedor em texto livre que já estavam nesses itens - Atlassian/Trello, DocuSign Inc./DocuSign,
    Workday Inc./Workday HR, Fornecedor ERP Legado Ltda/Legacy ERP, LogiTrack Systems/Freight
    Tracking API, Canva Pty Ltd/Canva Pro). `DocuSign Inc.` foi vinculado a dois itens (DocuSign +
    Contract Analyzer AI), demonstrando o relacionamento N:1 de verdade. Respostas do questionário
    calculadas por um script descartável (busca gulosa pela combinação de respostas mais próxima do
    risco médio alvo de cada tier - o catálogo demo é todo `SINGLE_CHOICE` binário, então mirar um
    score por "opção mais próxima de um alvo global" ficava grosseiro demais). Duas datas de
    reavaliação (`Vendor.nextReviewDueAt`) ajustadas manualmente via SQL pra popular os baldes
    "vencida"/"próxima" de propósito - mesmo padrão já usado antes pro exemplo de
    `PENDING_RENEWAL` (dado de demonstração intencional, não revert).
  - **Testes**: `pnpm --filter @morpheus/web lint/typecheck/build` verde. Validação real em
    navegador via Playwright descartável + screenshot manual - os 3 baldes renderizam corretamente
    com as amostras reais (4/4 checks).
- **Rastreabilidade Inventory↔Vendor, Fase 4 (2026-07-30): portfólio.** Fecha o pacote inteiro
  (Fases 1-4) - mudança de UX é gatilho pra atualização de portfólio, mesmo padrão da Fase 5 da
  feature de fornecedores.
  - Novos screenshots (PT-BR+EN, gerados via Playwright contra o ambiente demo com as amostras reais
    da Fase 3): `inventory-item-art{,-en}.png` (card "ART do fornecedor" no detalhe de um item de
    inventário, com `TierBadge` de verdade) e `vendors-acompanhamento{,-en}.png` (aba
    "Acompanhamento" com os 3 baldes populados).
  - `README.md` (PT-BR+EN): duas frases novas na seção "Avaliação de risco de fornecedores
    (metodologia)" mencionando que a ART agora também é acessível/iniciável a partir do Inventory, e
    uma nova tabela de screenshots logo abaixo - mesmo padrão da tabela já existente ali pra
    matriz de risco.
- **Auditoria de portfólio pós-feature de fornecedores (2026-07-30).** O usuário revisou a Fase 4
  acima com mais rigor e apontou 3 problemas reais que a fase anterior deixou passar - portfólio é
  tratado como material de venda do projeto, não um anexo qualquer:
  - **A entidade `Vendor` nunca teve print de verdade** (lista/detalhe com tier), em nenhum idioma -
    a feature original (Fases 1-5) explicitamente pulou screenshots. Novos: `vendors-lista{,-en}.png`
    e `vendors-detalhe{,-en}.png` (Atlassian, Tier 1) adicionados à galeria principal ("Telas"/
    "Screenshots") do `README.md`, PT-BR+EN.
  - **14 screenshots pré-existentes estavam desatualizados** - todos os que mostram a sidebar
    (`dashboard-{minha-visao,administrativo,executivo,placar-por-area}`, `busca-rapida`,
    `admin-papeis`, `risk-matrix-config`, PT-BR+EN) foram capturados antes do PR #86 (Fase 4 da
    feature de fornecedores) e não tinham "Fornecedores"/"Vendors" no menu. Todos regenerados. De
    quebra, também padronizados os 2 screenshots da Fase 4 anterior
    (`inventory-item-art`/`vendors-acompanhamento`, que tinham viewport 1280×800 em vez do padrão
    1280×900 do resto do repositório) e removido um rascunho de avaliação de teste ("sss") esquecido
    no banco que estava poluindo o dashboard "Minha visão" nos prints novos.
  - **`docs/architecture.md` estava desatualizado**: dizia "36 modelos" (hoje são 46), e os diagramas
    ER não tinham nenhuma entidade `Vendor*` nem as FKs novas (`Assessment.vendorId`,
    `SoftwareInventoryItem.vendorId`). Nova seção "Fornecedores e tierização" com o diagrama ER
    completo dos 9 modelos (`Vendor`, `VendorQuestionCategory/Question/Option`,
    `VendorTierConfig/Threshold`, `VendorAssessment`, `VendorAnswer/Option`), e as duas FKs
    adicionadas aos diagramas de "Avaliação e workflow" e "Pós-aprovação". `docs/DEVELOPMENT.md` e
    `docs/security.md` foram checados e confirmados como não afetados (escopo deles é setup/processo,
    não narrativa de feature - essa vive só no `CHANGELOG.md`).
  - **Como aplicar daqui pra frente**: qualquer mudança de UX com impacto moderado ou maior (nova
    entidade no menu principal, nova tela, fluxo novo) exige revisar TODO o portfólio afetado antes
    de considerar a fase terminada - não só adicionar o print da mudança em si, mas checar se ela
    invalida prints/documentação já existentes.
- **Política de senha (plataforma), Fase 1 (2026-07-31): schema + seed.** Início do primeiro item do
  backlog de "Autenticação" (registrado 2026-07-26). Investigação revelou que hoje não existe
  nenhum fluxo de senha no produto além do seed - `CreateUserDto` não tem campo de senha, não há
  `changePassword`/`resetPassword` em lugar nenhum da API, e a única forma de login local é a senha
  plantada pelo seed. Uma política de complexidade sozinha não teria onde se aplicar - por isso o
  escopo (confirmado com o usuário) inclui, nas próximas fases, o mínimo de fluxo de senha
  necessário para validá-la de verdade, não só a tela de configuração.
  - Novo model `PlatformPasswordPolicy` (`packages/database/prisma/schema.prisma`) - **primeiro
    model genuinamente cross-tenant do sistema além de `Permission`**: tudo mais configurável hoje é
    por-`Tenant`. Singleton por id fixo (`"singleton"`), nunca `create` genérico. Campos:
    `minLength` (padrão 8) + 4 toggles independentes (`requireUppercase/Lowercase/Digit/Symbol`,
    todos `true` por padrão). Sem expiração nem histórico/bloqueio de reuso - fora de escopo por
    decisão explícita.
  - Seed cria a linha singleton via `upsert` fora de `seedFullTenant()` (roda uma vez, não por
    tenant); confirmado que `SEED_PASSWORD = "Demo@12345"` já satisfaz os defaults.
  - `docs/architecture.md`: novo model no diagrama ER de "Tenancy e RBAC" (entidade solta, sem
    relação - mesmo tratamento de `PERMISSION`), contagem de modelos 46→47.
  - **Testes**: `migrate:dev` limpo, seed roda e deixa exatamente uma linha `id="singleton"`, seed
    re-executado confirma idempotência (upsert, sem duplicata). `pnpm --filter @morpheus/database
    build` e `pnpm --filter @morpheus/api typecheck` verdes.
- **Política de senha (plataforma), Fase 2 (2026-07-31): backend - CRUD da política + definição/
  validação de senha.** Fecha o backend inteiro da feature de uma vez (política + os pontos de
  aplicação viajam juntos no mesmo PR de propósito - um PR intermediário só com a política, sem
  nada aplicando ela de verdade, não seria útil sozinho).
  - Novo módulo enxuto `apps/api/src/modules/platform-policy/`: `password-policy.util.ts` (função
    pura, sem banco, mesmo padrão de `vendor-tier.util.ts` - `validatePasswordAgainstPolicy`
    retorna as mensagens das regras violadas), `password-policy.repository.ts`/`.service.ts`
    (`getPolicy`/`updatePolicy`/`validate` - esse último é o seam único chamado por todo lugar que
    define/troca uma senha), `password-policy.controller.ts` (`GET /platform/password-policy`
    aberto a qualquer usuário autenticado - são as regras vigentes, não quem as definiu, e todo
    mundo precisa lê-las antes de definir uma senha; `PATCH` restrito a `platform:cross-tenant`).
  - `UsersModule` ganha `POST /users/:id/password` (`users:manage`) - mesma rota tanto pra dar a
    primeira senha de um usuário recém-criado quanto pra resetar a de um já existente/trancado fora,
    de propósito: "definir senha" fica desacoplado de "criar usuário", o que deixa uma futura virada
    pra convite por e-mail sem precisar rearquitetar a criação. Auditoria (`AuditLogService.record`,
    não `@Audit()`) grava `metadata: {passwordChange: true, initiatedBy: "admin"}`.
  - `AuthController` ganha `PATCH /auth/password` (autoatendimento, sem permissão especial -
    qualquer usuário troca a própria senha) - exige confirmar a senha atual (`bcrypt.compare`),
    rejeita usuário SSO-only (`passwordHash` nulo) com mensagem explícita, mesmo limite de força
    bruta do login (`@Throttle 5/60s`). Auditoria com `initiatedBy: "self"`.
  - **Testes**: `password-policy.util.spec.ts` (10 casos, toda regra individual + combinações +
    limite exato). Primeiro `users.service.spec.ts` do projeto (9 casos): rejeita senha fraca sem
    chamar o repositório, rejeita usuário de outro tenant, rejeita senha atual errada, rejeita
    usuário SSO-only, grava auditoria com o `initiatedBy` certo em cada caminho. `pnpm --filter
    @morpheus/api lint/typecheck/test/build` verdes (273 testes, 32 suítes). Checklist manual via
    curl contra o `demo` seedado cobrindo os 10 cenários do plano (GET aberto, PATCH 403/200,
    `POST :id/password` fraca/válida/cross-tenant, `PATCH /auth/password` senha errada/SSO-only/
    happy path, throttle) - todos bateram exatamente como esperado (usuários de teste descartáveis
    criados e removidos via SQL ao final, sem deixar rastro no ambiente demo).
- **Política de senha (plataforma), Fase 3 (2026-07-31): frontend - tela de configuração
  (super-admin).** Nova rota `/admin/platform-policy`, gated `AdminSectionGate
  permission="platform:cross-tenant"` (primeira tela do projeto restrita a essa permissão
  especificamente, fora `switch-tenant`) - entrada nova em `ADMIN_NAV_ITEMS`
  (`nav-items.ts`, fonte única compartilhada pela sidebar e pelos cards de `/admin`).
  - Formulário único (`react-hook-form` + `zod`): campo numérico `minLength` (8-128) + 4
    checkboxes independentes, mesmo padrão de `RenewalWindowForm`/`VendorTierForm` já existentes
    em `admin/settings/page.tsx`. `GET`/`PATCH /platform/password-policy` via `useApi()`.
  - Novo `lib/platform-policy-types.ts` + namespace i18n `AdminPlatformPolicy` (PT-BR/EN).
  - **Gotcha de ambiente, não de código**: as portas padrão 3000/3001 caíram numa faixa que o
    Windows reserva dinamicamente pro Hyper-V/WSL2 (`netsh interface ipv4 show
    excludedportrange` mostrou o bloco inteiro 2406-3305 excluído) - `EACCES` ao subir tanto a API
    quanto a Web. Contornado rodando os dois em portas alternativas (4000/4001) fora de qualquer
    faixa excluída; também expôs que `turbo run dev` roda em modo estrito de variáveis de
    ambiente e descarta overrides inline de `PORT`/`API_PORT` passados na shell - resolvido
    chamando `pnpm --filter` diretamente em cada app (bypassa o turbo), e ajustando `CORS_ORIGIN`
    da API pra apontar pra porta nova da Web.
  - **Testes**: `pnpm --filter @morpheus/web lint/typecheck/build` verdes. Validação real em
    navegador via Playwright descartável (9 checks): card visível/ausente conforme a permissão,
    form pré-preenchido, round-trip de salvar→persistir→reverter confirmado após reload, e as
    duas camadas de gate confirmadas separadamente - `AdminLayout` (sem nenhum acesso admin, vai
    pra `/dashboard`) e `AdminSectionGate` (tem acesso admin mas não `platform:cross-tenant`,
    volta pra `/admin`) - usando três contas demo diferentes (`admin@morpheus.demo`,
    `usuario@morpheus.demo`, `admin@zion.morpheus.demo`) pra cobrir os três casos reais.
- **Política de senha (plataforma), Fase 4 (2026-07-31): criação em 2 passos + reset admin +
  autoatendimento.** Fecha o pacote inteiro (Fases 1-4) - o backend da Fase 2 tinha os endpoints,
  esta fase é a UI que finalmente os expõe pros três fluxos reais de uso.
  - `create-user-dialog.tsx` vira um fluxo de 2 passos dentro do mesmo `Dialog`: passo 1 é o form
    de criação já existente (sem mudança); ao suceder, avança pro passo 2 (`set-password-form.tsx`,
    novo componente reusável, sem `Dialog` próprio) - campo de senha + confirmação + dica das
    regras vigentes (`GET /platform/password-policy`). "Pular por agora" fecha o dialog sem senha
    (usuário fica SSO-only, estado já válido hoje).
  - `set-password-form.tsx` é reusado também em `reset-password-dialog.tsx` (novo, mesmo padrão de
    arquivo de `role-assignment-dialog.tsx`) - novo botão "Redefinir senha" por linha em
    `admin/users/page.tsx`, ao lado de "Gerenciar papéis"/"Ativar". Mesma rota/DTO/service-method
    da Fase 2 pros dois casos (primeira senha ou reset) - só uma UI a mais.
  - Novo `components/change-password-dialog.tsx` (autoatendimento) + item "Trocar senha" no menu
    do avatar (`app-sidebar.tsx`), entre o separador e "Sair" - `PATCH /auth/password`, exige senha
    atual, sem detecção client-side de SSO-only (o 400 do backend estoura como qualquer erro de
    formulário).
  - Novo `lib/use-password-policy.ts` (hook) + `components/password-policy-hint.tsx` (dica
    compacta das regras vigentes) - reusados nos três formulários de senha (criação, reset,
    autoatendimento) a partir de um único fetch da política.
  - **Testes**: `pnpm --filter @morpheus/web lint/typecheck/build` verdes. Validação real em
    navegador via Playwright descartável (12 checks): criar usuário → senha fraca rejeitada com
    mensagem específica → senha válida → login funciona; "pular por agora" deixa o usuário
    SSO-only (login local falha de verdade); "Redefinir senha" na listagem funciona; autoatendimento
    (senha atual errada rejeitada, senha nova fraca rejeitada, fluxo correto funciona, senha antiga
    para de funcionar, senha nova funciona). Achado no meio do caminho (não é bug): o próprio script
    de teste bateu no rate-limit de `/auth/login` (5/60s) por fazer muitos logins seguidos em menos
    de um minuto - confirmado via log da API (`429`, `retry-after: 60`), não uma falha do produto;
    reconfirmado o último caso isoladamente depois que a janela expirou. Usuários de teste
    descartáveis criados/removidos via SQL ao final, sem deixar rastro no ambiente demo.

