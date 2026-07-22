"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";

interface TenantCurrent {
  id: string;
  name: string;
}

export function ImpersonationBanner() {
  const t = useTranslations("Nav");
  const { user, switchTenant } = useAuth();
  const api = useApi();

  const isImpersonating = Boolean(user && user.tenantId !== user.homeTenantId);
  const [tenantName, setTenantName] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Nada a fazer quando não está impersonando: o componente retorna null
    // logo abaixo nesse caso, então um `tenantName` desatualizado nunca chega
    // a ser exibido - evita um setState síncrono só pra "limpar" um estado
    // que já não é renderizado.
    if (!isImpersonating) return;
    api
      .get<TenantCurrent>("/tenants/current")
      .then((tenant) => setTenantName(tenant.name))
      .catch(() => setTenantName(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImpersonating, user?.tenantId]);

  if (!user || !isImpersonating) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200 sm:px-6">
      <span className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" />
        {t("impersonationBanner", { tenant: tenantName ?? "…" })}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-500/40 bg-transparent hover:bg-amber-500/10"
        onClick={() => void switchTenant(user.homeTenantId)}
      >
        {t("impersonationReturn")}
      </Button>
    </div>
  );
}
