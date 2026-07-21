import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PaginationProps extends React.ComponentProps<"nav"> {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels?: { previous: string; next: string; pageOf: (page: number, totalPages: number) => string };
}

const DEFAULT_LABELS = {
  previous: "Anterior",
  next: "Próxima",
  pageOf: (page: number, totalPages: number) => `Página ${page} de ${totalPages}`,
};

function Pagination({
  page,
  totalPages,
  onPageChange,
  labels = DEFAULT_LABELS,
  className,
  ...props
}: PaginationProps) {
  const clampedTotal = Math.max(totalPages, 1);

  return (
    <nav
      data-slot="pagination"
      aria-label="pagination"
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    >
      <span className="text-sm text-muted-foreground">{labels.pageOf(page, clampedTotal)}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
          {labels.previous}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= clampedTotal}
          onClick={() => onPageChange(page + 1)}
        >
          {labels.next}
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

export { Pagination };
