"use client";

import { CalendarRange, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveMonth } from "@/lib/context/active-month";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

/**
 * Chooses which month the whole app is showing. Months come from the mess's
 * own configuration, so this stays empty until the manager creates one.
 */
export function MonthSelector({ className }: { className?: string }) {
  const { months, activeMonth, setActiveMonthId, hasNoMonths } = useActiveMonth();

  if (hasNoMonths) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <CalendarRange />
        No month yet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-between gap-2", className)}>
          <CalendarRange className="text-muted-foreground" />
          <span className="truncate">{activeMonth?.label ?? "Select month"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Report month</DropdownMenuLabel>
        {months.map((month) => (
          <DropdownMenuItem
            key={month.id}
            onSelect={() => setActiveMonthId(month.id)}
            className="justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <span className="truncate">{month.label}</span>
              <StatusBadge status={month.status} />
            </span>
            {month.id === activeMonth?.id ? <Check className="size-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {months.length} month(s) configured
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
