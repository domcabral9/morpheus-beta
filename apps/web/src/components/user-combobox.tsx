"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";

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
import type { UserOption } from "@/lib/user-picker-types";

interface UserComboboxProps {
  id?: string;
  users: UserOption[];
  value: string;
  onChange: (userId: string) => void;
  ariaInvalid?: boolean;
}

/** Seletor de usuário com busca por nome/e-mail - filtragem 100% client-side
 * (`GET /users` já devolve a lista inteira do tenant, sem paginação), então
 * reusa o filtro embutido do `Command` em vez do padrão de busca no servidor
 * do `VendorCombobox`. Substitui o `<Select>` simples nos campos de
 * gestor/responsável técnico do formulário de inventário - uma lista longa e
 * sem busca escala mal. */
export function UserCombobox({ id, users, value, onChange, ariaInvalid }: UserComboboxProps) {
  const t = useTranslations("Inventory");
  const [open, setOpen] = React.useState(false);

  const selected = users.find((user) => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.name} (${selected.email})` : t("fieldUserPlaceholder")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("userComboboxSearchPlaceholder")} />
          <CommandList>
            <CommandEmpty>{t("userComboboxEmpty")}</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email}`}
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === user.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
