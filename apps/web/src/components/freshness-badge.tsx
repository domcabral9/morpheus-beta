import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { FreshnessState } from "@/lib/inventory-types";

function freshnessVariant(state: FreshnessState): "success" | "destructive" | "secondary" {
  if (state === "up-to-date") return "success";
  if (state === "outdated") return "destructive";
  return "secondary";
}

export function FreshnessBadge({ state }: { state: FreshnessState }) {
  const t = useTranslations("Inventory");
  return <Badge variant={freshnessVariant(state)}>{t(`lifecycle.${state}`)}</Badge>;
}
