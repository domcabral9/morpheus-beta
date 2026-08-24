# Guia de estilo de escrita

Convenções de texto para qualquer conteúdo do Morpheus (comentário de código, mensagem de commit,
corpo de PR, texto de frontend visível ao usuário, README, este próprio conjunto de docs, e texto de
CV/LinkedIn sobre o projeto). O objetivo comum às regras abaixo: texto que soa como foi escrito por
uma pessoa pensando no leitor, não texto que carrega os tiques de padding característicos de saída de
LLM sem revisão - e artefatos do projeto que não carregam a marca de nenhuma ferramenta específica.

## Nunca usar travessão ("—")

Nenhum texto do Morpheus usa o caractere "—" (em-dash), em nenhuma língua. Usar ponto, vírgula,
dois-pontos ou parênteses no lugar.

**Por quê**: em-dash deixa o texto "muito na cara que foi gerado por LLM" - é um dos tiques de
pontuação mais característicos de saída de IA sem revisão humana, e qualquer texto deste projeto lido
por um avaliador externo (recrutador, colaborador, revisor de portfólio) deveria parecer escrito por
alguém pensando no leitor, não colado direto de um modelo.

**Escopo**: tudo que entra no histórico do repositório ou fica visível a um usuário/avaliador externo
- comentário de código, mensagem de commit, corpo de PR, texto de frontend (labels, toasts, estados
vazios, qualquer string visível), README, esta própria documentação, texto de CV/LinkedIn.

**Única exceção**: arquivos de memória do assistente e `docs/changelog/*.md` (notas internas de
engenharia, nunca lidas por um avaliador externo).

**Como aplicar**: antes de finalizar qualquer texto, escanear por "—" e reescrever usando um dos
sinais de pontuação acima.

**Auditoria retroativa**: histórico já escrito (commits antigos, comentários já existentes) não é
reescrito retroativamente - é um item de backlog separado, avaliado depois, não uma instrução pra
reescrever o passado agora.

## Evitar contrastes negativos redundantes

Um padrão comum em texto gerado por LLM: afirmar algo e logo em seguida negar uma alternativa óbvia
que ninguém cogitaria de qualquer forma, só pelo efeito de ênfase - "X (não só Y)", "X, e não apenas
Y", "X, não Y". Isso deixa a escrita técnica repetitiva e cansativa quando usado sem necessidade.

**Não é uma regra contra contraste em si.** Contrastar uma alternativa real e plausível que o leitor
poderia genuinamente supor é informação útil, não padding:

> O acesso deve ser concedido com base na necessidade de negócio, e não apenas na senioridade.

Aqui a parte negada (senioridade como critério) é uma alternativa real que alguém poderia assumir sem
essa frase - a negação corrige uma suposição plausível, então carrega informação de verdade.

**O problema é quando a parte negada não acrescenta nada que o leitor não já soubesse.** Exemplo real
encontrado no `README.md` (corrigido - achado durante a revisão de regras core, 2026-08-21):

> mantido de propósito como um diário de bordo técnico (não só uma lista de features prontas)

Ninguém leria "diário de bordo técnico" e presumiria "lista de features prontas" por padrão - a parte
entre parênteses não corrige suposição nenhuma, só preenche espaço. A frase fica mais forte sem ela:
"mantido de propósito como um diário de bordo técnico: trade-offs considerados, bugs reais
encontrados e como foram corrigidos."

**Teste prático antes de manter um contraste negativo**: remover a parte negada mentalmente e
perguntar - o leitor perde alguma informação real que ele não teria adivinhado sozinho? Se a resposta
for não, cortar. Se for sim (como no exemplo de acesso por senioridade acima), manter - o contraste
está fazendo trabalho de verdade.

**Escopo e exceções**: mesmo escopo da regra de em-dash acima. Sem auditoria retroativa automática -
corrigir quando encontrado durante trabalho normal (como o exemplo do `README.md` acima), não é uma
varredura obrigatória do histórico existente.

## Nenhuma assinatura de ferramenta de IA nos artefatos do projeto

O Morpheus é construído com apoio de ferramentas de IA, mas os artefatos que o projeto produz -
commits, corpo de Pull Request, comentários (em PRs, issues, ou onde quer que vivam), e qualquer
outro conteúdo gerado - nunca carregam assinatura, rodapé, trailer de co-autoria ou qualquer outra
marca vinculando esse artefato a uma ferramenta/fornecedor de IA específico. Isso vale de forma
agnóstica a qual ferramenta foi usada em cada momento - não é uma regra sobre uma ferramenta em
particular, é uma postura permanente do projeto.

**Por quê**: o uso de IA no desenvolvimento já é declarado de forma explícita e visível em outros
lugares (perfis profissionais do autor, por exemplo) - não precisa, e não deve, ser repetido dentro
do próprio repositório. Um commit, uma PR ou um comentário devem ser lidos como o trabalho do autor
do projeto, ponto final; a ferramenta usada para chegar lá é um detalhe de processo, não uma
informação que pertence ao artefato em si.

**Escopo**: mensagem de commit (nenhum trailer `Co-authored-by`/similar apontando pra uma ferramenta
de IA), corpo de Pull Request (nenhum rodapé tipo "Gerado com..."), comentários em qualquer sistema
onde o projeto vive (GitHub, Trello, etc.), e qualquer outro artefato que o projeto produza e que
fique visível a terceiros.

**Como aplicar**: antes de criar qualquer commit ou PR, confirmar que nenhuma linha do tipo acima foi
incluída - independente de qual seja o modelo/ferramenta usado na sessão de trabalho.

**Auditoria retroativa**: mesmo tratamento das regras acima - corrigir quando prático (uma limpeza
retroativa de histórico/PRs já foi feita uma vez, 2026-08-24, mas não é um compromisso de reescrever
histórico automaticamente toda vez que a regra for adicionada a um novo lugar).
