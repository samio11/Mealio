"use client";

import { Mail, Phone, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { Separator } from "@/components/ui/separator";
import { messageFrom } from "@/lib/api/client";
import { invitationsApi } from "@/lib/api/endpoints";
import { useSession } from "@/lib/auth-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/format";

/**
 * Public invitation landing page. The preview can be read by anyone with the
 * link, but accepting requires signing in as the invited account.
 */
export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const [accepting, setAccepting] = useState(false);

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => invitationsApi.preview(token),
    enabled: Boolean(token),
    retry: false,
  });

  async function accept() {
    setAccepting(true);
    try {
      const result = await invitationsApi.accept(token);
      toast.success("You have joined the mess");
      router.push(`/m/${result.messId}/dashboard`);
    } catch (error) {
      toast.error(messageFrom(error, "Could not accept this invitation"));
    } finally {
      setAccepting(false);
    }
  }

  const signInHref = `/sign-in?next=${encodeURIComponent(`/invitations/${token}`)}`;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-lg space-y-4">
        <Link href="/" className="flex items-center justify-center gap-2">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">Mealio</span>
        </Link>

        {preview.isPending ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 pt-6 text-sm text-muted-foreground">
              <LoadingAnimation label="Checking your invitation…" size="small" />
              <span>Checking your invitation…</span>
            </CardContent>
          </Card>
        ) : preview.isError ? (
          <Card>
            <CardContent className="pt-6">
              <ErrorState
                error={preview.error}
                title="Invitation unavailable"
                onRetry={() => void preview.refetch()}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">You have been invited</CardTitle>
              <CardDescription>
                {preview.data.invitedByName
                  ? `${preview.data.invitedByName} invited you to join`
                  : "You have been invited to join"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-base font-semibold">{preview.data.messName}</p>
                <p className="text-sm text-muted-foreground">{preview.data.area ?? "Area not set"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    Role <StatusBadge status={preview.data.role} />
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>Expires {formatDateTime(preview.data.expiresAt)}</span>
                </div>
              </div>

              <dl className="space-y-2 text-sm">
                {preview.data.email ? (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="ml-auto font-medium">{preview.data.email}</dd>
                  </div>
                ) : null}
                {preview.data.phone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="ml-auto font-medium">{preview.data.phone}</dd>
                  </div>
                ) : null}
              </dl>

              {preview.data.alreadyMember ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This account is already an active member of this mess.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/m/${preview.data.messId}/dashboard`}>Open the mess</Link>
                  </Button>
                </div>
              ) : !session ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {sessionPending ? (
                      <span className="flex items-center gap-2">
                        <LoadingAnimation label="Checking your session…" size="small" />
                        Checking your session…
                      </span>
                    ) : (
                      "Sign in (or create an account) with the invited email or phone to accept."
                    )}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1">
                      <Link href={signInHref}>Sign in to accept</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href="/sign-up">Create an account</Link>
                    </Button>
                  </div>
                </div>
              ) : preview.data.canAccept ? (
                <Button className="w-full" loading={accepting} onClick={() => void accept()}>
                  <UserPlus />
                  Accept invitation
                </Button>
              ) : (
                <p className="text-sm text-destructive">
                  This invitation is no longer valid. Ask a manager to send a new one.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
