import { z } from "zod";

import { zUuid } from "../../app/utils/zod-helpers.ts";

export const mediaKindSchema = z.enum(["BAZAR_PHOTO", "RECEIPT", "AVATAR", "PROOF", "OTHER"]);

export const mediaIdParamSchema = z.object({
  messId: zUuid,
  mediaId: zUuid,
});

export const signUploadSchema = z.object({
  kind: mediaKindSchema.default("BAZAR_PHOTO"),
});

export const confirmUploadSchema = z.object({
  publicId: z.string().trim().min(3).max(400),
  kind: mediaKindSchema.default("BAZAR_PHOTO"),
  bazarEntryId: zUuid.nullable().optional(),
  secureUrl: z.string().url().max(2048).nullable().optional(),
  bytes: z.coerce.number().int().nonnegative().max(50_000_000).optional(),
  mimeType: z.string().trim().max(120).optional(),
  width: z.coerce.number().int().positive().max(20_000).optional(),
  height: z.coerce.number().int().positive().max(20_000).optional(),
  resourceType: z.enum(["image", "video", "raw"]).default("image"),
});

export const listMediaQuerySchema = z.object({
  kind: mediaKindSchema.optional(),
  bazarEntryId: zUuid.optional(),
});

export const signedUrlQuerySchema = z.object({
  /** Seconds until the signed URL expires (default 15 minutes). */
  ttl: z.coerce.number().int().min(30).max(3600).optional(),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type ListMediaQuery = z.infer<typeof listMediaQuerySchema>;
