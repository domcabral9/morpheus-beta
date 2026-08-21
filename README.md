# Morpheus

**Projeto educacional / portfólio.** Não é software em produção nem um produto comercial - foi
construído do zero, etapa por etapa, para praticar (e demonstrar) engenharia full-stack aplicada a
um problema real de segurança da informação, com os controles que um time de blueteam
normalmente cobra de qualquer sistema que lida com dados sensíveis: controle de acesso granular,
trilha de auditoria, hardening de API, observabilidade.

## O que o Morpheus faz

Centraliza a gestão de risco de segurança da informação em duas frentes complementares: o software
adotado pela empresa e o fornecedor por trás dele. Do questionário de risco à decisão final:

1. Questionário de risco (perguntas ponderadas, vinculadas a controles de compliance).
2. Matriz de decisão configurável (faixas de probabilidade × impacto → classificação de risco).
3. Workflow de aprovação com etapas e responsáveis configuráveis por tenant.
4. Parecer técnico em PDF, com QR Code de verificação, contexto executivo, metodologia do cálculo de
   risco, conformidade do fornecedor, sinais de enriquecimento do item de inventário vinculado e
   recomendações de reenvio quando reprovado - gerado de forma 100% determinística (templates sobre
   dado real já persistido), sem nenhuma chamada a IA externa.
5. Inventário de software homologado, com ciclo de revisão periódica. Itens cadastrados manualmente
   (fora da homologação) passam por um gate de aprovação próprio antes de entrar em produção.
6. Dashboards de postura de conformidade, conformidade contra frameworks de segurança (ISO 27001/
   27002, NIST CSF, CIS Controls v8, LGPD, GDPR, OWASP ASVS/Top 10) e placar de maturidade por área.
7. Avaliação de risco de fornecedores, com questionário inspirado no NIST SP 800-161, pontuação
   automática e Tiers de monitoramento com cadência de reavaliação configurável.
8. Enriquecimento automático do inventário: ciclo de vida de versão (endoflife.date) e reputação de ameaça
   (VirusTotal) - configurável pelo super-admin, nunca bloqueia a leitura do inventário se o
   terceiro estiver indisponível.
9. Central de notificações (sino no cabeçalho + histórico paginado), com conteúdo localizado em
   PT-BR/EN - cada notificação carrega dados estruturados, não texto fixo, então o mesmo evento
   aparece no idioma de quem está lendo.

Um efeito direto disso: como toda nova contratação passa por um canal único e fica registrada num
inventário central, o processo também fortalece a governança corporativa e reduz Shadow IT - o
ganho vem de tornar a adoção formal o caminho natural (com dono e trilha de auditoria), não de
detectar ativamente o que já roda às escondidas.

## Matriz de risco (metodologia)

O motor de risco segue uma abordagem clássica de avaliação - probabilidade × impacto - alinhada com
frameworks reconhecidos como o NIST SP 800-30 (*Guide for Conducting Risk Assessments*): cada
pergunta do questionário contribui, com peso próprio, para uma das duas dimensões (ou ambas), e o
resultado é classificado contra faixas configuráveis pelo administrador.

Nada disso é fixo em código. Por tenant, é possível parametrizar quantas faixas de probabilidade e
de impacto existem, como elas se cruzam numa grade de decisão (heatmap), o texto de recomendação e
a cor de cada classificação, e o score mínimo de aprovação - inclusive versionar a matriz inteira
(ativar uma "Matriz Padrão v2" sem perder o histórico das avaliações já decididas contra a versão
anterior).

| Matriz de risco - grade de decisão | Dashboard executivo - postura de conformidade |
| --- | --- |
| ![Matriz de risco](./docs/screenshots/risk-matrix-config.png) | ![Postura de conformidade](./docs/screenshots/dashboard-executivo.png) |

## Avaliação de risco de fornecedores (metodologia)

Além de homologar o software, um analista interno registra o fornecedor por trás dele e responde um
questionário de 28 perguntas (dados cadastrais/contratuais, política de segurança da informação,
gestão de vulnerabilidades e incidentes, continuidade e disponibilidade) - inspirado nas práticas de
gestão de risco de cadeia de suprimentos do NIST SP 800-161 (*Cybersecurity Supply Chain Risk
Management Practices*). Não é um formulário público: só quem já tem acesso ao Morpheus preenche, com
base em contrato/documentação recebida do fornecedor.

