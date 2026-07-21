import { AdminSectionGate } from "../_components/section-gate";
import { ComingSoon } from "../_components/coming-soon";

export default function AdminAuditLogsPage() {
  return (
    <AdminSectionGate permission="audit:view">
      <ComingSoon titleKey="nav.auditLogs" />
    </AdminSectionGate>
  );
}
