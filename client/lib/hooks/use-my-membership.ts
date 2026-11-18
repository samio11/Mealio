"use client";

import { useQuery } from "@tanstack/react-query";

import { membersApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/auth-client";
import { qk } from "@/lib/hooks/queries";
import type { Member } from "@/lib/api/types";
import { QUERY_CACHE } from "@/lib/query-cache";

/**
 * Resolves the signed-in user's own membership row for a mess. Member-scoped
 * DTOs (balances, meal counts, duties) key off the membership id, not the user
 * id, so this mapping is needed to highlight "you".
 */
export function useMyMembership(messId: string) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const query = useQuery({
    queryKey: [...qk.members(messId, { scope: "active-roster" })] as const,
    queryFn: () => membersApi.list(messId, { status: "ACTIVE", pageSize: 100 }),
    enabled: Boolean(messId),
    staleTime: QUERY_CACHE.referenceStaleTime,
  });

  const member: Member | null = userId
    ? (query.data?.items.find((item) => item.userId === userId) ?? null)
    : null;

  return { ...query, member, isManager: member?.role === "MANAGER" };
}
