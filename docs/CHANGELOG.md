# Changelog — Morpheus

Log narrativo, cronológico, etapa por etapa/PR por PR, de decisões e implementação. Para
setup, stack e como rodar o projeto, ver [`docs/DEVELOPMENT.md`](./DEVELOPMENT.md) — este
arquivo existe pra tirar o histórico de lá e manter a referência enxuta.

Dividido por mês em [`docs/changelog/`](./changelog/) desde 2026-08-01 (o arquivo único tinha passado
de 2500 linhas, difícil de consultar até por sessões de LLM revisitando o projeto). Arquivos de meses
fechados ficam congelados — não são reescritos retroativamente, mesma convenção já usada para planos
históricos. Este índice lista os meses do mais recente para o mais antigo, cada um com um resumo de
uma linha do que aconteceu.

## 2026

- [**Agosto**](./changelog/2026-08.md) — "Perfumaria" de PR, tela de perfil de autoatendimento, 2FA
  via TOTP (RFC 6238, com um bypass de SSO real encontrado e corrigido na revisão de segurança), fluxo
  de aprovação para itens de inventário manuais (Fases 1-5, item mais antigo do backlog), login
  passwordless completo (código por e-mail, pulando 2FA por decisão deliberada, com um achado real de
  kill-switch corrigido na revisão de segurança — Fases 1-7, fecha o backlog de Autenticação),
  reestruturação em grade de `/profile`/`/admin/platform-policy`/matriz de risco/questionários
  (com 2 bugs reais de screenshot corrigidos — regeneração esquecida e um gotcha de captura
  `fullPage`+sticky), auditoria de conteúdo do FAQ (9 perguntas novas, incluindo uma seção própria
  "Fornecedores"), recuperação de conta assistida por administrador (forçar desativação de 2FA de
  terceiro travado fora, sem achado na revisão de segurança), gráficos de conformidade CIS/NIST/ISO em
  `/dashboards` (capacidade de mapeamento de controles já existente no schema, nunca antes exposta),
  curadoria de portfólio focada em conformidade/GRC, revisão conjunta do inventário (painel de anexos,
  busca por nome, seletor de usuário pesquisável), e o arco completo de enriquecimento de itens de
  inventário (frescor de versão via endoflife.date + reputação de ameaça via VirusTotal, Fases 1-8,
  fecha o backlog — inclui um novo checklist padrão de dados de demonstração adotado até o fim do
  projeto).
- [**Julho**](./changelog/2026-07.md) — Construção inicial do produto (roteiro técnico Etapas 1-16 +
  plano pós-roteiro Etapas A-I), multi-tenancy e administração avançada, backlog pós-uso, renovação
  anual de homologação, avaliação de risco de fornecedores, vínculo Inventory↔Vendor, SSDLC/CI, e
  política de senha de plataforma (Fases 1-5).
