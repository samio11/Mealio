"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi } from "@/lib/api/endpoints";
import { signUp } from "@/lib/auth-client";
import { isBangladeshPhone, normalizeBangladeshPhone } from "@/lib/bangladesh-phone";
import { MAX_PROFILE_PHOTO_BYTES, PROFILE_PHOTO_TYPES, uploadProfilePhoto } from "@/lib/profile-photo";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
  email: z.string().trim().min(1, "Enter your email.").email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || isBangladeshPhone(value), {
      message: "Use a valid Bangladeshi number, e.g. 01712345678.",
    }),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Keep your password under 128 characters."),
});

type Values = z.infer<typeof schema>;

export default function SignUpPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photo]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    const { error } = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
      // `phone` is a Better-Auth additional field on the user record.
      phone: values.phone ? normalizeBangladeshPhone(values.phone) : undefined,
      locale: "bn",
    } as Parameters<typeof signUp.email>[0]);

    if (error) {
      setFormError(error.message ?? "Could not create your account.");
      return;
    }

    let photoUploadError: unknown;
    if (photo) {
      try {
        const image = await uploadProfilePhoto(photo);
        await usersApi.updateMe({ image });
      } catch (error) {
        photoUploadError = error;
      }
    }

    queryClient.clear();
    if (photoUploadError) {
      const message =
        photoUploadError instanceof Error ? photoUploadError.message : "Could not upload your profile photo.";
      toast.error(`Account created, but the photo could not be uploaded: ${message}`);
    } else {
      toast.success("Account created — welcome");
    }
    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const nextPath =
      requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/onboarding";
    router.push(nextPath);
    router.refresh();
  }

  return (
    <AuthPageLayout imageSrc="/register.png" imageAlt="Illustration for creating a Mealio account">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Set up your profile to organize your mess or join one you were invited to.</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="profile-photo">Profile photo <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="flex items-center gap-4 rounded-xl border border-dashed bg-muted/20 p-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                {photoPreview ? (
                  // A blob URL preview is local and is not optimized by Next Image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Selected profile photo" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-7" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  id="profile-photo"
                  type="file"
                  accept={PROFILE_PHOTO_TYPES.join(",")}
                  className="peer sr-only"
                  aria-describedby={photoError ? "profile-photo-error" : "profile-photo-hint"}
                  onChange={(event) => {
                    const selected = event.currentTarget.files?.[0] ?? null;
                    if (!selected) return;
                    if (!PROFILE_PHOTO_TYPES.some((type) => type === selected.type)) {
                      setPhoto(null);
                      setPhotoError("Choose a JPG, PNG, or WebP image.");
                      event.currentTarget.value = "";
                      return;
                    }
                    if (selected.size > MAX_PROFILE_PHOTO_BYTES) {
                      setPhoto(null);
                      setPhotoError("Choose an image smaller than 5 MB.");
                      event.currentTarget.value = "";
                      return;
                    }
                    setPhotoError(null);
                    setPhoto(selected);
                  }}
                />
                <label
                  htmlFor="profile-photo"
                  className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                >
                  <ImagePlus className="size-4" aria-hidden="true" />
                  {photo ? "Choose another photo" : "Upload a photo"}
                </label>
                <p id="profile-photo-hint" className="mt-1.5 text-xs text-muted-foreground">
                  JPG, PNG, or WebP, up to 5 MB.
                </p>
                {photoError ? <p id="profile-photo-error" className="mt-1.5 text-xs text-destructive">{photoError}</p> : null}
              </div>
              {photo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove profile photo"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoError(null);
                  }}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" autoComplete="name" placeholder="e.g. Rahim Uddin" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number (optional)</Label>
            <Input id="phone" autoComplete="tel" placeholder="01712345678" {...form.register("phone")} />
            {form.formState.errors.phone ? (
              <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mess managers and members can see it for WhatsApp contact.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            )}
          </div>

          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Create account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
      </form>
    </AuthPageLayout>
  );
}
