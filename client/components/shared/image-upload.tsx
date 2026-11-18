"use client";

import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { mediaApi } from "@/lib/api/endpoints";
import type { MediaAsset, MediaKind } from "@/lib/api/types";

const ACCEPT = "image/png,image/jpeg,image/webp,image/heic,application/pdf";

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  bytes: number;
  width?: number;
  height?: number;
  format: string;
  error?: { message: string };
}

/**
 * Uploads one file straight to Cloudinary using a server-issued signature, then
 * registers the asset with the API. The bytes never pass through our server, so
 * the API has no multipart handler (multer) — it only signs and records.
 */
async function uploadToCloudinary(
  messId: string,
  kind: MediaKind,
  file: File,
  onProgress: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const signature = await mediaApi.sign(messId, kind);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);
  form.append("access_mode", "authenticated");
  form.append("allowed_formats", signature.allowedFormats.join(","));

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", signature.uploadUrl);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let payload: CloudinaryUploadResult;
      try {
        payload = JSON.parse(request.responseText) as CloudinaryUploadResult;
      } catch {
        reject(new Error("Unexpected response from the image host"));
        return;
      }
      if (request.status >= 200 && request.status < 300 && payload.public_id) resolve(payload);
      else reject(new Error(payload.error?.message ?? `Upload failed (${request.status})`));
    };
    request.onerror = () => reject(new Error("Could not reach the image host"));
    request.send(form);
  });
}

export function ImageUpload({
  messId,
  kind = "BAZAR_PHOTO",
  bazarEntryId,
  label = "Upload photo",
  onUploaded,
  disabled,
}: {
  messId: string;
  kind?: MediaKind;
  bazarEntryId?: string;
  label?: string;
  onUploaded?: (media: MediaAsset) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setProgress(0);
    try {
      const uploaded = await uploadToCloudinary(messId, kind, file, setProgress);
      const media = await mediaApi.confirm(messId, {
        publicId: uploaded.public_id,
        kind,
        bazarEntryId: bazarEntryId ?? null,
        secureUrl: uploaded.secure_url,
        bytes: uploaded.bytes,
        mimeType: file.type || undefined,
        width: uploaded.width,
        height: uploaded.height,
        resourceType: "image",
      });
      toast.success("Photo uploaded");
      onUploaded?.(media);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? null : <ImageUp />}
        {uploading ? `Uploading ${progress}%` : label}
      </Button>
    </>
  );
}
