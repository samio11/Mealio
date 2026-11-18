"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/app-shell/nav-config";
import { cn } from "@/lib/utils";

/** Primary section navigation. Rendered once in the sidebar and again in the mobile sheet. */
export function NavLinks({
  messId,
  role,
  onNavigate,
  className,
}: {
  messId: string;
  role: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.managerOnly || role === "MANAGER");

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {items.map((item) => {
        const href = `/m/${messId}/${item.segment}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.segment}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
