"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, messageFrom } from "@/lib/api/client";
import { NotFoundState } from "@/components/shared/not-found-state";

/**
 * Turns any query/mutation failure into a readable message. Business-rule
 * violations (422) are expected user-facing errors, so they are shown plainly
 * rather than as a scary failure.
 */
export function ErrorState({
  error,
  onRetry,
  compact = false,
  title,
  backHref,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
  title?: string;
  backHref?: string;
}) {
  const message = messageFrom(error, "Something went wrong. Please try again.");
  const isForbidden = error instanceof ApiError && error.isForbidden;
  const isNotFound = error instanceof ApiError && error.isNotFound;

  if (isNotFound) {
    return (
      <NotFoundState
        title={title ?? "Not found"}
        description="The page or data you requested could not be found."
        backHref={backHref}
        compact={compact}
      />
    );
  }

  return (
    <Alert variant={isForbidden ? "warning" : "destructive"} className={compact ? "p-3" : undefined}>
      <TriangleAlert />
      <div className="flex flex-col gap-2">
        <div>
          <AlertTitle>{title ?? (isForbidden ? "You do not have access" : "Could not load this")}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            <RefreshCw />
            Try again
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}

/** Small inline error for forms and action rows (non-blocking). */
export function InlineError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-destructive">{children}</p>;
}
