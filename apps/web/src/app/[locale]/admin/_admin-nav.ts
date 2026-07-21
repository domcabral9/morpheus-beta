export interface AdminNavItem {
  href: string;
  labelKey: string;
  permission: string;
}

/** Fonte única da sub-navegação de /admin — usada pelo shell (layout) e pela
 * página inicial (cards). Cada seção nova (Etapas C a I do plano) entra aqui. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/questionnaire", labelKey: "nav.questionnaire", permission: "questions:manage" },
  { href: "/admin/risk-matrix", labelKey: "nav.riskMatrix", permission: "risk-matrix:manage" },
  { href: "/admin/workflow", labelKey: "nav.workflow", permission: "workflows:manage" },
  { href: "/admin/audit-logs", labelKey: "nav.auditLogs", permission: "audit:view" },
];
