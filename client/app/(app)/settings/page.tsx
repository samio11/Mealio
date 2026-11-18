"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { messageFrom } from "@/lib/api/client";
import { usersApi } from "@/lib/api/endpoints";
import { signOut } from "@/lib/auth-client";
import { qk, useMe } from "@/lib/hooks/queries";
import { useLocale } from "@/lib/locale";
import { useQueryClient } from "@tanstack/react-query";

/** Bangladesh mobile numbers, normalised to +8801XXXXXXXXX. */
const BD_PHONE = /^(?:\+?880|0)1[3-9]\d{8}$/;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80, "Keep it under 80 characters."),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || BD_PHONE.test(value.replace(/[\s-]/g, "")), {
      message: "Use a valid Bangladeshi number, e.g. +8801712345678.",
    }),
  locale: z.enum(["bn", "en"]),
  image: z.string().trim().url("Enter a valid image URL.").or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      await usersApi.updateMe({
        name: values.name,
        phone: values.phone ? values.phone.replace(/[\s-]/g, "") : null,
        locale: values.locale,
        image: values.image || null,
      });
      await queryClient.invalidateQueries({ queryKey: qk.me });
      setLocale(values.locale);
      toast.success("Profile updated");
      form.reset(values);
    } catch (submitError) {
      toast.error(messageFrom(submitError, "Could not update your profile"));
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
      <PageHeader title="Account settings" description="Your name, contact number and interface language." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your phone number is only visible to mess managers you share a mess with.
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
              <Label htmlFor="image">Profile image URL (optional)</Label>
              <Input id="image" placeholder="https://…" {...form.register("image")} />
              {form.formState.errors.image ? (
                <p className="text-sm text-destructive">{form.formState.errors.image.message}</p>
              ) : null}
            </div>

            <Button type="submit" loading={form.formState.isSubmitting}>
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
