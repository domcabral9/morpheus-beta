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
  via TOTP (RFC 6238, com um bypass de SSO real encontrado e corrigido na revisão de segurança), e
  início do fluxo de aprovação para itens de inventário manuais (item mais antigo do backlog).
- [**Julho**](./changelog/2026-07.md) — Construção inicial do produto (roteiro técnico Etapas 1-16 +
  plano pós-roteiro Etapas A-I), multi-tenancy e administração avançada, backlog pós-uso, renovação
  anual de homologação, avaliação de risco de fornecedores, vínculo Inventory↔Vendor, SSDLC/CI, e
  política de senha de plataforma (Fases 1-5).
