"use client";

import { useState } from "react";

import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatPoishaPlain } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Illustrative product preview for the landing page. The numbers are a
 * hand-built example, not real user data, and the panel is clearly labelled as
 * a preview so nothing here can be mistaken for a live mess.
 */
const ROWS = [
  { label: "Total meals", value: "1,000", sub: "breakfast 300 · lunch 400 · dinner 300" },
  { label: "Meal rate", value: `৳${formatPoishaPlain("3000")}`, sub: "meal expense ÷ total meals" },
  { label: "Verified deposits", value: `৳${formatPoishaPlain("3200000")}`, sub: "confirmed money received" },
  { label: "Closing cash", value: `৳${formatPoishaPlain("500000")}`, sub: "opening + deposits − approved payments" },
];

const PENDING = [
  { name: "Bazar — Karwan Bazar", amount: "৳2,150.00", status: "PENDING_REVIEW" },
  { name: "Deposit — bKash", amount: "৳3,000.00", status: "PENDING" },
  { name: "Electricity bill", amount: "৳1,280.00", status: "PENDING" },
];

export function ProductPreview() {
  const [month, setMonth] = useState("November 2026");

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/60" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/60" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">Sunrise Students Mess</span>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth("November 2026")} className="h-7 gap-1.5">
            {month}
            <ChevronsUpDown className="size-3.5 opacity-60" />
          </Button>
          <span className="hidden rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning-foreground sm:inline">
            Preview
          </span>
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {ROWS.map((row) => (
          <div key={row.label} className="rounded-lg border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <p className="tabular mt-1 text-lg font-semibold">{row.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{row.sub}</p>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs verification</p>
        <ul className="mt-2 divide-y">
          {PENDING.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <Check className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.name}</span>
                <StatusBadge status={item.status} className={cn("shrink-0 scale-90")} />
              </span>
              <span className="tabular shrink-0 text-sm font-medium">{item.amount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
