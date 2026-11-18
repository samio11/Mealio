"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMyMesses } from "@/lib/hooks/queries";
import { cn } from "@/lib/utils";

/** Switches the active mess; the mess id is part of the URL, so this just navigates. */
export function MessSwitcher({
  messId,
  messName,
  className,
  collapsed = false,
}: {
  messId: string;
  messName: string;
  className?: string;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const { data: messes } = useMyMesses();
  const active = (messes ?? []).filter((m) => m.status === "ACTIVE");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full justify-between gap-2 px-2 py-2 text-left",
            collapsed && "justify-center px-2",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              {(messName ?? "?").slice(0, 2).toUpperCase()}
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{messName}</span>
            ) : null}
          </span>
          {!collapsed ? <ChevronsUpDown className="size-4 shrink-0 opacity-60" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your messes</DropdownMenuLabel>
        {active.length === 0 ? (
          <DropdownMenuItem disabled>No other messes yet</DropdownMenuItem>
        ) : (
          active.map((mess) => (
            <DropdownMenuItem
              key={mess.messId}
              onSelect={() => router.push(`/m/${mess.messId}/dashboard`)}
              className="gap-2"
            >
              <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                {(mess.name ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{mess.name}</span>
              {mess.messId === messId ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="gap-2">
            <Plus className="size-4" />
            Create or join a mess
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
