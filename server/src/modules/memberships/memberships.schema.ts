import { z } from "zod";

import { zBdPhone, zListQuery, zUuid } from "../../app/utils/zod-helpers.ts";

export const messMemberParamSchema = z.object({
  messId: zUuid,
  memberId: zUuid,
});

export const listMembersQuerySchema = zListQuery.extend({
  status: z.enum(["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
  includeRemoved: z.coerce.boolean().optional(),
  search: z.string().trim().max(120).optional(),
});

/**
 * A manager may change role/status; any member may change the profile fields of
 * their own membership. The service enforces that distinction.
 */
export const updateMembershipSchema = z
  .object({
    role: z.enum(["MANAGER", "MEMBER"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    displayName: z.string().trim().min(1).max(120).nullable().optional(),
    phone: zBdPhone.nullable().optional(),
    isDutyEligible: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
