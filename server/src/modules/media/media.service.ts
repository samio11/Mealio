import { v2 as cloudinary } from "cloudinary";

import type { Media } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { env, features } from "../../app/config/env.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { writeAuditLog, type AuditInput } from "../../app/utils/audit.ts";
import { logger } from "../../app/utils/logger.ts";
import type { ConfirmUploadInput, ListMediaQuery } from "./media.schema.ts";

const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "heic", "pdf"];
const PROFILE_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"];
const DEFAULT_TTL_SECONDS = 15 * 60;

let configured = false;
function ensureCloudinary(): void {
  if (!features.cloudinary) {
    throw new AppError("Media storage is not configured on this server", 503, "AI_PROVIDER_ERROR");
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

function folderFor(messId: string): string {
  return `mess/${messId}`;
}

export interface MediaDto {
  id: string;
  messId: string | null;
  kind: string;
  provider: string;
  resourceType: string;
  publicId: string;
  mimeType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  bazarEntryId: string | null;
  uploadedById: string;
  createdAt: string;
}

/** The `secureUrl` is deliberately omitted from list/detail DTOs — access is always via a signed URL. */
function toDto(row: Media): MediaDto {
  return {
    id: row.id,
    messId: row.messId,
    kind: row.kind,
    provider: row.provider,
    resourceType: row.resourceType,
    publicId: row.publicId,
    mimeType: row.mimeType,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    bazarEntryId: row.bazarEntryId,
    uploadedById: row.uploadedById,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface UploadSignature {
  provider: "cloudinary";
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  uploadUrl: string;
  folder: string;
  type: string;
  allowedFormats: string[];
}

/**
 * Issues a short-lived signature so the client can upload a file **directly** to
 * private storage without proxying bytes through the API. The asset is created
 * with `access_mode=authenticated`, so it is never publicly readable; the server
 * only reveals it through expiring signed URLs.
 */
export function createUploadSignature(messId: string): UploadSignature {
  ensureCloudinary();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = folderFor(messId);
  const paramsToSign = {
    folder,
    timestamp,
    access_mode: "authenticated",
    allowed_formats: ALLOWED_FORMATS.join(","),
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET ?? "");

  return {
    provider: "cloudinary",
    cloudName: env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: env.CLOUDINARY_API_KEY ?? "",
    timestamp,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    folder,
    type: "authenticated",
    allowedFormats: ALLOWED_FORMATS,
  };
}

export function createProfileImageUploadSignature(userId: string): UploadSignature {
  ensureCloudinary();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `profile/${userId}`;
  const type = "upload";
  const allowedFormats = PROFILE_IMAGE_FORMATS;
  const paramsToSign = {
    folder,
    timestamp,
    type,
    allowed_formats: allowedFormats.join(","),
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET ?? "");

  return {
    provider: "cloudinary",
    cloudName: env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: env.CLOUDINARY_API_KEY ?? "",
    timestamp,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    folder,
    type,
    allowedFormats,
  };
}

export async function confirmUpload(
  messId: string,
  actorUserId: string,
  input: ConfirmUploadInput,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<MediaDto> {
  ensureCloudinary();

  // The publicId must live under this mess's folder — blocks cross-tenant claims.
  const expectedPrefix = `${folderFor(messId)}/`;
  if (!input.publicId.startsWith(expectedPrefix)) {
    throw AppError.badRequest("The uploaded asset does not belong to this mess");
  }

  if (input.bazarEntryId) {
    const entry = await db.bazarEntry.findFirst({ where: { id: input.bazarEntryId, messId }, select: { id: true } });
    if (!entry) throw AppError.notFound("Bazar entry not found in this mess");
  }

  const media = await db.$transaction(async (tx) => {
    const createdMedia = await tx.media.create({
      data: {
        messId,
        kind: input.kind,
        provider: "cloudinary",
        publicId: input.publicId,
        resourceType: input.resourceType,
        secureUrl: input.secureUrl ?? null,
        bytes: input.bytes ?? null,
        mimeType: input.mimeType ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        bazarEntryId: input.bazarEntryId ?? null,
        uploadedById: actorUserId,
      },
    });

    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Media",
      entityId: createdMedia.id,
      action: "UPLOAD",
      after: { publicId: input.publicId, kind: input.kind, bazarEntryId: input.bazarEntryId ?? null },
      ...ctx,
    });

    return createdMedia;
  });

  return toDto(media);
}

export async function listMedia(messId: string, query: ListMediaQuery): Promise<MediaDto[]> {
  const rows = await db.media.findMany({
    where: {
      messId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.bazarEntryId ? { bazarEntryId: query.bazarEntryId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

/**
 * Returns a short-lived signed URL for a stored asset. The underlying file is
 * private, so this is the only way to read it.
 */
export async function getSignedUrl(
  messId: string,
  mediaId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<{ url: string; expiresAt: string }> {
  ensureCloudinary();

  const media = await db.media.findFirst({ where: { id: mediaId, messId } });
  if (!media) throw AppError.notFound("Media not found");

  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const format = media.mimeType?.split("/")[1] ?? "jpg";
  const url = cloudinary.utils.private_download_url(media.publicId, format, {
    resource_type: media.resourceType,
    type: "upload",
    expires_at: expiresAt,
  });

  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

export async function deleteMedia(
  messId: string,
  mediaId: string,
  actorUserId: string,
  ctx: Pick<AuditInput, "ip" | "userAgent">,
): Promise<{ id: string }> {
  const media = await db.media.findFirst({ where: { id: mediaId, messId } });
  if (!media) throw AppError.notFound("Media not found");

  if (features.cloudinary) {
    ensureCloudinary();
    try {
      await cloudinary.uploader.destroy(media.publicId, {
        resource_type: media.resourceType,
        type: "upload",
        invalidate: true,
      });
    } catch {
      // Best-effort remote delete; the row is still removed so the app forgets it.
    }
  }

  await db.$transaction(async (tx) => {
    await tx.media.delete({ where: { id: mediaId } });
    await writeAuditLog(tx, {
      messId,
      actorUserId,
      entityType: "Media",
      entityId: mediaId,
      action: "DELETE",
      before: { publicId: media.publicId, kind: media.kind },
      ...ctx,
    });
  });

  return { id: mediaId };
}

export async function cleanupMessCloudinaryAssets(
  assets: readonly Pick<Media, "publicId" | "resourceType">[],
  messId: string,
): Promise<number> {
  if (assets.length === 0) return 0;
  if (!features.cloudinary) {
    logger.warn({ messId, failedCount: assets.length }, "mess media rows deleted but Cloudinary cleanup is not configured");
    return assets.length;
  }

  let results: PromiseSettledResult<Awaited<ReturnType<typeof cloudinary.uploader.destroy>>>[];
  try {
    ensureCloudinary();
    results = await Promise.allSettled(
      assets.map((asset) =>
        cloudinary.uploader.destroy(asset.publicId, {
          resource_type: asset.resourceType,
          type: "upload",
          invalidate: true,
        }),
      ),
    );
  } catch (error) {
    logger.warn({ messId, error, failedCount: assets.length }, "could not initialize Cloudinary cleanup");
    return assets.length;
  }
  const failedCount = results.filter(
    (result) => result.status === "rejected" || (result.value.result !== "ok" && result.value.result !== "not found"),
  ).length;
  if (failedCount > 0) {
    logger.warn({ messId, failedCount, total: assets.length }, "some mess media assets could not be deleted from Cloudinary");
  }
  return failedCount;
}

export async function cleanupCloudinaryProfileAssets(
  userId: string,
  hasProfileImage: boolean,
): Promise<number> {
  if (!features.cloudinary) {
    if (hasProfileImage) {
      logger.warn({ userId }, "profile image row deleted but Cloudinary cleanup is not configured");
      return 1;
    }
    return 0;
  }

  try {
    ensureCloudinary();
    await cloudinary.api.delete_resources_by_prefix(`profile/${userId}/`, {
      resource_type: "image",
      type: "upload",
    });
    return 0;
  } catch (error) {
    logger.warn({ userId, error }, "could not delete profile assets from Cloudinary");
    return 1;
  }
}
