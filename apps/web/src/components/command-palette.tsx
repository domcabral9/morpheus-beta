"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Boxes, ClipboardList, FileText, Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useApi } from "@/lib/use-api";
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

const CONTENT_SEARCH_MIN_LENGTH = 2;
const CONTENT_SEARCH_DEBOUNCE_MS = 400;

interface ContentSearchResult {
  assessments: Array<{ id: string; softwareName: string; status: string; areaName: string }>;
  inventoryItems: Array<{ id: string; name: string; status: string; areaName: string }>;
  technicalOpinions: Array<{
    id: string;
    number: string;
    classificationLabel: string;
    softwareName: string;
  }>;
}

const EMPTY_CONTENT_RESULT: ContentSearchResult = {
  assessments: [],
  inventoryItems: [],
  technicalOpinions: [],
};

/** Busca rápida (Cmd/Ctrl+K): itens de navegação (client-side, filtro do próprio
 * cmdk) + conteúdo real (avaliações, inventário, pareceres) via `GET /search`,
 * debounced, a partir de 2 caracteres. Cada tipo de conteúdo já vem filtrado
 * pela mesma regra de visibilidade do módulo de origem (ver `SearchService` no
 * backend) - a paleta só formata e agrupa, sem checar permissão de novo.
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
  const statusT = useTranslations("Status");
  const inventoryT = useTranslations("Inventory");
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [contentResult, setContentResult] = React.useState<ContentSearchResult>(EMPTY_CONTENT_RESULT);
  const [isSearchingContent, setIsSearchingContent] = React.useState(false);

  const trimmedQuery = query.trim();
  const showContentGroups = trimmedQuery.length >= CONTENT_SEARCH_MIN_LENGTH;

  // Fecha a paleta = esquece a busca de conteúdo da vez anterior. Reset feito
  // no próprio handler que muda `open` (não num `useEffect` observando
  // `open`) - evita o anti-padrão de "efeito só pra derivar estado".
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery("");
        setContentResult(EMPTY_CONTENT_RESULT);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handleOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleOpenChange]);

  React.useEffect(() => {
    // Query curta demais: nada pra buscar - `showContentGroups` já esconde
    // qualquer resultado antigo na renderização, sem precisar zerar estado aqui.
    if (!showContentGroups) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- liga o spinner ao iniciar a busca debounced; sem isso não há como sinalizar "buscando" antes da resposta assíncrona chegar
    setIsSearchingContent(true);
    const timer = setTimeout(() => {
      api
        .get<ContentSearchResult>(`/search?q=${encodeURIComponent(trimmedQuery)}`)
        .then(setContentResult)
        .catch(() => setContentResult(EMPTY_CONTENT_RESULT))
        .finally(() => setIsSearchingContent(false));
    }, CONTENT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedQuery, showContentGroups, api]);

  if (!user) return null;

  const visiblePrimaryItems = getVisibleNavItems(PRIMARY_NAV_ITEMS, user.permissions);
  const visibleAdminItems = getVisibleNavItems(ADMIN_NAV_ITEMS, user.permissions);
  const visibleContentResult = showContentGroups ? contentResult : EMPTY_CONTENT_RESULT;
  const showSpinner = showContentGroups && isSearchingContent;

  function go(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange} title={paletteT("title")}>
      <CommandInput placeholder={paletteT("placeholder")} value={query} onValueChange={setQuery} />
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

        {visibleContentResult.assessments.length > 0 && (
          <CommandGroup heading={paletteT("groupAssessments")}>
            {visibleContentResult.assessments.map((row) => (
              <CommandItem
                key={`assessment-${row.id}`}
                value={row.softwareName}
                onSelect={() => go(`/assessments/${row.id}`)}
              >
                <ClipboardList />
                <span className="flex-1 truncate">{row.softwareName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.areaName} · {statusT(row.status)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {visibleContentResult.inventoryItems.length > 0 && (
          <CommandGroup heading={paletteT("groupInventory")}>
            {visibleContentResult.inventoryItems.map((row) => (
              <CommandItem
                key={`inventory-${row.id}`}
                value={row.name}
                onSelect={() => go(`/inventory/${row.id}`)}
              >
                <Boxes />
                <span className="flex-1 truncate">{row.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.areaName} · {inventoryT(`statuses.${row.status}`)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {visibleContentResult.technicalOpinions.length > 0 && (
          <CommandGroup heading={paletteT("groupTechnicalOpinions")}>
            {visibleContentResult.technicalOpinions.map((row) => (
              <CommandItem
                key={`opinion-${row.id}`}
                value={row.softwareName}
                onSelect={() => go(`/technical-opinions?number=${encodeURIComponent(row.number)}`)}
              >
                <FileText />
                <span className="flex-1 truncate">{row.softwareName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.number} · {row.classificationLabel}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showSpinner && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {paletteT("searching")}
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