Ao concluir a avaliação, a pontuação é calculada automaticamente (mesmo motor de score do
questionário de software) e classificada num Tier de monitoramento - Tier 1 é o melhor cenário
(menos acompanhamento), Tier 4 o pior (acompanhamento mais próximo). Cada Tier tem um intervalo base
de reavaliação configurável pelo administrador, ajustado pela criticidade de negócio do fornecedor
(de fornecedores críticos, reavaliados com mais frequência, a fornecedores de baixa criticidade,
revisados com menos frequência).

O fornecedor por trás de um software já homologado também é rastreável: a partir do detalhe de
qualquer item do inventário é possível ver a ART do fornecedor vinculado (ou iniciar uma, se ainda
não existir), e a aba "Acompanhamento" em Fornecedores dá uma visão consolidada de quem nunca foi
avaliado ou está com reavaliação vencida/próxima.

O cadastro mínimo de um fornecedor (nome + criticidade) pode ser feito às pressas durante a criação
de uma avaliação, mas um badge "Cadastro incompleto" sinaliza em `/vendors` sempre que faltar Razão
Social ou CNPJ - e a decisão de aprovação de uma avaliação vinculada a esse fornecedor fica bloqueada
até o cadastro ser completado, sem nunca travar o início da homologação em si. Um administrador pode
excluir um fornecedor pela tela de detalhe, mas só quando ele for genuinamente órfão (sem nenhum
software de inventário, avaliação ou ART vinculados) - se houver qualquer vínculo ativo, o sistema
mostra exatamente quais são e oferece um atalho direto para os softwares vinculados.

| ART do fornecedor no detalhe do item | Acompanhamento de fornecedores |
| --- | --- |
| ![ART do fornecedor](./docs/screenshots/inventory-item-art.png) | ![Acompanhamento de fornecedores](./docs/screenshots/vendors-acompanhamento.png) |

Além do par original (ART, cláusula de segurança da informação), a avaliação de software também pode
declarar Relatório SOC 2 e certificado ISO 27001 - diferente do par original, essas duas exigem um
anexo real na categoria correspondente antes do envio, não são só uma marcação de confiança. Quando uma
avaliação de SaaS já aponta um desses documentos, a ART do mesmo fornecedor mostra um painel de
reaproveitamento, evitando pedir o mesmo relatório de novo.

## Enriquecimento de inventário (metodologia)

Além dos sinais autodeclarados (ART, cláusula de segurança da informação), cada item do inventário
pode ganhar três sinais automáticos, consultados sob demanda ou por uma varredura noturna. A checagem
de reputação de ameaça soma o clique manual e a varredura num único orçamento diário compartilhado,
pra nunca estourar a cota gratuita do VirusTotal, mesmo somando cliques de vários usuários; ciclo de
vida de versão e exposição externa consultam APIs públicas sem chave, sem esse teto - só um ritmo interno
responsável para não martelar o terceiro:

