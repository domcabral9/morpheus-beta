import { Badge } from "@/components/ui/badge";

// Tier 1 = melhor cenário (menos acompanhamento), tier mais alto = pior -
// inverso da escala de score, onde valor maior é favorável. Por isso nunca
// mostrar o número cru: sempre "Tier N · Rótulo", com uma cor aproximada por
// faixa (o hex exato de cada tier vive em VendorTierThreshold.color, editável
// pelo admin, mas essa tela é visível também a quem só tem `vendors:view` -
// sem acesso ao endpoint de tier-config - então o badge usa uma variante fixa
// em vez de buscar a cor configurada.
function tierVariant(tier: number): "success" | "secondary" | "warning" | "destructive" {
  if (tier <= 1) return "success";
  if (tier === 2) return "secondary";
  if (tier === 3) return "warning";
  return "destructive";
}

export function TierBadge({ tier, label }: { tier: number; label: string }) {
  return <Badge variant={tierVariant(tier)}>{`Tier ${tier} · ${label}`}</Badge>;
}
