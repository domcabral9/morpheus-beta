import { AdminSectionGate } from "../_components/section-gate";
import { ComingSoon } from "../_components/coming-soon";

export default function AdminRiskMatrixPage() {
  return (
    <AdminSectionGate permission="risk-matrix:manage">
      <ComingSoon titleKey="nav.riskMatrix" />
    </AdminSectionGate>
  );
}
