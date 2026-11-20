"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, ExternalLink, LogOut, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { messageFrom } from "@/lib/api/client";
import { invitationsApi, messesApi } from "@/lib/api/endpoints";
import { signOut } from "@/lib/auth-client";
import { useMyMesses, qk } from "@/lib/hooks/queries";

const createMessSchema = z.object({
  name: z.string().trim().min(2, "Give your mess a name (at least 2 characters).").max(80, "Keep it under 80 characters."),
  area: z.string().trim().max(80, "Keep it under 80 characters.").optional(),
  address: z.string().trim().max(240, "Keep it under 240 characters.").optional(),
});

type CreateMessValues = z.infer<typeof createMessSchema>;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: messes, isPending, isError, error, refetch } = useMyMesses();
  const invitationCodeFromUrl = searchParams.get("invitationCode") ?? "";
  const joinOnly = searchParams.get("mode") === "join";
  const [invitationCode, setInvitationCode] = useState(invitationCodeFromUrl);

  useEffect(() => {
    if (invitationCodeFromUrl) setInvitationCode(invitationCodeFromUrl);
  }, [invitationCodeFromUrl]);

  const joinInvitation = useMutation({
    mutationFn: (code: string) => invitationsApi.accept(code),
    onSuccess: async (invitation) => {
      await queryClient.invalidateQueries({ queryKey: qk.myMesses });
      toast.success(`You have joined ${invitation.messName}`);
      router.push(`/m/${invitation.messId}/dashboard`);
    },
    onError: (joinError) => toast.error(messageFrom(joinError, "Could not join with this invitation code")),
  });

  const form = useForm<CreateMessValues>({
    resolver: zodResolver(createMessSchema),
    defaultValues: { name: "", area: "", address: "" },
  });

  async function onSubmit(values: CreateMessValues) {
    try {
      const mess = await messesApi.create({
        name: values.name,
        area: values.area || undefined,
        address: values.address || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: qk.myMesses });
      toast.success(`${mess.name} created — you are its manager`);
      router.push(`/m/${mess.id}/dashboard`);
    } catch (submitError) {
      toast.error(messageFrom(submitError, "Could not create the mess"));
    }
  }

  /** Members who were invited never have to create anything — they can simply leave. */
  async function handleSignOut() {
    await signOut();
    queryClient.clear();
    router.push("/sign-in");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <PageHeader
        title={joinOnly ? "Enter your invitation code" : "Join a mess or create your own"}
        description={
          joinOnly
            ? "Paste the code from your invitation email to join the mess."
            : "Joining is the normal path: the manager of your mess invites you and you accept. Creating a mess is only for residents who want to run one themselves. You belong to as many messes as you like."
        }
        actions={
          <>
            {joinOnly ? (
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  <ArrowLeft />
                  Back
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void handleSignOut()}>
              <LogOut />
              Sign out
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{joinOnly ? "Invitation code" : "Join with an invitation code"}</CardTitle>
          <CardDescription>
            {joinOnly
              ? "Use the account that received the invitation."
              : "Paste the code sent to your invited email address. You must be signed in with that account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!joinOnly ? (
            <p className="text-sm text-muted-foreground">
              No code yet? Wait for the invitation email and open the link inside it — you do not have to do anything on this page.
            </p>
          ) : null}
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const code = invitationCode.trim();
              if (code) joinInvitation.mutate(code);
            }}
          >
            <Input
              aria-label="Invitation code"
              autoComplete="off"
              autoFocus={joinOnly && !invitationCodeFromUrl}
              value={invitationCode}
              onChange={(event) => setInvitationCode(event.target.value)}
              placeholder="Paste your invitation code"
              className="font-mono"
            />
            <Button type="submit" loading={joinInvitation.isPending} disabled={!invitationCode.trim()}>
              <UserPlus />
              Join mess
            </Button>
          </form>
        </CardContent>
      </Card>

      {!joinOnly ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Create a new mess (optional)</CardTitle>
              <CardDescription>You become the first manager and can invite the other residents afterwards.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Mess name</Label>
                  <Input id="name" placeholder="e.g. Sunrise Students Mess" autoComplete="off" {...form.register("name")} />
                  {form.formState.errors.name ? (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="area">Area (optional)</Label>
                    <Input id="area" placeholder="e.g. Mirpur 10" autoComplete="off" {...form.register("area")} />
                    {form.formState.errors.area ? (
                      <p className="text-sm text-destructive">{form.formState.errors.area.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address (optional)</Label>
                    <Input id="address" placeholder="House / road / block" autoComplete="off" {...form.register("address")} />
                    {form.formState.errors.address ? (
                      <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
                    ) : null}
                  </div>
                </div>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Plus />
                  Create mess
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your messes</CardTitle>
              <CardDescription>Jump back into a mess, or accept an invitation from your email.</CardDescription>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingAnimation label="Loading…" size="small" />
                  <span>Loading…</span>
                </div>
              ) : isError ? (
                <ErrorState error={error} onRetry={() => void refetch()} compact />
              ) : (messes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have not joined any mess yet. If you are waiting to be invited, nothing is needed here — your mess
                  will appear as soon as you accept the invitation from your email.
                </p>
              ) : (
                <ul className="divide-y">
                  {(messes ?? []).map((mess) => (
                    <li key={mess.messId} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Building2 className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{mess.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{mess.area ?? "No area set"}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={mess.status} />
                        {mess.status === "ACTIVE" ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/m/${mess.messId}/dashboard`}>
                              Open
                              <ExternalLink />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl py-6">
          <LoadingAnimation label="Loading invitation form…" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
