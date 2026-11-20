import type { User } from "../../generated/prisma/client.ts";
import { db } from "../../app/db/prisma.ts";
import { AppError } from "../../app/utils/app-error.ts";
import { cleanupCloudinaryProfileImage } from "../media/media.service.ts";
import type { UpdateMeInput } from "./users.schema.ts";

export interface UserProfileDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  image: string | null;
  locale: string;
  platformRole: string;
  createdAt: string;
}

export function toUserProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    image: user.image,
    locale: user.locale,
    platformRole: user.platformRole,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getProfile(userId: string): Promise<UserProfileDto> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found");
  return toUserProfileDto(user);
}

export async function updateProfile(userId: string, input: UpdateMeInput): Promise<UserProfileDto> {
  const previous = input.image !== undefined
    ? await db.user.findUnique({ where: { id: userId }, select: { image: true } })
    : null;

  if (input.phone) {
    const existing = await db.user.findUnique({ where: { phone: input.phone } });
    if (existing && existing.id !== userId) {
      throw AppError.conflict("That phone number is already in use");
    }
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone, phoneVerified: false } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
    },
  });

  if (previous?.image && previous.image !== user.image) {
    await cleanupCloudinaryProfileImage(userId, previous.image);
  }

  return toUserProfileDto(user);
}

/** The messes the user belongs to, with their role in each. */
export async function listMyMesses(userId: string) {
  const memberships = await db.messMembership.findMany({
    where: { userId, status: { not: "REMOVED" } },
    orderBy: { joinedAt: "asc" },
    include: { mess: { select: { id: true, name: true, area: true, archivedAt: true } } },
  });

  return memberships.map((m) => ({
    messId: m.messId,
    name: m.mess.name,
    area: m.mess.area,
    archived: m.mess.archivedAt !== null,
    role: m.role,
    status: m.status,
    membershipId: m.id,
  }));
}
