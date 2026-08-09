# Checklist de dados de demonstração (tenant `demo`)

Padrão de trabalho para qualquer sessão que crie, edite ou enriqueça dados no tenant `demo` -
amostras usadas tanto para navegação manual quanto para os screenshots do portfólio
(`README.md`). Combinado em 2026-08-09, a ser seguido até o fim do projeto. Não é sobre código -
é sobre como popular/curar dados de exemplo de forma consistente.

## O checklist

1. **Levantar o estado real antes de propor qualquer mudança.** Nunca assumir o que já existe -
   puxar via API (`GET /inventory`, `GET /assessments`, `GET /vendors`, etc.) o inventário atual de
   cada entidade afetada antes de decidir o que falta.
2. **Cobertura de status, não só "caminho feliz".** Toda entidade com uma máquina de estados
   (`AssessmentStatus`, `InventoryStatus`, `InventoryApprovalStatus`, `VendorAssessmentStatus`, ...)
   deve ter pelo menos um exemplo vivo de cada status relevante para demonstração - aprovado, em
   andamento, reprovado, etc. Um tenant onde tudo está `ACTIVE`/`APPROVED` não mostra o sistema de
   verdade.
3. **Coerência de narrativa entre entidades.** Os dados precisam contar uma história plausível
   através de `Inventory` ↔ `Vendor` ↔ `Assessment` - um item vinculado a um fornecedor deve ter um
   tier condizente, uma avaliação aprovada deve corresponder a um item ativo no inventário, etc. Não
   forçar um sinal (ex. frescor de versão) num item onde isso não faz sentido de verdade (ex.
   software SaaS sem versão pública) - "sem sinal"/"desconhecido" também é um estado real e vale a
   pena representar.
4. **Confirmar impacto nos dashboards, não só na tela de detalhe do item alterado.** Depois de
   criar/editar uma amostra, verificar que os agregados relevantes mudaram de verdade -
   `/dashboards` (Conformidade, visão executiva, placar por área), `/dashboard` (Home - listagem +
   atalhos), e qualquer stat tile que conte por status/critério tocado. Um dado que só aparece na
   tela de detalhe do item, mas nunca nos números agregados, não termina de "parecer real".
5. **Sempre via API real, nunca `seed.ts` nem SQL direto (exceto quando não existe outro caminho).**
   Mesma convenção já estabelecida - popular dados chamando os endpoints reais exercita a mesma
   validação/regra de negócio que um usuário real acionaria. SQL direto só como último recurso
   (ex. backdatar um campo de agendamento pra simular urgência), e documentado quando usado.
6. **Nunca revelar segredos reais em screenshot.** Chaves de API, tokens, segredos TOTP, etc. -
   usar valores de captura descartáveis, nunca o dado real de uma conta viva.
7. **Orçamento de chamadas a terceiros é finito - gastar com intenção.** Antes de rodar uma
   checagem real contra uma integração com cota diária (ex. VirusTotal), confirmar quanto já foi
   usado hoje e decidir explicitamente quantas chamadas a mais valem a pena para a variedade que
   está sendo buscada.
8. **Propor antes de executar quando a mudança for grande ou tocar múltiplas entidades.** Uma
   tabela/lista concreta do que vai mudar (o quê, por quê) antes de rodar os `curl`/scripts -
   mesma prática já usada para features de código, aplicada aqui a dados.
9. **Regenerar screenshot de qualquer tela cujo dado mudou visivelmente**, mesmo que a mudança seja
   só de dado (não de UX/código) - extensão do gatilho já existente de "mudança de UX sempre
   regenera screenshot" para "mudança de dado visível também regenera".
10. **Registrar o que foi feito e por quê** (changelog e/ou memória do projeto) - amostras de
    demonstração são estado intencional e persistente do tenant `demo`, não descartável; uma futura
    sessão precisa saber que não é lixo de teste antes de considerar limpar algo.

## Não é sobre

Este checklist não substitui a revisão de segurança dedicada nem a validação funcional
(lint/typecheck/test/build) de qualquer código novo - é especificamente sobre a qualidade e a
consistência dos *dados* usados para demonstrar o sistema.
