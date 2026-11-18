"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings2, ShieldCheck, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { membersApi } from "@/lib/api/endpoints";
import { signOut, useSession } from "@/lib/auth-client";
import { initialsOf } from "@/lib/format";
import { qk, useMe } from "@/lib/hooks/queries";
import { useLocale } from "@/lib/locale";

export function UserMenu({ messId }: { messId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const { data: profile } = useMe();
  const { translate: t } = useLocale();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const user = session?.user;

  const leaveMess = useMutation({
    mutationFn: () => {
      if (!messId) throw new Error("A mess must be selected before leaving");
      return membersApi.leave(messId);
    },
    onSuccess: async () => {
      if (typeof window !== "undefined" && window.localStorage.getItem("mm:lastMess") === messId) {
        window.localStorage.removeItem("mm:lastMess");
      }
      await queryClient.invalidateQueries({ queryKey: qk.myMesses });
      if (messId) {
        queryClient.removeQueries({
          predicate: (query) => query.queryKey.includes(messId),
        });
      }
      toast.success("You have left this mess");
      setLeaveOpen(false);
      router.replace("/dashboard");
      router.refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not leave this mess"),
  });

  async function handleSignOut() {
    await signOut();
    queryClient.clear();
    toast.success("Signed out");
    router.push("/sign-in");
    router.refresh();
  }

  if (isPending) {
    return <span className="size-8 animate-pulse rounded-full bg-muted" aria-hidden />;
  }

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open account menu">
            <Avatar className="size-8">
              {user.image ? <AvatarImage src={user.image} alt={user.name ?? "Profile"} /> : null}
              <AvatarFallback>{initialsOf(user.name ?? user.email ?? "?")}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{user.name ?? "Member"}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="gap-2">
              <Settings2 className="size-4" />
              Account settings
            </Link>
          </DropdownMenuItem>
          {profile?.platformRole === "ADMIN" ? (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="gap-2">
                <ShieldCheck className="size-4" />
                {t("Platform administration")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {messId ? (
            <DropdownMenuItem destructive onSelect={() => setLeaveOpen(true)} className="gap-2">
              <UserMinus className="size-4" />
              Leave this mess
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem destructive onSelect={() => void handleSignOut()} className="gap-2">
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leave this mess?</DialogTitle>
            <DialogDescription>
              Your membership will be removed, but your account will stay signed in. Your existing records will be kept.
              A mess must keep at least one active manager.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)} disabled={leaveMess.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" loading={leaveMess.isPending} onClick={() => leaveMess.mutate()}>
              Leave mess
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
