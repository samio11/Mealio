"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/lib/api/client";

/** Compact pagination footer used by every paginated list. */
export function Pagination({
  meta,
  onPageChange,
  className,
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (!meta || meta.totalPages <= 1) {
    return meta && meta.total > 0 ? (
      <p className="px-1 pt-3 text-xs text-muted-foreground">{meta.total} record(s)</p>
    ) : null;
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-1 pt-3 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground">
        Page {meta.page} of {meta.totalPages} · {meta.total} record(s)
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