- **Ciclo de vida de versão**: vínculo manual com o catálogo do [endoflife.date](https://endoflife.date/)
  (sincronizado localmente todo dia) - compara a versão cadastrada do item contra o ciclo de release
  correspondente e classifica "em dia" ou "desatualizada". A comparação é deliberadamente
  conservadora: sem um match exato de ciclo, o resultado é "desconhecido", nunca um veredito
  arriscado.
- **Reputação de ameaça**: checagem passiva no [VirusTotal](https://www.virustotal.com/) por hash de
  anexo (precedência) ou URL do item - nunca envia mais que o artefato necessário, nunca dados
  identificáveis do tenant. Um hash/URL que o VirusTotal nunca viu antes vira "não verificado", jamais
  "limpo" por omissão. Para software obviamente confiável sem artefato pra checar (ex. um SaaS
  comercial conhecido), existe também uma flag manual "declarado conhecido".
- **Exposição externa**: consulta passiva na [Shodan InternetDB](https://internetdb.shodan.io/) a
  partir do IP público resolvido da URL do item - portas abertas, CPEs, hostnames e vulnerabilidades
  conhecidas já indexadas pela Shodan (nunca um scan em tempo real). IPs privados/reservados são
  descartados antes de qualquer consulta - o código nunca faz uma requisição para o host do próprio
  item, só resolve o DNS localmente e consulta a Shodan com a string do IP. Um IP nunca indexado (ou
  descartado por ser privado) vira "não verificado", nunca "sem vulnerabilidades" por omissão.

As três integrações são opcionais e configuradas pelo super-admin numa tela central - e, seguindo a
mesma premissa de resiliência do resto do sistema, a indisponibilidade de qualquer uma delas nunca
compromete a leitura normal do inventário: os dados exibidos vêm sempre do último resultado já salvo,
nunca de uma chamada ao vivo durante a navegação.

| Ciclo de vida de versão no detalhe do item | Reputação de ameaça no detalhe do item |
| --- | --- |
| ![Ciclo de vida de versão](./docs/screenshots/inventory-freshness.png) | ![Reputação de ameaça](./docs/screenshots/inventory-reputation.png) |

| Exposição externa no detalhe do item |
| --- |
| ![Exposição externa](./docs/screenshots/inventory-exposure.png) |

## Conformidade com frameworks de segurança (metodologia)

Todo controle que uma pergunta do questionário avalia - seja do questionário de software ou do de
fornecedor - é rastreado contra um catálogo de referência com 77 controles reais, cobrindo 8
frameworks: ISO/IEC 27001:2022, ISO/IEC 27002, NIST Cybersecurity Framework (CSF 2.0), CIS Controls
v8, LGPD, GDPR, OWASP ASVS e OWASP Top 10. A aba "Conformidade" em `/dashboards` cruza esse catálogo
com a última avaliação já aprovada de cada software e a última concluída de cada fornecedor, e mostra,
por framework, quantos "atendem" cada controle - um controle só conta como atendido quando todas as
respostas do questionário vinculadas a ele estiverem dentro do limiar de risco aceitável.

| Dashboard - conformidade com frameworks (CIS/NIST/ISO) |
| --- |
| ![Dashboard - conformidade](./docs/screenshots/dashboard-conformidade.png) |

## Controles de segurança implementados

- **RBAC granular por permissão** (não só por papel), com decorators dedicados para composição
  AND/OR de permissões - `apps/api/src/common/decorators`, `common/guards`.
- **Autenticação**: JWT de acesso curto + refresh token via cookie httpOnly, SSO via SAML
  genérico/plugável (login local convive com SSO, nunca exclusivo).
- **2FA via TOTP (RFC 6238)**, autoatendimento completo (QR code, códigos de backup de uso único,
  desativação/regeneração com reautenticação) - implementação própria sobre `node:crypto`, sem
  dependência de terceiros. Toggle de recomendação por plataforma inteira, e revisão de segurança
  dedicada encontrou e corrigiu um bypass real (login via SSO ignorava o segundo fator) antes de ir
  ao ar.
- **Recuperação de conta assistida por administrador**: quando um usuário perde a senha e os
  códigos de backup do 2FA ao mesmo tempo (lockout total, sem caminho de autoatendimento possível),
  um admin do próprio tenant pode forçar a desativação do 2FA de um terceiro sem a senha dele -
  ação bloqueada contra o próprio ator (evita contornar a reautenticação normal do autoatendimento),
  registrada em auditoria com o administrador identificado, e a pessoa afetada é avisada por e-mail.
- **Login sem senha (passwordless)**: código de 6 dígitos por e-mail, digitado - não um link
  clicável, escolha deliberada para não depender de scanners de e-mail corporativo não
  pré-consumirem o token. Condicionado a um pré-requisito formal de e-mail verificado
  (autoatendimento em `/profile`) e a um toggle de plataforma inteira. Decisão de design deliberada:
  posse do e-mail substitui os dois fatores tradicionais nesse caminho específico, pulando o 2FA
  mesmo em contas com TOTP habilitado - a revisão de segurança dedicada dessa feature também
  encontrou e corrigiu um achado real antes de ir ao ar (o toggle de plataforma não interrompia um
  login já em andamento com um código ainda válido).
- **Política de senha configurável, plataforma inteira**: tamanho mínimo e classes de caractere
  exigidas (maiúscula/minúscula/dígito/símbolo) definidos por super-admin em `/admin/platform-policy`
  e aplicados a todo tenant - autoatendimento de troca de senha e reset administrativo reusam a
  mesma validação.
- **Trilha de auditoria**: interceptor dedicado registra CREATE/UPDATE/DELETE/LOGIN/... com ator,
  entidade e IP, consultável em `/admin/audit-logs`.
- **CSRF via double-submit cookie**, sanitização global de entrada, rate limiting configurável por
  endpoint (`@nestjs/throttler`, limites mais estritos em rotas sensíveis).
- **Criptografia em repouso (AES-256-GCM)** para campos sensíveis via `CryptoService`.
- **Observabilidade**: logs estruturados, correlation ID, métricas Prometheus, tracing
  OpenTelemetry.
- **Multi-tenancy row-level**, isolamento por `tenantId` em toda query, banco único - com acesso
  cross-organização restrito a super-admins (permissão dedicada + trilha de auditoria própria),
  sem afetar o isolamento padrão de nenhum outro usuário.

**Isso também vale para o próprio repositório**, não só para o produto: CI obrigatório, branch
protection e uma janela semanal combinada de revisão de vulnerabilidades (Dependabot).

```mermaid
flowchart LR
    A[Dependabot\ndetecta CVE] --> B{Crítico + exploit\npúblico conhecido?}
    B -->|Sim| C[Corrigido\nimediatamente]
    B -->|Não| D[Janela semanal\nde revisão]
    D --> E[Classificado por risco\ne registrado]
```

Processo completo (camadas de risco, histórico de cada janela) em
[`docs/security.md`](./docs/security.md).

## Telas

| Minha visão | Administrativo |
| --- | --- |
| ![Dashboard - minha visão](./docs/screenshots/dashboard-minha-visao.png) | ![Dashboard - administrativo](./docs/screenshots/dashboard-administrativo.png) |

| Executivo | Placar por área |
| --- | --- |
| ![Dashboard - executivo](./docs/screenshots/dashboard-executivo.png) | ![Dashboard - placar por área](./docs/screenshots/dashboard-placar-por-area.png) |

| Conformidade com frameworks (CIS/NIST/ISO) |
| --- |
| ![Dashboard - conformidade](./docs/screenshots/dashboard-conformidade.png) |

| Questionário de risco - abas por categoria | Aprovação - dialog de decisão |
| --- | --- |
| ![Questionário em abas](./docs/screenshots/questionario-abas.png) | ![Aprovação - dialog de decisão](./docs/screenshots/approvals-decisao.png) |

| Parecer técnico - PDF com QR Code de verificação | Pareceres técnicos - quem emitiu |
| --- | --- |
| ![Parecer técnico - PDF](./docs/screenshots/parecer-pdf.png) | ![Pareceres técnicos](./docs/screenshots/pareceres-tecnicos.png) |

| Inventário - lista completa | Aprovação de item de inventário manual |
| --- | --- |
| ![Inventário - lista](./docs/screenshots/inventory-lista.png) | ![Aprovação de item de inventário manual](./docs/screenshots/inventory-approval-queue.png) |

| Item reprovado - motivo e reenvio | Aprovação - solicitante identificado |
| --- | --- |
| ![Item reprovado](./docs/screenshots/inventory-approval-rejected.png) | ![Aprovação - solicitante](./docs/screenshots/approvals-solicitante.png) |

| Fornecedores - lista com tierização | Fornecedores - detalhe |
| --- | --- |
| ![Fornecedores - lista](./docs/screenshots/vendors-lista.png) | ![Fornecedores - detalhe](./docs/screenshots/vendors-detalhe.png) |

| Exclusão de fornecedor - bloqueada por vínculo ativo |
| --- |
| ![Exclusão bloqueada](./docs/screenshots/vendors-exclusao-bloqueada.png) |

| Avaliação de fornecedor - quem realizou | Auditoria - quem fez o quê |
| --- | --- |
| ![Avaliação - realizada por](./docs/screenshots/vendors-avaliacao-realizada-por.png) | ![Auditoria](./docs/screenshots/admin-auditoria.png) |

| Administração - gestão de papéis | Políticas de plataforma (super-admin) |
| --- | --- |
| ![Administração - papéis](./docs/screenshots/admin-papeis.png) | ![Políticas de plataforma](./docs/screenshots/admin-platform-policy.png) |

| Central de notificações - dropdown | Central de notificações - histórico |
| --- | --- |
| ![Notificações - dropdown](./docs/screenshots/notifications-dropdown.png) | ![Notificações - histórico](./docs/screenshots/notifications-page.png) |

## Stack

| Camada          | Tecnologia                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Backend         | Node.js, TypeScript, NestJS 11                                          |
| Frontend        | Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui              |
| Banco de dados  | PostgreSQL 16, Prisma ORM 7                                              |
| Autenticação    | JWT + Refresh Token, SSO via SAML genérico/plugável, 2FA (TOTP)         |
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

A API é documentada via Swagger/OpenAPI (`@nestjs/swagger`), disponível em `/docs` com o servidor
local rodando - toda rota, DTO e esquema de autenticação (Bearer JWT) gerado automaticamente a
partir do código, não mantido à parte. Pensado para facilitar integrações futuras: qualquer time
que precise consumir a API tem ali um contrato navegável e sempre atualizado, sem depender deste
README ou de documentação escrita à mão.

## Documentação técnica completa

- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) - referência enxuta: stack, estrutura, como rodar,
  CI/proteção do `main`.
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) - histórico de decisões etapa a etapa/PR a PR, mantido
  de propósito como um diário de bordo técnico: trade-offs considerados, bugs reais encontrados e como
  foram corrigidos.
- [`docs/architecture.md`](./docs/architecture.md) - diagramas de modelo de dados e topologia de
  deploy.
- [`docs/security.md`](./docs/security.md) - SSDLC: CI, branch protection, Dependabot e o processo
  de revisão semanal de vulnerabilidades.
- [`docs/style-guide.md`](./docs/style-guide.md) - convenções de escrita aplicadas a todo texto do
  projeto.
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

Centralizes information-security risk management on two complementary fronts: the software adopted
by the company and the vendor behind it. From risk questionnaire to final decision:

1. Risk questionnaire (weighted questions, linked to compliance controls).
2. Configurable decision matrix (probability × impact ranges → risk classification).
3. Approval workflow with configurable steps and responsible roles per tenant.
4. Technical opinion (PDF report), with a verification QR code, executive context, an explanation of
   the risk calculation methodology, vendor compliance, the linked inventory item's enrichment
   signals, and resubmission recommendations when rejected - generated fully deterministically
   (templates over already-persisted real data), with no external AI call whatsoever.
5. Homologated software inventory, with periodic review cycle. Manually registered items (outside the
   homologation flow) go through a dedicated approval gate before going live.
6. Compliance-posture dashboards, compliance against security frameworks (ISO 27001/27002, NIST CSF,
   CIS Controls v8, LGPD, GDPR, OWASP ASVS/Top 10), and a maturity leaderboard by area.
7. Vendor risk assessment, with a questionnaire inspired by NIST SP 800-161, automatic scoring, and
   monitoring Tiers with configurable reassessment cadence.
8. Automatic inventory enrichment: version lifecycle (endoflife.date) and threat reputation
   (VirusTotal) - configurable by the super-admin, never blocks inventory reads if the third party
   is unavailable.
9. Notification center (header bell + paginated history), with localized PT-BR/EN content - each
   notification carries structured data, not fixed text, so the same event renders in whichever
   language the reader is using.

A direct side effect: since every new acquisition goes through a single channel and lands in a
central inventory, the process also strengthens corporate governance and reduces Shadow IT - the
gain comes from making formal adoption the natural path (with an owner and an audit trail), not
from actively detecting what's already running under the radar.

## Risk matrix (methodology)

The risk engine follows a classic likelihood × impact assessment approach, aligned with recognized
frameworks such as NIST SP 800-30 (*Guide for Conducting Risk Assessments*): each questionnaire
question contributes, with its own weight, to one of the two dimensions (or both), and the result
is classified against admin-configurable bands.

None of this is hardcoded. Per tenant, you can configure how many probability and impact bands
exist, how they intersect in a decision grid (heatmap), each classification's recommendation text
and color, and the minimum approval score - including versioning the whole matrix (activate a
"Standard Matrix v2" without losing the history of assessments already decided against the
previous version).

| Risk matrix - decision grid | Executive dashboard - compliance posture |
| --- | --- |
| ![Risk matrix](./docs/screenshots/risk-matrix-config-en.png) | ![Compliance posture](./docs/screenshots/dashboard-executivo-en.png) |

## Vendor risk assessment (methodology)

Beyond homologating the software itself, an internal analyst registers the vendor behind it and
answers a 28-question questionnaire (registration/contractual data, information security policy,
vulnerability and incident management, continuity and availability) - inspired by the supply-chain
risk management practices in NIST SP 800-161 (*Cybersecurity Supply Chain Risk Management
Practices*). It's not a public form: only users who already have Morpheus access fill it in, based
on the contract/documentation received from the vendor.

Once the assessment is completed, the score is calculated automatically (the same scoring engine
used for the software questionnaire) and classified into a monitoring Tier - Tier 1 is the best-case
scenario (least oversight), Tier 4 the worst (closest oversight). Each Tier has an admin-configurable
base reassessment interval, adjusted by the vendor's business criticality (critical vendors get
reassessed more often, low-criticality vendors less often).

