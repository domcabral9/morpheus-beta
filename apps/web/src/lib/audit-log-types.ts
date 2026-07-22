export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "DOWNLOAD"
  | "APPROVE"
  | "REJECT"
  | "REOPEN"
  | "SUBMIT"
  | "SWITCH_TENANT";

export const AUDIT_ACTIONS: AuditAction[] = [
  "LOGIN",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "DOWNLOAD",
  "APPROVE",
  "REJECT",
  "REOPEN",
  "SUBMIT",
  "SWITCH_TENANT",
];

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogFilters {
  entityType?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
}
