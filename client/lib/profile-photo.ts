import { usersApi } from "@/lib/api/endpoints";

export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

export async function uploadProfilePhoto(file: File): Promise<string> {
  const signature = await usersApi.profileImageUploadSignature();
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);
  form.append("type", signature.type);
  form.append("allowed_formats", signature.allowedFormats.join(","));

  const response = await fetch(signature.uploadUrl, { method: "POST", body: form });
  const result = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message ?? `Photo upload failed (${response.status})`);
  }

  return result.secure_url;
}
