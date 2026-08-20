/**
 * Duplicado como union TS plano em vez de importar o enum do Prisma - mesmo
 * padrão já usado por `AssessmentStatus` (`assessment-types.ts`), o frontend
 * nunca importa `@morpheus/database`. Espelha
 * `NotificationDataByType` do backend (`notification-email-content.util.ts`).
 * Inclui `NEW_COMMENT` (nunca produzido, achado da auditoria de capacidade
 * órfã) só para não quebrar a tipagem de uma linha antiga que porventura o
 * use - não tem chave de mensagem própria, cai no fallback title/body.
 */
export const NOTIFICATION_TYPES = [
  "NEW_REQUEST",
  "APPROVAL",
  "REJECTION",
  "ADJUSTMENT_REQUEST",
  "HOMOLOGATION_EXPIRING",
  "NEW_COMMENT",
  "OPINION_ISSUED",
  "RENEWAL_PENDING",
  "RENEWAL_PENDING_REQUESTER_INACTIVE",
  "RENEWAL_REQUESTER_REASSIGNED",
  "RENEWAL_OVERDUE",
  "VENDOR_REASSESSMENT_DUE",
  "VENDOR_REASSESSMENT_DUE_PERFORMER_INACTIVE",
  "INVENTORY_APPROVAL_REQUESTED",
  "INVENTORY_ITEM_APPROVED",
  "INVENTORY_ITEM_REJECTED",
  "VENDOR_DATA_INCOMPLETE",
  "VENDOR_DATA_INCOMPLETE_BLOCKS_APPROVAL",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  type: NotificationType;
  /** Nulo só em linhas legadas pré-migração para o modelo type+data - cai no fallback title/body. */
  data: Record<string, unknown> | null;
  title: string | null;
  body: string | null;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UnreadCountResponse {
  count: number;
}

/**
 * Campos de `data` que chegam como ISO cru e precisam de formatação de data
 * respeitando o locale de quem está lendo - mesma lista de tipos que o
 * backend formata (sempre em pt-BR) em `dateLabel()` dentro de
 * `notification-email-content.util.ts`, mas aqui a formatação é feita no
 * client, no locale ativo.
 */
const DATE_FIELDS_BY_TYPE: Partial<Record<NotificationType, string[]>> = {
  HOMOLOGATION_EXPIRING: ["nextReviewDate"],
  RENEWAL_PENDING: ["deadline"],
  RENEWAL_PENDING_REQUESTER_INACTIVE: ["deadline"],
};

/**
 * Formata os campos de data conhecidos de `data` no locale do leitor,
 * repassando os demais campos (string/number) como estão - usado antes de
 * interpolar em `Notifications.messages.<type>.title`/`.body`.
 */
export function formatNotificationData(
  type: NotificationType,
  data: Record<string, unknown>,
  locale: string,
): Record<string, string | number> {
  const dateFields = DATE_FIELDS_BY_TYPE[type] ?? [];
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (dateFields.includes(key) && typeof value === "string") {
      result[key] = new Date(value).toLocaleDateString(locale);
    } else if (typeof value === "string" || typeof value === "number") {
      result[key] = value;
    }
  }
  return result;
}

const ENTITY_HREF_BUILDERS: Record<string, (id: string) => string> = {
  Assessment: (id) => `/assessments/${id}`,
  SoftwareInventoryItem: (id) => `/inventory/${id}`,
  Vendor: (id) => `/vendors/${id}`,
  // TechnicalOpinion não tem rota de detalhe própria hoje (achado tangente
  // da auditoria de capacidade órfã, item 3, não corrigido aqui) - cai na listagem.
  TechnicalOpinion: () => `/technical-opinions`,
};

/**
 * Rota de destino ao clicar numa notificação, resolvida por
 * `relatedEntityType` (não por `type`) - decisão de design: o mesmo
 * `relatedEntityType` já é gravado em toda chamada de `notify()` no backend.
 */
export function resolveNotificationHref(notification: Notification): string | null {
  if (!notification.relatedEntityType || !notification.relatedEntityId) return null;
  const builder = ENTITY_HREF_BUILDERS[notification.relatedEntityType];
  return builder ? builder(notification.relatedEntityId) : null;
}
