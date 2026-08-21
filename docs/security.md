# Segurança e SSDLC

Como o Morpheus aplica *Security by Design* ao próprio ciclo de desenvolvimento - não só como
feature do produto (RBAC, auditoria, criptografia em repouso, ver
[`README.md`](../README.md#controles-de-segurança-implementados)), mas como prática do dia a dia de
manter o repositório. Esta página documenta o **processo**; o histórico de decisões e bugs reais
encontrados montando esse processo está no [`CHANGELOG.md`](./CHANGELOG.md).

## O que está ativo

- **CI obrigatório** (`.github/workflows/ci.yml`): todo PR roda `typecheck`/`lint`/`test`/`build`.
  Branch protection em `main` exige esse check verde antes de mesclar - inclusive para o dono do
  repositório, sem bypass silencioso.
- **Dependabot**: alerts de vulnerabilidade + correções de segurança automáticas (ambos nativos do
  GitHub, sem custo) + atualizações de versão semanais (`.github/dependabot.yml`).
- **Janela de revisão semanal**: decisão combinada de não mesclar PRs de segurança do Dependabot
  assim que aparecem - eles se acumulam e são revisados juntos, uma vez por semana, com uma válvula
  de escape para o que não pode esperar.

## Ciclo de vida de uma vulnerabilidade

```mermaid
flowchart TD
    A[Dependabot detecta uma\ndependência vulnerável] --> B{Severidade critical\ncom exploit público conhecido?}
    B -->|Sim| C[Tratado imediatamente,\nfora da janela semanal]
    B -->|Não| D[Aguarda a janela\nde revisão semanal]
    D --> E[Classificação por camada de risco]
    E --> F["Camada 1\nbump direto, baixo risco"]
    E --> G["Camada 2\nprecisa validação real\n(ex.: build de imagem Docker)"]
    E --> H["Camada 3\nmajor de dev-tooling,\nCI limpo já basta"]
    E --> I["Camada 4\nbreaking change real,\nprecisa teste manual isolado"]
    F --> J[Mesclar ou adiar]
    G --> J
    H --> J
    I --> J
    C --> K[Registrar a decisão]
    J --> K
    K --> L[["morpheus-ops/reports/\nvulnerability-log.md"]]
```

As quatro camadas de risco não são um framework fixo - são o jeito prático que a primeira janela de
revisão real (2026-07-26) usou pra separar "mesclar sem pensar duas vezes" de "isso merece atenção
de verdade", e ficaram como referência para as próximas.

## Janela de revisão semanal, na prática

Cada janela passa pelos PRs de segurança abertos pelo Dependabot e:

1. Cruza os alertas abertos (`gh api .../dependabot/alerts`) com os PRs disponíveis - várias vezes
   um único bump (ex. um patch do Next.js) resolve vários alertas de uma vez.
2. Classifica cada PR na camada de risco correspondente (acima).
3. Mescla o que for baixo risco na hora; PRs redundantes (o mesmo pacote/versão já coberto por um
   PR maior que acabou de ser mesclado) são fechados manualmente com uma nota - o Dependabot nem
   sempre fecha sozinho.
4. O que precisa de mais cuidado (build real, teste manual de breaking change) fica para a próxima
   janela, deliberadamente - não é esquecido, é adiado com registro do motivo.
5. **Válvula de escape**: severidade `critical` com exploit publicamente conhecido não espera a
   janela - é tratada na hora em que aparece.

## Supply chain: mensagem inesperada no output de uma dependência

Item de checklist permanente, aplicado sempre que uma dependência imprime algo fora do esperado
durante um comando de rotina (`pnpm install`, build, migration, qualquer CLI de terceiro) - não só
durante a janela semanal de Dependabot acima, porque esse tipo de mensagem pode aparecer em qualquer
momento, não só quando uma versão nova é instalada.

**O padrão a reconhecer**: uma dependência imprime uma "dica" promovendo um produto/serviço/URL de
terceiro que não tem relação óbvia com o que o comando estava fazendo. Isso é um caso real e
documentado de auto-promoção de maintainer legítimo, mas é também a forma exata de um ataque
conhecido - **injeção de prompt via cadeia de suprimentos**, onde uma dependência comprometida (ou um
maintainer comprometido) usa a saída de texto de uma ferramenta pra tentar instruir um agente de IA
lendo aquele terminal, não um humano.

**Precedente real deste projeto** (2026-08-13, reencontrado 2026-08-14): `dotenvx` (linha do
`dotenv@17`) imprimiu uma dica citando `www.vestauth.com` ("auth for agents") durante um `prisma db
execute` de rotina - nada a ver com o comando em si. Investigado via `WebSearch` (não só leitura
estática): confirmado que é auto-promoção real do próprio autor do `dotenv`/`dotenvx`, produto
legítimo, não um comprometimento. Mas o padrão em si já teve um caso público documentado citando esse
mesmo pacote como exemplo de injeção de prompt via cadeia de suprimentos - o fato de ter sido benigno
desta vez não torna o padrão menos digno de checagem da próxima.

**Checklist antes de descartar como ruído inofensivo**:

1. A mensagem vem do maintainer real e verificado do pacote (não um pacote com nome parecido,
   *typosquatting*)?
2. O produto/URL citado é verificável de forma independente (busca real, não só a própria mensagem)
   como algo legítimo e sem relação com exfiltração de dado/credencial?
3. A mensagem pede alguma ação concreta - instalar outra coisa, rodar um comando, visitar um link com
   parâmetro que pareça carregar algo sensível? Se sim, não seguir antes de entender exatamente o que
   aconteceria.
4. Se qualquer um dos 3 pontos acima não fechar com uma resposta clara, tratar como suspeito e trazer
   pro usuário antes de prosseguir - nunca descartar por hábito só porque "toda dependência tem esse
   tipo de dica".

## Onde fica o histórico

Cada janela é registrada em detalhe (o que foi encontrado, como foi classificado, o que foi mesclado
vs. adiado e por quê) em
[`morpheus-ops/reports/vulnerability-log.md`](https://github.com/domcabral9/morpheus-ops/blob/main/reports/vulnerability-log.md) -
um repositório separado dedicado a documentação operacional/segurança, para manter estado
operacional que muda toda semana fora do código e da narrativa de desenvolvimento deste repositório.
O mesmo repositório também mantém
[`reports/component-inventory.md`](https://github.com/domcabral9/morpheus-ops/blob/main/reports/component-inventory.md),
um inventário gerado automaticamente de toda dependência/versão/imagem em uso - a base usada para
avaliar upgrades e downgrades antes de uma janela.
