/**
 * Formato de `data` por `NotificationType` - único lugar do backend que
 * conhece a forma exata de cada tipo (o frontend duplica isto em
 * `notification-types.ts`, mesmo padrão de `AssessmentStatus`, sem importar
 * tipos do Prisma). Datas trafegam cruas (ISO), nunca pré-formatadas, para
 * que a formatação respeite o locale de quem está lendo.
 */
export interface NotificationDataByType {
  NEW_REQUEST: { softwareName: string; stepName: string };
  APPROVAL: { softwareName: string };
  REJECTION: { softwareName: string; stepName: string };
  ADJUSTMENT_REQUEST: { softwareName: string; stepName: string };
  HOMOLOGATION_EXPIRING: { itemName: string; vendor: string; nextReviewDate: string };
  NEW_COMMENT: Record<string, never>;
  OPINION_ISSUED: { softwareName: string; number: string; classificationLabel: string };
  RENEWAL_PENDING: { itemName: string; vendor: string; deadline: string };
  RENEWAL_PENDING_REQUESTER_INACTIVE: { itemName: string; vendor: string; deadline: string };
  RENEWAL_REQUESTER_REASSIGNED: { softwareName: string; vendor: string };
  RENEWAL_OVERDUE: { itemName: string; vendor: string };
  VENDOR_REASSESSMENT_DUE: { vendorName: string; tier: number; tierLabel: string };
  VENDOR_REASSESSMENT_DUE_PERFORMER_INACTIVE: {
    vendorName: string;
    tier: number;
    tierLabel: string;
  };
  INVENTORY_APPROVAL_REQUESTED: { itemName: string };
  INVENTORY_ITEM_APPROVED: { itemName: string };
  INVENTORY_ITEM_REJECTED: { itemName: string; reason: string };
  VENDOR_DATA_INCOMPLETE: { softwareName: string; vendorName: string };
  VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL: { softwareName: string; vendorName: string };
}

/**
 * Renderiza o e-mail (assunto/corpo) a partir de `type`+`data` - único
 * consumidor é `NotificationsService.notify()`. E-mail continua só em
 * português (decisão de escopo: `User` não tem campo de idioma persistido,
 * então não há sinal de qual idioma usar) - o conteúdo em tela (bilíngue)
 * vive em `apps/web/src/messages/{en,pt-BR}.json`, não aqui. Centraliza o
 * que antes eram 17 strings inline espalhadas pelos pontos de chamada.
 */
