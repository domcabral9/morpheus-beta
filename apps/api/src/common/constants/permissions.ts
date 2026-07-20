/**
 * Espelha as `key` de Permission seedadas em packages/database/prisma/seed.ts
 * — mantidas como constantes tipadas para não espalhar strings mágicas pelos
 * controllers. Se adicionar uma permissão nova, adicione nos dois lugares.
 */
export const PERMISSIONS = {
  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",
  QUESTIONS_MANAGE: "questions:manage",
  RISK_MATRIX_MANAGE: "risk-matrix:manage",
  WORKFLOWS_MANAGE: "workflows:manage",
  SYSTEM_CONFIGURE: "system:configure",
  ASSESSMENTS_CREATE: "assessments:create",
  ASSESSMENTS_EDIT_OWN: "assessments:edit-own",
  ASSESSMENTS_VIEW_OWN: "assessments:view-own",
  ASSESSMENTS_VIEW_ALL: "assessments:view-all",
  ASSESSMENTS_SUBMIT: "assessments:submit",
  ASSESSMENTS_APPROVE: "assessments:approve",
  ASSESSMENTS_REOPEN: "assessments:reopen",
  ASSESSMENTS_EXPORT_ANY: "assessments:export-any",
  REPORTS_EXPORT_OWN: "reports:export-own",
  INVENTORY_VIEW: "inventory:view",
  INVENTORY_MANAGE: "inventory:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
