import type { LucideIcon } from "lucide-react";
import { Boxes, CheckCircle2, ClipboardList, LayoutDashboard } from "lucide-react";

export interface PrimaryNavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Ausente = visível para qualquer usuário autenticado. */
  permission?: string;
}

/** Itens de topo da sidebar — visíveis a todo usuário autenticado, exceto onde `permission` filtra. */
export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { href: "/dashboard", labelKey: "assessments", icon: ClipboardList },
  { href: "/dashboards", labelKey: "dashboards", icon: LayoutDashboard },
  { href: "/inventory", labelKey: "inventory", icon: Boxes, permission: "inventory:view" },
  { href: "/approvals", labelKey: "approvals", icon: CheckCircle2, permission: "assessments:approve" },
];

export interface AdminNavItem {
  href: string;
  labelKey: string;
  permission: string;
}

/** Fonte única do grupo "Administração" da sidebar — usada pelo shell e pela página inicial
 * de /admin (cards). Cada seção nova (Etapas C a I do plano) entra aqui. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/questionnaire", labelKey: "nav.questionnaire", permission: "questions:manage" },
  { href: "/admin/risk-matrix", labelKey: "nav.riskMatrix", permission: "risk-matrix:manage" },
  { href: "/admin/workflow", labelKey: "nav.workflow", permission: "workflows:manage" },
  { href: "/admin/audit-logs", labelKey: "nav.auditLogs", permission: "audit:view" },
  { href: "/admin/users", labelKey: "nav.users", permission: "users:manage" },
  { href: "/admin/settings", labelKey: "nav.settings", permission: "system:configure" },
];

/** Rota ativa: match exato, ou prefixo quando `exact` é false (usado por seções com sub-rotas). */
export function isNavItemActive(pathname: string, href: string, exact = false): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
