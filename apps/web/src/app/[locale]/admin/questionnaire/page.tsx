import { AdminSectionGate } from "../_components/section-gate";
import { ComingSoon } from "../_components/coming-soon";

export default function AdminQuestionnairePage() {
  return (
    <AdminSectionGate permission="questions:manage">
      <ComingSoon titleKey="nav.questionnaire" />
    </AdminSectionGate>
  );
}
