export const QUERY_CACHE = {
  defaultStaleTime: 2 * 60_000,
  referenceStaleTime: 5 * 60_000,
  reportStaleTime: 30_000,
  liveStaleTime: 15_000,
  gcTime: 30 * 60_000,
} as const;
