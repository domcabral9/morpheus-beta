"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

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
import type { VendorDetail, VendorListItem } from "@/lib/vendor-types";
import { VendorQuickCreateDialog } from "./vendor-quick-create-dialog";

const SEARCH_DEBOUNCE_MS = 300;

export interface VendorComboboxValue {
  vendorId?: string;
  vendorName: string;
}

interface VendorComboboxProps {
  value: VendorComboboxValue;
  onChange: (value: VendorComboboxValue) => void;
}

/** Combobox de fornecedor com fallback pra texto livre e "+ cadastrar novo
 * fornecedor" (decisão #3 do plano). Reaproveitado em qualquer formulário que
 * precise vincular um `Vendor` real a uma entidade (hoje: nova Assessment). */
export function VendorCombobox({ value, onChange }: VendorComboboxProps) {
  const t = useTranslations("Vendors");
  const api = useApi();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<VendorListItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ page: "1", pageSize: "10" });
      if (query.trim()) params.set("search", query.trim());
      api
        .get<{ items: VendorListItem[] }>(`/vendors?${params.toString()}`)
        .then((result) => setResults(result.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- api muda de referência a cada render por causa do accessToken; não precisa disparar a busca de novo por isso
  }, [open, query]);

  function selectVendor(vendor: VendorListItem) {
    onChange({ vendorId: vendor.id, vendorName: vendor.name });
    setOpen(false);
    setQuery("");
  }

  function useFreeText() {
    onChange({ vendorId: undefined, vendorName: query.trim() });
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !value.vendorName && "text-muted-foreground")}>
              {value.vendorName || t("comboboxPlaceholder")}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("comboboxSearchPlaceholder")}
            />
            <CommandList>
              {!loading && results.length === 0 && <CommandEmpty>{t("comboboxEmpty")}</CommandEmpty>}
              <CommandGroup>
                {results.map((vendor) => (
                  <CommandItem key={vendor.id} value={vendor.id} onSelect={() => selectVendor(vendor)}>
                    <Check
                      className={cn("size-4", value.vendorId === vendor.id ? "opacity-100" : "opacity-0")}
                    />
                    {vendor.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {query.trim() && (
                <CommandGroup>
                  <CommandItem value={`free-text-${query}`} onSelect={useFreeText}>
                    {t("comboboxUseFreeText", { name: query.trim() })}
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                <CommandItem
                  value="quick-create"
                  onSelect={() => {
                    setOpen(false);
                    setQuickCreateOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  {t("comboboxQuickCreate")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <VendorQuickCreateDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onCreated={(vendor: VendorDetail) => {
          onChange({ vendorId: vendor.id, vendorName: vendor.name });
          setQuickCreateOpen(false);
        }}
      />
    </>
  );
}