export function renderNotificationEmailContent<T extends keyof NotificationDataByType>(
  type: T,
  data: NotificationDataByType[T],
): { subject: string; body: string } {
  const d = data as Record<string, unknown>;
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

  switch (type) {
    case "NEW_REQUEST":
      return {
        subject: `Nova avaliação para análise: ${d.softwareName}`,
        body: `A avaliação "${d.softwareName}" está aguardando sua análise na etapa "${d.stepName}".`,
      };
    case "APPROVAL":
      return {
        subject: `Avaliação homologada: ${d.softwareName}`,
        body: `Sua avaliação "${d.softwareName}" foi homologada. O parecer técnico já está disponível.`,
      };
    case "REJECTION":
      return {
        subject: `Avaliação reprovada: ${d.softwareName}`,
        body: `Sua avaliação "${d.softwareName}" foi reprovada na etapa "${d.stepName}".`,
      };
    case "ADJUSTMENT_REQUEST":
      return {
        subject: `Ajuste solicitado: ${d.softwareName}`,
        body: `A etapa "${d.stepName}" pediu ajustes na avaliação "${d.softwareName}". Revise e reenvie.`,
      };
    case "HOMOLOGATION_EXPIRING":
      return {
        subject: `Revisão pendente: ${d.itemName}`,
        body: `O item "${d.itemName}" (${d.vendor}) está com a revisão periódica vencendo em ${dateLabel(d.nextReviewDate as string)}. Revise a homologação.`,
      };
    case "OPINION_ISSUED":
      return {
        subject: `Parecer técnico emitido: ${d.softwareName}`,
        body: `O parecer técnico nº ${d.number} da avaliação "${d.softwareName}" (${d.classificationLabel}) já está disponível para download.`,
      };
    case "RENEWAL_PENDING":
      return {
        subject: `Renovação pendente: ${d.itemName}`,
        body: `A homologação de "${d.itemName}" (${d.vendor}) venceu e entrou em ciclo de renovação. Prazo para revisar e reenviar: ${dateLabel(d.deadline as string)}.`,
      };
    case "RENEWAL_PENDING_REQUESTER_INACTIVE":
      return {
        subject: `Renovação pendente (solicitante inativo): ${d.itemName}`,
        body: `A homologação de "${d.itemName}" (${d.vendor}) entrou em ciclo de renovação, mas o solicitante original está inativo. Reatribua um novo solicitante. Prazo: ${dateLabel(d.deadline as string)}.`,
      };
    case "RENEWAL_REQUESTER_REASSIGNED":
      return {
        subject: `Você foi designado solicitante da renovação: ${d.softwareName}`,
        body: `Um Administrador te atribuiu como solicitante do ciclo de renovação de "${d.softwareName}" (${d.vendor}). Revise e reenvie a avaliação.`,
      };
    case "RENEWAL_OVERDUE":
      return {
        subject: `Renovação vencida: ${d.itemName}`,
        body: `O prazo de renovação de "${d.itemName}" (${d.vendor}) venceu sem resolução. A área está bloqueada para novas avaliações até que a renovação seja concluída.`,
      };
    case "VENDOR_REASSESSMENT_DUE":
      return {
        subject: `Reavaliação pendente: ${d.vendorName}`,
        body: `A reavaliação de risco do fornecedor "${d.vendorName}" (Tier ${d.tier} · ${d.tierLabel}) venceu. Inicie uma nova avaliação.`,
      };
    case "VENDOR_REASSESSMENT_DUE_PERFORMER_INACTIVE":
      return {
        subject: `Reavaliação pendente: ${d.vendorName}`,
        body: `A reavaliação de risco do fornecedor "${d.vendorName}" (Tier ${d.tier} · ${d.tierLabel}) venceu. O responsável pela última avaliação está inativo - inicie uma nova avaliação ou reatribua.`,
      };
    case "INVENTORY_APPROVAL_REQUESTED":
      return {
        subject: `Novo item de inventário aguardando aprovação: ${d.itemName}`,
        body: `"${d.itemName}" foi enviado para aprovação de cadastro manual no inventário.`,
      };
    case "INVENTORY_ITEM_APPROVED":
      return {
        subject: `Item de inventário aprovado: ${d.itemName}`,
        body: `Seu cadastro manual de "${d.itemName}" foi aprovado e já está ativo no inventário.`,
      };
    case "INVENTORY_ITEM_REJECTED":
      return {
        subject: `Item de inventário reprovado: ${d.itemName}`,
        body: `Seu cadastro manual de "${d.itemName}" foi reprovado. Motivo: ${d.reason}`,
      };
    case "VENDOR_DATA_INCOMPLETE":
      return {
        subject: `Avaliação pendente - atualize dados do fornecedor: ${d.softwareName}`,
        body: `A avaliação "${d.softwareName}" está aguardando aprovação, mas o cadastro do fornecedor "${d.vendorName}" está incompleto (falta Razão Social, CNPJ ou Criticidade). Complete o cadastro em /vendors para desbloquear a aprovação.`,
      };
    case "VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL":
      return {
        subject: `Avaliação aguardando dados do fornecedor: ${d.softwareName}`,
        body: `A avaliação "${d.softwareName}" não pode ser aprovada porque o cadastro do fornecedor "${d.vendorName}" está incompleto. A aprovação fica bloqueada até que o solicitante ou um administrador complete o cadastro.`,
      };
    case "NEW_COMMENT":
    default:
      return { subject: "Notificação", body: "Você tem uma nova notificação." };
  }
}
