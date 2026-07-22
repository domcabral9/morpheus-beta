"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Building2, ChevronsUpDown } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/lib/use-api";
import { useIsSuperAdmin } from "@/lib/use-permission";
import type { TenantSummary } from "@/lib/auth-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function OrgSwitcher() {
  const t = useTranslations("Nav");
  const isSuperAdmin = useIsSuperAdmin();
  const { user, switchTenant } = useAuth();
  const api = useApi();

  const [tenants, setTenants] = React.useState<TenantSummary[] | null>(null);

  if (!isSuperAdmin || !user) return null;

  const currentTenant = tenants?.find((tenant) => tenant.id === user.tenantId);

  return (
    <SidebarMenuItem>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open && !tenants) {
            api.get<TenantSummary[]>("/tenants").then(setTenants).catch(() => {});
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="sm" tooltip={t("orgSwitcher")}>
            <Building2 />
            <span className="truncate">{currentTenant?.name ?? t("orgSwitcher")}</span>
            <ChevronsUpDown className="ml-auto size-3.5 text-sidebar-foreground/50" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-56">
          <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
            {t("orgSwitcher")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!tenants && (
            <DropdownMenuLabel className="font-normal">{t("orgSwitcherLoading")}</DropdownMenuLabel>
          )}
          {tenants && (
            <DropdownMenuRadioGroup
              value={user.tenantId}
              onValueChange={(tenantId) => {
                if (tenantId !== user.tenantId) void switchTenant(tenantId);
              }}
            >
              {tenants.map((tenant) => (
                <DropdownMenuRadioItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