The vendor behind an already-homologated piece of software is traceable too: from any inventory
item's detail page you can see the linked vendor's ART (or start one, if it doesn't exist yet), and
the "Tracking" tab under Vendors gives a consolidated view of who's never been assessed or has an
overdue/upcoming reassessment.

A vendor's minimum registration (name + criticality) can be rushed through while creating an
assessment, but an "Incomplete registration" badge flags it in `/vendors` whenever the legal name or
tax ID is missing - and the approval decision on any assessment linked to that vendor stays blocked
until the registration is completed, without ever blocking the homologation itself from starting. An
administrator can delete a vendor from its detail page, but only when it's genuinely orphaned (no
linked inventory software, assessment, or ART) - if there's any active link, the system shows exactly
what they are and offers a direct shortcut to the linked software.

| Vendor ART on the item detail page | Vendor tracking |
| --- | --- |
| ![Vendor ART](./docs/screenshots/inventory-item-art-en.png) | ![Vendor tracking](./docs/screenshots/vendors-acompanhamento-en.png) |

Beyond the original pair (ART, information security clause), a software assessment can also declare a
SOC 2 report and an ISO 27001 certificate - unlike the original pair, these two require a real
attachment in the matching category before submission, not just a trust checkbox. When a SaaS
assessment already points to one of those documents, the same vendor's ART shows a reuse panel, so the
same report isn't requested again.

