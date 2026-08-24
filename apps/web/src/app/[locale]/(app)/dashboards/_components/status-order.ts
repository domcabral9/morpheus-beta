/** Ordem de workflow (não alfabética) - rascunho até decisão final, sempre nesta sequência. */
export const STATUS_ORDER = [
  "DRAFT",
  "IN_REVIEW",
  "PENDING_ADJUSTMENT",
  "APPROVED",
  "PENDING_RENEWAL",
  "REJECTED",
] as const;
