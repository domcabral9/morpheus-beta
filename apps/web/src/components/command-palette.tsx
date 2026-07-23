"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth-provider";
import { useRouter } from "@/i18n/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ADMIN_NAV_ITEMS, PRIMARY_NAV_ITEMS, getVisibleNavItems } from "@/lib/nav-items";

/** Busca rápida (Cmd/Ctrl+K) sobre os itens de navegação já existentes — não é busca de
 * conteúdo (avaliações, usuários, etc.), só um atalho pra chegar mais rápido numa tela que
 * já está no menu. Índice e filtro de permissão são os mesmos de `app-sidebar.tsx`, via
 * `getVisibleNavItems`, pra nunca divergir sobre o que aparece.
 *
 * `open`/`onOpenChange` controlados de fora (`AppShell`) - existem dois jeitos de abrir a
 * mesma paleta (atalho de teclado e a caixa visível no header), então o estado precisa viver
 * acima dos dois pra não divergirem entre si. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Nav");
  const adminT = useTranslations("Admin");
  const paletteT = useTranslations("CommandPalette");
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!user) return null;

  const visiblePrimaryItems = getVisibleNavItems(PRIMARY_NAV_ITEMS, user.permissions);
  const visibleAdminItems = getVisibleNavItems(ADMIN_NAV_ITEMS, user.permissions);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={paletteT("title")}>
      <CommandInput placeholder={paletteT("placeholder")} />
      <CommandList>
        <CommandEmpty>{paletteT("noResults")}</CommandEmpty>
        <CommandGroup heading={paletteT("groupPrimary")}>
          {visiblePrimaryItems.map((item) => (
            <CommandItem key={item.href} value={t(item.labelKey)} onSelect={() => go(item.href)}>
              <item.icon />
              <span>{t(item.labelKey)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {visibleAdminItems.length > 0 && (
          <CommandGroup heading={paletteT("groupAdmin")}>
            {visibleAdminItems.map((item) => (
              <CommandItem
                key={item.href}
                value={adminT(item.labelKey)}
                onSelect={() => go(item.href)}
              >
                <span>{adminT(item.labelKey)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
