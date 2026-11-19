"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ImagePlus, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { messageFrom } from "@/lib/api/client";
import { usersApi } from "@/lib/api/endpoints";
import { signOut } from "@/lib/auth-client";
import { isBangladeshPhone, normalizeBangladeshPhone } from "@/lib/bangladesh-phone";
import { initialsOf } from "@/lib/format";
import { qk, useMe } from "@/lib/hooks/queries";
import { useLocale } from "@/lib/locale";
import { MAX_PROFILE_PHOTO_BYTES, PROFILE_PHOTO_TYPES, uploadProfilePhoto } from "@/lib/profile-photo";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80, "Keep it under 80 characters."),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || isBangladeshPhone(value), {
      message: "Use a valid Bangladeshi number, e.g. +8801712345678.",
    }),
  locale: z.enum(["bn", "en"]),
  image: z.string().trim().url("Enter a valid image URL.").or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { setLocale, translate: t } = useLocale();
  const { data: me, isPending, isError, error, refetch } = useMe();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "", locale: "bn", image: "" },
  });

  useEffect(() => {
    if (!me) return;
    setLocale(me.locale === "en" ? "en" : "bn");
    form.reset({
      name: me.name,
      phone: me.phone ?? "",
      locale: me.locale === "en" ? "en" : "bn",
      image: me.image ?? "",
    });
  }, [me, form, setLocale]);

  async function onSubmit(values: ProfileValues) {
    try {
      const updatedProfile = await usersApi.updateMe({
        name: values.name,
        phone: values.phone ? normalizeBangladeshPhone(values.phone) : null,
        locale: values.locale,
        image: values.image || null,
      });
      queryClient.setQueryData(qk.me, updatedProfile);
      await queryClient.invalidateQueries({ queryKey: qk.me });
      setLocale(values.locale);
      toast.success("Profile updated");
      form.reset(values);
    } catch (submitError) {
      toast.error(messageFrom(submitError, "Could not update your profile"));
    }
  }

  async function onPhotoSelected(file: File | undefined) {
    if (!file) return;
    if (!PROFILE_PHOTO_TYPES.some((type) => type === file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      if (photoInput.current) photoInput.current.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      toast.error("Choose an image smaller than 5 MB.");
      if (photoInput.current) photoInput.current.value = "";
      return;
    }

    setUploadingPhoto(true);
    try {
      const image = await uploadProfilePhoto(file);
      form.setValue("image", image, { shouldDirty: true, shouldValidate: true });
      toast.success("Photo uploaded. Save changes to apply it.");
    } catch (uploadError) {
      toast.error(messageFrom(uploadError, "Could not update your profile photo"));
    } finally {
      setUploadingPhoto(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <LoadingAnimation label="Loading your profile…" size="small" />
        <span>{t("Loading your profile…")}</span>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        title="Account settings"
        description="Your name, contact number and interface language."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard"><ArrowLeft /> Back to dashboard</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Mess managers and members can use your Bangladeshi mobile number to contact you on WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name ? (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={me?.email ?? ""} readOnly disabled />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <Input id="phone" placeholder="+8801712345678" autoComplete="tel" {...form.register("phone")} />
                {form.formState.errors.phone ? (
                  <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={form.watch("locale")}
                  onValueChange={(value) => {
                    if (value !== "bn" && value !== "en") return;
                    form.setValue("locale", value, { shouldDirty: true });
                    setLocale(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bn">Bangla</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-photo">Profile photo</Label>
              <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
                <Avatar className="size-16">
                  {form.watch("image") ? <AvatarImage src={form.watch("image")} alt={`${me?.name ?? "Your"} profile photo`} /> : null}
                  <AvatarFallback><UserRound className="size-7" /></AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <input
                    ref={photoInput}
                    id="profile-photo"
                    type="file"
                    accept={PROFILE_PHOTO_TYPES.join(",")}
                    className="sr-only"
                    onChange={(event) => void onPhotoSelected(event.currentTarget.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingPhoto}
                    loading={uploadingPhoto}
                    onClick={() => photoInput.current?.click()}
                  >
                    {uploadingPhoto ? null : <ImagePlus />}
                    {uploadingPhoto ? "Uploading photo…" : "Upload or change photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, or WebP, up to 5 MB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Profile photo URL (optional)</Label>
              <Input id="image" placeholder="https://…" {...form.register("image")} />
              {form.formState.errors.image ? (
                <p className="text-sm text-destructive">{form.formState.errors.image.message}</p>
              ) : null}
            </div>

            <Button type="submit" loading={form.formState.isSubmitting} disabled={uploadingPhoto}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              queryClient.clear();
              router.push("/sign-in");
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
