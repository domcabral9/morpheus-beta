import { AdminSectionGate } from "../_components/section-gate";
import { ComingSoon } from "../_components/coming-soon";

export default function AdminWorkflowPage() {
  return (
    <AdminSectionGate permission="workflows:manage">
      <ComingSoon titleKey="nav.workflow" />
    </AdminSectionGate>
  );
}