## Inventory enrichment (methodology)

Beyond the self-declared signals (ART, information security clause), every inventory item can carry
three automatic signals, checked on demand or by a nightly sweep. The threat reputation check pools
manual clicks and the sweep into a single shared daily budget, so it never exceeds VirusTotal's
free-tier cap even counting clicks from multiple users; version lifecycle and external exposure query
free, keyless public APIs with no such cap - just an internal responsible pace so the third party
isn't hammered:

- **Version lifecycle**: a manual link to the [endoflife.date](https://endoflife.date/) catalog
  (synced locally every day) - compares the item's registered version against the matching release
  cycle and classifies it "up to date" or "outdated". The comparison is deliberately conservative:
  without an exact cycle match, the result is "unknown", never a risky guess.
- **Threat reputation**: a passive lookup on [VirusTotal](https://www.virustotal.com/) by attachment
  hash (takes precedence) or the item's URL - never sends more than the artifact itself, never any
  tenant-identifying data. A hash/URL VirusTotal has never seen becomes "unverified", never "clean"
  by omission. For software that's obviously trustworthy with no artifact to check (e.g. a well-known
  commercial SaaS), there's also a manual "declared known" flag.
- **External exposure**: a passive lookup on [Shodan InternetDB](https://internetdb.shodan.io/) from
  the public IP resolved out of the item's URL - open ports, CPEs, hostnames, and known
  vulnerabilities Shodan already has indexed (never a real-time scan). Private/reserved IPs are
  discarded before any lookup happens - the code never issues a request to the item's own host, it
  only resolves DNS locally and queries Shodan with the IP as a string. An IP Shodan has never
  indexed (or one discarded for being private) becomes "unverified", never "no known
  vulnerabilities" by omission.

All three integrations are optional and configured by the super-admin in a central screen - and,
following the same resilience premise as the rest of the system, any one of them being unavailable
never compromises normal inventory reads: the data shown always comes from the last saved result,
never a live call made while browsing.

| Version lifecycle on the item detail page | Threat reputation on the item detail page |
| --- | --- |
| ![Version lifecycle](./docs/screenshots/inventory-freshness-en.png) | ![Threat reputation](./docs/screenshots/inventory-reputation-en.png) |

| External exposure on the item detail page |
| --- |
| ![External exposure](./docs/screenshots/inventory-exposure-en.png) |

## Compliance with security frameworks (methodology)

Every control a questionnaire question evaluates - whether from the software or the vendor
questionnaire - is tracked against a reference catalog of 77 real controls, covering 8 frameworks:
ISO/IEC 27001:2022, ISO/IEC 27002, NIST Cybersecurity Framework (CSF 2.0), CIS Controls v8, LGPD,
GDPR, OWASP ASVS, and OWASP Top 10. The "Compliance" tab in `/dashboards` cross-references that
catalog against each software's latest approved assessment and each vendor's latest completed one,
and shows, per framework, how many "meet" each control - a control only counts as met when every
questionnaire answer linked to it falls within the acceptable risk threshold.

| Dashboard - compliance against security frameworks (CIS/NIST/ISO) |
| --- |
| ![Dashboard - compliance](./docs/screenshots/dashboard-conformidade-en.png) |

## Implemented security controls

- **Granular, permission-level RBAC** (not just role-level), with dedicated decorators for AND/OR
  permission composition - `apps/api/src/common/decorators`, `common/guards`.
- **Authentication**: short-lived access JWT + refresh token via httpOnly cookie, SSO via generic/
  pluggable SAML (local login coexists with SSO, never exclusive).
- **2FA via TOTP (RFC 6238)**, full self-service (QR code, single-use backup codes, disable/regenerate
  with reauthentication) - own implementation on top of `node:crypto`, no third-party dependency.
  Platform-wide recommendation toggle, and a dedicated security review found and fixed a real bypass
  (SSO login skipped the second factor) before it shipped.
- **Admin-assisted account recovery**: when a user loses their password and their 2FA backup codes
  at the same time (a total lockout, with no self-service path left), a tenant admin can force-disable
  that user's 2FA without their password - the action is blocked against the acting admin's own
  account (so it can't be used to bypass self-service reauthentication), recorded in the audit log
  with the admin identified, and the affected user is notified by email.
- **Passwordless sign-in**: a typed 6-digit email code, not a clickable link - a deliberate choice
  so corporate email scanners can't pre-consume the token. Gated behind a formal verified-email
  prerequisite (self-service at `/profile`) and a platform-wide toggle. Deliberate design decision:
  email possession substitutes both traditional factors on this specific path, skipping 2FA even for
  accounts with TOTP enabled - that feature's dedicated security review also found and fixed a real
  issue before shipping (the platform toggle wasn't actually interrupting a login already in progress
  with a still-valid code).
- **Platform-wide, configurable password policy**: minimum length and required character classes
  (uppercase/lowercase/digit/symbol) set by a super-admin at `/admin/platform-policy` and enforced
  for every tenant - self-service password change and admin-triggered resets reuse the same
  validation.
- **Audit trail**: a dedicated interceptor logs CREATE/UPDATE/DELETE/LOGIN/... with actor, entity
  and IP, queryable at `/admin/audit-logs`.
- **CSRF via double-submit cookie**, global input sanitization, configurable rate limiting per
  endpoint (`@nestjs/throttler`, stricter limits on sensitive routes).
- **Encryption at rest (AES-256-GCM)** for sensitive fields via `CryptoService`.
- **Observability**: structured logs, correlation ID, Prometheus metrics, OpenTelemetry tracing.
- **Row-level multi-tenancy**, `tenantId` isolation on every query, single database - with
  cross-organization access restricted to super-admins (dedicated permission + its own audit
  trail), without affecting the default isolation of any other user.

**This also applies to the repository itself**, not just the product: mandatory CI, branch
protection, and an agreed weekly vulnerability-review window (Dependabot).

```mermaid
flowchart LR
    A[Dependabot\ndetects a CVE] --> B{Critical + publicly\nknown exploit?}
    B -->|Yes| C[Fixed\nimmediately]
    B -->|No| D[Weekly review\nwindow]
    D --> E[Classified by risk\nand logged]
```

Full process (risk tiers, per-window history) in [`docs/security.md`](./docs/security.md)
(Portuguese).

## Screenshots

| My view | Admin |
| --- | --- |
| ![Dashboard - my view](./docs/screenshots/dashboard-minha-visao-en.png) | ![Dashboard - admin](./docs/screenshots/dashboard-administrativo-en.png) |

| Executive | Leaderboard |
| --- | --- |
| ![Dashboard - executive](./docs/screenshots/dashboard-executivo-en.png) | ![Dashboard - leaderboard](./docs/screenshots/dashboard-placar-por-area-en.png) |

| Compliance against security frameworks (CIS/NIST/ISO) |
| --- |
| ![Dashboard - compliance](./docs/screenshots/dashboard-conformidade-en.png) |

| Risk questionnaire - tabs by category | Approval - decision dialog |
| --- | --- |
| ![Questionnaire in tabs](./docs/screenshots/questionario-abas-en.png) | ![Approval - decision dialog](./docs/screenshots/approvals-decisao-en.png) |

| Technical opinion - PDF with verification QR Code | Technical opinions - who issued it |
| --- | --- |
| ![Technical opinion - PDF](./docs/screenshots/parecer-pdf-en.png) | ![Technical opinions](./docs/screenshots/pareceres-tecnicos-en.png) |

| Inventory - full list | Manual inventory item approval |
| --- | --- |
| ![Inventory - list](./docs/screenshots/inventory-lista-en.png) | ![Manual inventory item approval](./docs/screenshots/inventory-approval-queue-en.png) |

| Rejected item - reason and resubmit | Approval - requester identified |
| --- | --- |
| ![Rejected item](./docs/screenshots/inventory-approval-rejected-en.png) | ![Approval - requester](./docs/screenshots/approvals-solicitante-en.png) |

| Vendors - list with tiering | Vendors - detail |
| --- | --- |
| ![Vendors - list](./docs/screenshots/vendors-lista-en.png) | ![Vendors - detail](./docs/screenshots/vendors-detalhe-en.png) |

| Vendor deletion - blocked by an active link |
| --- |
| ![Deletion blocked](./docs/screenshots/vendors-exclusao-bloqueada-en.png) |

| Vendor assessment - who performed it | Audit log - who did what |
| --- | --- |
| ![Assessment - performed by](./docs/screenshots/vendors-avaliacao-realizada-por-en.png) | ![Audit log](./docs/screenshots/admin-auditoria-en.png) |

| Admin - role management | Platform policies (super-admin) |
| --- | --- |
| ![Admin - roles](./docs/screenshots/admin-papeis-en.png) | ![Platform policies](./docs/screenshots/admin-platform-policy-en.png) |

| Notification center - dropdown | Notification center - history |
| --- | --- |
| ![Notifications - dropdown](./docs/screenshots/notifications-dropdown-en.png) | ![Notifications - history](./docs/screenshots/notifications-page-en.png) |

## Stack

| Layer            | Technology                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| Backend          | Node.js, TypeScript, NestJS 11                                             |
| Frontend         | Next.js 16 (App Router), React 19, TailwindCSS 4, shadcn/ui                 |
| Database         | PostgreSQL 16, Prisma ORM 7                                                 |
| Authentication   | JWT + Refresh Token, generic/pluggable SAML SSO, 2FA (TOTP)                |
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

The API is documented via Swagger/OpenAPI (`@nestjs/swagger`), available at `/docs` with the local
server running - every route, DTO and the authentication scheme (Bearer JWT) is generated
automatically from the code, not maintained separately. Meant to ease future integrations: any
team that needs to consume the API gets a browsable, always-current contract there, without
depending on this README or hand-written documentation.

## Full technical documentation

- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) - lean reference: stack, structure, how to run,
  CI/`main` branch protection.
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) - stage-by-stage/PR-by-PR decision log, deliberately
  kept as a technical logbook: trade-offs considered, real bugs found and how they were fixed.
- [`docs/architecture.md`](./docs/architecture.md) - data model and deployment topology diagrams.
- [`docs/security.md`](./docs/security.md) - SSDLC: CI, branch protection, Dependabot, and the
  weekly vulnerability-review process (Portuguese).
- [`docs/style-guide.md`](./docs/style-guide.md) - writing conventions applied to all project text
  (Portuguese).
- [`infra/terraform/README.md`](./infra/terraform/README.md) - production deployment strategy.

## Contact

[LinkedIn](https://www.linkedin.com/in/domcabral/) - domcabral@proton.me
