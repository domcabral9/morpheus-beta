"use client";

import { useTranslations } from "next-intl";
import { ShieldIcon, UserIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHasAnyManagePermission, usePermission } from "@/lib/use-permission";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "assessmentsLink" },
  { href: "/dashboards", labelKey: "dashboardsLink" },
] as const;

export function AppHeader() {
  const t = useTranslations("Dashboard");
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const canAccessAdmin = useHasAnyManagePermission();
  const canApprove = usePermission("assessments:approve");
  const canViewInventory = usePermission("inventory:view");

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold tracking-tight">Morpheus</span>
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === item.href && "font-medium text-foreground",
              )}
            >
              {t(item.labelKey)}
            </Link>
          ))}
          {canViewInventory && (
            <Link
              href="/inventory"
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith("/inventory") && "font-medium text-foreground",
              )}
            >
              {t("inventoryLink")}
            </Link>
          )}
          {canApprove && (
            <Link
              href="/approvals"
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === "/approvals" && "font-medium text-foreground",
              )}
            >
              {t("approvalsLink")}
            </Link>
          )}
          {canAccessAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith("/admin") && "font-medium text-foreground",
              )}
            >
              <ShieldIcon className="size-3.5" />
              {t("adminLink")}
            </Link>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <LocaleSwitcher label={t("localeSwitcherLabel")} />
        <ThemeToggle label={t("themeToggleLabel")} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <UserIcon className="size-4" />
              {user?.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
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
      </div>
    </header>
  );
}
