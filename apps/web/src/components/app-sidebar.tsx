"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, ShieldIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useHasAnyManagePermission } from "@/lib/use-permission";
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS, getVisibleNavItems, isNavItemActive } from "@/lib/nav-items";
import { OrgSwitcher } from "@/components/org-switcher";

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

export function AppSidebar() {
  const t = useTranslations("Nav");
  const adminT = useTranslations("Admin");
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const canAccessAdmin = useHasAnyManagePermission();
  const permissions = user?.permissions ?? [];
  const { state, isMobile } = useSidebar();
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  const visiblePrimaryItems = getVisibleNavItems(PRIMARY_NAV_ITEMS, permissions);
  const visibleAdminItems = getVisibleNavItems(ADMIN_NAV_ITEMS, permissions);
  const adminActive = isNavItemActive(pathname, "/admin");
  // Sidebar colapsada (modo ícone) esconde SidebarMenuSub via CSS
  // (group-data-[collapsible=icon]:hidden) — sem isso, "Administração" fica
  // clicável mas sem nenhuma forma de alcançar os sub-itens. Nesse estado a
  // seção vira um dropdown/flyout em vez do Collapsible inline.
  const adminAsFlyout = !isMobile && state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <ShieldIcon className="text-sidebar-primary" />
                <span className="text-base font-semibold tracking-tight">{t("brand")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <OrgSwitcher />
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {visiblePrimaryItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href, item.href === "/dashboard");
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={t(item.labelKey)}>
                    <Link href={item.href}>
                      <Icon />
                      <span>{t(item.labelKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            {canAccessAdmin && adminAsFlyout && (
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton isActive={adminActive}>
                      <ShieldIcon />
                      <span>{t("admin")}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="min-w-48">
                    <DropdownMenuLabel>{t("admin")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {visibleAdminItems.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>{adminT(item.labelKey)}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            )}

            {canAccessAdmin && !adminAsFlyout && (
              <Collapsible defaultOpen={adminActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={adminActive} tooltip={t("admin")}>
                      <ShieldIcon />
                      <span>{t("admin")}</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleAdminItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                            <Link href={item.href}>
                              <span>{adminT(item.labelKey)}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-6 rounded-md">
                    <AvatarFallback className="rounded-md">{getInitials(user?.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{user?.name}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setChangePasswordOpen(true)}>
                  {t("changePassword")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    void logout().then(() => router.replace("/login"));
                  }}
                >
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </Sidebar>
  );
}
