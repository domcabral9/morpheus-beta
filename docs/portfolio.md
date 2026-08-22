# Portfólio: quando e como atualizar

Este documento é sobre como o Morpheus é **apresentado** para fora (a tabela de screenshots
curados do `README.md`, o texto de venda do próprio README, CV/LinkedIn) - diferente de
[`docs/DEVELOPMENT.md`](./DEVELOPMENT.md), que é sobre como o projeto funciona por dentro. A
distinção importa: uma mudança pode ser tecnicamente trivial e ainda assim justificar uma
atualização de portfólio (um badge novo visível na tela), ou o inverso (uma refatoração grande de
backend que não muda nenhuma tela).

Escrito também com um objetivo mais amplo em mente: reunir aqui os pontos principais de forma
generalizável o bastante pra, no futuro, embasar um agente dedicado a essa tarefa em qualquer
projeto - não só regras específicas do Morpheus. A seção final ("Princípios gerais") existe por
esse motivo.

## A regra de decisão: quando vale atualizar

Regra vigente (formulada em 2026-08-07, refinada em 2026-08-11 e 2026-08-21): uma atualização de
portfólio só se justifica quando **(a)** uma tela já presente na tabela curada do README muda
visivelmente, ou **(b)** uma tela nova é candidata genuína a entrar nessa tabela curada.

Isso substitui uma versão mais antiga e já abandonada da regra ("qualquer mudança de UX dispara
recaptura"), que gerava trabalho desproporcional ao valor de apresentação de cada mudança - nem
toda mudança visível merece virar screenshot novo, só as que carregam a tabela curada como um bom
resumo do projeto.

## Como capturar (a técnica já vive em código, não aqui)

`apps/web/scripts/portfolio-capture.mjs` é a fonte de verdade sobre **como** capturar - não
duplicar essas regras em prosa aqui, só apontar pra elas: tema escuro sempre forçado, nunca
`fullPage:true` numa página que rola (quebra a sidebar sticky), checar dado de teste/lixo no
tenant demo antes de capturar, e rodar `checkForDuplicateScreenshots` no fim de todo lote (pega
capturas que saíram vazias/idênticas por engano).

Divisão de responsabilidade: o código responde "como capturar sem erro"; este documento responde
"quando vale a pena capturar".

## Efeito cascata: mudança de navegação ou chrome global

Uma mudança na sidebar/navegação global (um item novo, uma permissão que muda quem vê o quê) não
afeta só a tela nova - **todo screenshot já curado que mostra essa mesma sidebar precisa ser
reavaliado**, porque a barra lateral aparece em cada um deles. Precedente real: a entrada do item
"Fornecedores" na navegação disparou a regeneração de 14 screenshots já existentes (PR #86), não só
a captura da tela nova.

## Timing: etapa de fechamento, não item adiado

"No final do milestone" significa agora, como a última etapa de um arco de trabalho recém-fechado -
não um lote maior, adiado pra uma sessão futura. Interpretação corrigida em 2026-08-21 depois de um
mal-entendido: a leitura inicial ("adiar pra um lote depois") foi corrigida pelo próprio usuário na
mensagem seguinte.

## Dado usado na captura: sempre real

Nenhuma amostra usada numa captura de portfólio é fabricada à mão (via SQL direto, por exemplo) só
pra sair uma tela mais "bonita". O sistema roda de verdade contra dado real do tenant `demo` (uma
verificação de exposição externa real, uma avaliação de fornecedor real concluída) - se o resultado
real for menos dramático que o hipotético, o resultado real é o que fica. Mesmo princípio seguido
em toda amostra de enriquecimento de inventário do projeto (frescor de versão, reputação, exposição).

## Texto que acompanha o portfólio

O texto de apresentação (README, CV, LinkedIn) usa um registro diferente da documentação técnica
interna: precisa "vender a ideia", não só descrever tecnicamente. Ver
[`docs/style-guide.md`](./style-guide.md) pras convenções de escrita que ainda assim se aplicam
(sem em-dash, sem contraste negativo redundante) mesmo nesse registro mais comercial.

## Princípios gerais (para adaptar a qualquer projeto)

Destilando o que está acima em regras portáveis, sem depender de nada específico do Morpheus:

1. **Separe a decisão do "quando" da técnica do "como"**: a lógica de gatilho vira documentação
   revisável; a técnica de captura vira código testável. Os dois merecem viver em lugares
   diferentes, cada um sendo fonte de verdade só do que lhe cabe.
2. **Defina um critério explícito de gatilho, nunca "qualquer mudança dispara"**: sem isso, todo
   commit vira candidato a recaptura, e a atenção que deveria ir pra mudanças que realmente importam
   se dilui.
3. **Mudança em elementos compartilhados (navegação, chrome, tema) é cascata**: reavaliar tudo que
   já usa aquele elemento, não só a superfície nova que motivou a mudança.
4. **Trate a atualização de portfólio como etapa de fechamento de um ciclo de trabalho**, não como
   item de backlog perpetuamente adiável - fica mais fácil de esquecer quanto mais distante fica do
   trabalho que a gerou.
5. **Dado de amostra é sempre real, nunca fabricado**: um resultado genuíno, mesmo menos
   impressionante, vale mais que um resultado fabricado pra parecer melhor - a credibilidade do
   portfólio depende disso.
6. **Texto de apresentação e documentação técnica têm registros diferentes**: o primeiro precisa
   vender a ideia pra quem nunca viu o projeto; o segundo precisa ser preciso pra quem já está
   trabalhando nele. Confundir os dois registros enfraquece os dois.
