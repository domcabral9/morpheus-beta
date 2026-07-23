import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AssessmentStatus } from "@/lib/assessment-types";

const VARIANT_BY_STATUS: Record<
  AssessmentStatus,
  "secondary" | "outline" | "success" | "destructive" | "warning"
> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  IN_REVIEW: "secondary",
  PENDING_ADJUSTMENT: "destructive",
  APPROVED: "success",
  REJECTED: "destructive",
  REOPENED: "outline",
  PENDING_RENEWAL: "warning",
};

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const t = useTranslations("Status");
  return <Badge variant={VARIANT_BY_STATUS[status]}>{t(status)}</Badge>;
}
