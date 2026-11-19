"use client";

import { useQuery } from "@tanstack/react-query";

import { messesApi, monthsApi, usersApi } from "@/lib/api/endpoints";
import { QUERY_CACHE } from "@/lib/query-cache";

/**
 * Query key factory. Centralised so a mutation can invalidate exactly the
 * right caches without guessing string shapes.
 */
export const qk = {
  session: ["session"] as const,
  me: ["users", "me"] as const,
  myMesses: ["users", "me", "messes"] as const,
  mess: (messId: string) => ["mess", messId] as const,
  months: (messId: string) => ["months", messId] as const,
  month: (messId: string, monthId: string) => ["months", messId, monthId] as const,
  summary: (messId: string, monthId: string) => ["reports", messId, "summary", monthId] as const,
  report: (messId: string, monthId: string) => ["reports", messId, "monthly", monthId] as const,
  balances: (messId: string, monthId: string) => ["reports", messId, "balances", monthId] as const,
  meals: (messId: string) => ["meals", messId] as const,
  mealCounts: (messId: string, monthId: string) => ["meals", messId, "counts", monthId] as const,
  mealTimeline: (messId: string, monthId: string) => ["meals", messId, "timeline", monthId] as const,
  mealStatus: (messId: string, date: string) => ["meals", messId, "status", date] as const,
  mealRecords: (messId: string, filters: unknown) => ["meals", messId, "records", filters] as const,
  menus: (messId: string, filters: unknown) => ["menus", messId, filters] as const,
  groceryItems: (messId: string, filters: unknown) => ["grocery-items", messId, filters] as const,
  groceryPrices: (messId: string, filters: unknown) => ["grocery-prices", messId, filters] as const,
  deposits: (messId: string, filters: unknown) => ["deposits", messId, filters] as const,
  expenses: (messId: string, filters: unknown) => ["expenses", messId, filters] as const,
  utilities: (messId: string, filters: unknown) => ["utilities", messId, filters] as const,
  bazar: (messId: string, filters: unknown) => ["bazar", messId, filters] as const,
  bazarEntry: (messId: string, entryId: string) => ["bazar", messId, entryId] as const,
  duties: (messId: string, filters: unknown) => ["duties", messId, filters] as const,
  members: (messId: string, filters: unknown) => ["members", messId, filters] as const,
  invitations: (messId: string) => ["invitations", messId] as const,
  audit: (messId: string, filters: unknown) => ["audit", messId, filters] as const,
  media: (messId: string, filters: unknown) => ["media", messId, filters] as const,
  mediaUrl: (messId: string, mediaId: string) => ["media", messId, mediaId, "url"] as const,
  aiUsage: (messId: string) => ["ai", messId, "usage"] as const,
};

export function useMyMesses() {
  return useQuery({
    queryKey: qk.myMesses,
    queryFn: () => usersApi.myMesses(),
    staleTime: QUERY_CACHE.referenceStaleTime,
  });
}

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => usersApi.me(),
    staleTime: QUERY_CACHE.referenceStaleTime,
  });
}

export function useMess(messId: string) {
  return useQuery({
    queryKey: qk.mess(messId),
    queryFn: () => messesApi.get(messId),
    enabled: Boolean(messId),
    staleTime: QUERY_CACHE.referenceStaleTime,
  });
}

export function useMonths(messId: string) {
  return useQuery({
    queryKey: qk.months(messId),
    queryFn: () => monthsApi.list(messId),
    enabled: Boolean(messId),
    staleTime: QUERY_CACHE.referenceStaleTime,
  });
}
