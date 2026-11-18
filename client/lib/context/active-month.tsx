"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { MessMonth } from "@/lib/api/types";

interface ActiveMonthValue {
  months: MessMonth[];
  activeMonth: MessMonth | null;
  setActiveMonthId: (monthId: string) => void;
  /** True when the mess has no months configured yet. */
  hasNoMonths: boolean;
}

const ActiveMonthContext = createContext<ActiveMonthValue | null>(null);

function storageKey(messId: string) {
  return `mm:activeMonth:${messId}`;
}

function pickDefault(months: MessMonth[]): MessMonth | null {
  if (months.length === 0) return null;
  const now = new Date();
  // Dhaka is a fixed UTC+06:00 offset, so shifting the clock gives the local month.
  const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const current = months.find((m) => m.year === dhaka.getUTCFullYear() && m.month === dhaka.getUTCMonth() + 1);
  if (current) return current;
  return months.find((m) => m.status === "OPEN") ?? months[0];
}

/**
 * Holds the month the user is currently looking at. Every feature page reads
 * it from here, so switching months in the header switches the whole app.
 */
export function MonthProvider({
  messId,
  months,
  children,
}: {
  messId: string;
  months: MessMonth[];
  children: ReactNode;
}) {
  const [activeMonthId, setActiveMonthIdState] = useState<string | null>(null);

  // Restore the last selection for this mess (client-only to avoid hydration drift).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey(messId));
    if (stored && months.some((m) => m.id === stored)) {
      setActiveMonthIdState(stored);
      return;
    }
    setActiveMonthIdState(pickDefault(months)?.id ?? null);
  }, [messId, months]);

  const setActiveMonthId = useCallback(
    (monthId: string) => {
      setActiveMonthIdState(monthId);
      if (typeof window !== "undefined") window.localStorage.setItem(storageKey(messId), monthId);
    },
    [messId],
  );

  const value = useMemo<ActiveMonthValue>(() => {
    const activeMonth = months.find((m) => m.id === activeMonthId) ?? null;
    return { months, activeMonth, setActiveMonthId, hasNoMonths: months.length === 0 };
  }, [months, activeMonthId, setActiveMonthId]);

  return <ActiveMonthContext.Provider value={value}>{children}</ActiveMonthContext.Provider>;
}

export function useActiveMonth(): ActiveMonthValue {
  const value = useContext(ActiveMonthContext);
  if (!value) throw new Error("useActiveMonth must be used inside <MonthProvider>");
  return value;
}

/**
 * Convenience for pages that cannot render without a selected month. Returns
 * the month plus a ready-made "create a month first" message flag.
 */
export function useRequiredMonth() {
  const { activeMonth, hasNoMonths } = useActiveMonth();
  return { month: activeMonth, hasNoMonths, monthId: activeMonth?.id ?? null };
}
