"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";

import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { InventoryEolProduct } from "@/lib/inventory-types";

const SEARCH_DEBOUNCE_MS = 300;

interface EolProductComboboxProps {
  value: InventoryEolProduct | null;
  onChange: (value: InventoryEolProduct) => void;
}

/** Combobox de vínculo com o catálogo local de ciclo de vida de versão
 * (endoflife.date, sincronizado à noite - ver EolCatalogScheduler). Sem ramo
 * de texto livre/criação, ao contrário do VendorCombobox: precisa ser
 * sempre um match confirmado do catálogo (nunca auto-detectado por nome). */
export function EolProductCombobox({ value, onChange }: EolProductComboboxProps) {
  const t = useTranslations("Inventory");
  const api = useApi();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<InventoryEolProduct[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Sem query, não busca nada - `results` pode ficar com o valor anterior
    // (stale), mas o JSX só renderiza resultados quando `query.trim()`
    // existe, então nunca aparece. Evita setState síncrono no corpo do
    // effect (react-hooks/set-state-in-effect - achado real já documentado
    // no dashboard de conformidade, PR #137).
    if (!open || !query.trim()) return;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ search: query.trim() });
      api
        .get<InventoryEolProduct[]>(`/inventory/enrichment/eol-products?${params.toString()}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- api muda de referência a cada render por causa do accessToken; não precisa disparar a busca de novo por isso
  }, [open, query]);

  function select(product: InventoryEolProduct) {
    onChange(product);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.name : t("eolComboboxPlaceholder")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("eolComboboxSearchPlaceholder")}
          />
          <CommandList>
            {!loading && query.trim() && results.length === 0 && (
              <CommandEmpty>{t("eolComboboxEmpty")}</CommandEmpty>
            )}
            <CommandGroup>
              {query.trim() &&
                results.map((product) => (
                  <CommandItem
                    key={product.slug}
                    value={product.slug}
                    onSelect={() => select(product)}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value?.slug === product.slug ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {product.name}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
