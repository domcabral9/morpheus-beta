import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ExposureState } from "@/lib/inventory-types";

function exposureVariant(state: ExposureState): "success" | "destructive" | "secondary" {
  if (state === "no-known-vulnerabilities") return "success";
  if (state === "exposed") return "destructive";
  return "secondary";
}

export function ExposureBadge({ state }: { state: ExposureState }) {
  const t = useTranslations("Inventory");
  return <Badge variant={exposureVariant(state)}>{t(`exposure.states.${state}`)}</Badge>;
}
