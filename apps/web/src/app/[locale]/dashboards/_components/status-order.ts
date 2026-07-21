/** Ordem de workflow (não alfabética) - rascunho até decisão final, sempre nesta sequência. */
export const STATUS_ORDER = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "PENDING_ADJUSTMENT",
  "REOPENED",
  "APPROVED",
  "REJECTED",
] as const;
