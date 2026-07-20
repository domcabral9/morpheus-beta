import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `<select>` nativo estilizado — não é o shadcn/ui Select (Radix), que exige
 * bem mais peças (Trigger/Content/Item) do que este formulário precisa por
 * enquanto. Suficiente para listas curtas (área, criticidade, opções de
 * pergunta); se algum dropdown precisar de busca/virtualização depois, aí
 * sim vale trocar pelo componente Radix completo.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
