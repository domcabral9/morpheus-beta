import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ReputationState } from "@/lib/inventory-types";

function reputationVariant(
  state: ReputationState,
): "success" | "destructive" | "outline" | "secondary" {
  if (state === "verified-clean") return "success";
  if (state === "verified-suspicious") return "destructive";
  if (state === "declared-known") return "outline";
  return "secondary";
}

export function ReputationBadge({ state }: { state: ReputationState }) {
  const t = useTranslations("Inventory");
  return <Badge variant={reputationVariant(state)}>{t(`reputation.states.${state}`)}</Badge>;
}
