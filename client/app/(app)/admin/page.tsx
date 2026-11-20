"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, ChevronLeft, ChevronRight, Eye, LogOut, Search, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { NotFoundState } from "@/components/shared/not-found-state";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { ApiError, messageFrom } from "@/lib/api/client";
import { adminApi } from "@/lib/api/endpoints";
import { signOut } from "@/lib/auth-client";
import type { AdminMessCounts, AdminUserRow } from "@/lib/api/types";
import { useMe } from "@/lib/hooks/queries";
import { useLocale } from "@/lib/locale";
import { formatPoisha } from "@/lib/format";

type AdminTab = "users" | "messes";
type MessCountKey = keyof AdminMessCounts;

const messCountLabels: { key: MessCountKey; label: string }[] = [
  { key: "memberships", label: "Members" },
  { key: "invitations", label: "Invitations" },
  { key: "months", label: "Months" },
  { key: "groceryItems", label: "Grocery items" },
  { key: "groceryPrices", label: "Grocery prices" },
  { key: "deposits", label: "Deposits" },
  { key: "expenses", label: "Expenses" },
  { key: "bazarEntries", label: "Bazar entries" },
  { key: "duties", label: "Duties" },
  { key: "menus", label: "Menus" },
  { key: "mealRecords", label: "Meal records" },
  { key: "media", label: "Media" },
  { key: "aiExtractions", label: "AI extractions" },
  { key: "adjustments", label: "Adjustments" },
  { key: "auditLogs", label: "Audit logs" },
];

export default function AdminPage() {
  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
    error: profileErrorCause,
    refetch: refetchProfile,
  } = useMe();
  const { locale, translate: t } = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("users");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [blockUserTarget, setBlockUserTarget] = useState<AdminUserRow | null>(null);
  const [blockUserOpen, setBlockUserOpen] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserRow | null>(null);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserConfirmation, setDeleteUserConfirmation] = useState("");
  const [selectedMessId, setSelectedMessId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const isAdmin = profile?.platformRole === "ADMIN";
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.overview,
    enabled: isAdmin,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users", deferredSearch, page],
    queryFn: () => adminApi.users({ q: deferredSearch || undefined, page, pageSize: 20 }),
    enabled: isAdmin && tab === "users",
  });
  const messesQuery = useQuery({
    queryKey: ["admin", "messes", deferredSearch, page],
    queryFn: () => adminApi.messes({ q: deferredSearch || undefined, page, pageSize: 20 }),
    enabled: isAdmin && tab === "messes",
  });
  const userQuery = useQuery({
    queryKey: ["admin", "user", selectedUserId],
    queryFn: () => adminApi.user(selectedUserId!),
    enabled: isAdmin && Boolean(selectedUserId),
  });
  const messQuery = useQuery({
    queryKey: ["admin", "mess", selectedMessId],
    queryFn: () => adminApi.mess(selectedMessId!),
    enabled: isAdmin && Boolean(selectedMessId),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, platformRole }: { userId: string; platformRole: "USER" | "ADMIN" }) =>
      adminApi.updateUserRole(userId, platformRole),
    onSuccess: async () => {
      toast.success(t("Role updated"));
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      await queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: () => toast.error(t("Could not update role")),
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      adminApi.setUserBlocked(userId, blocked),
    onSuccess: async (_result, variables) => {
      toast.success(t(variables.blocked ? "User blocked" : "User unblocked"));
      setBlockUserOpen(false);
      setBlockUserTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "user"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      ]);
    },
    onError: (error) => toast.error(messageFrom(error, t("Could not update user status"))),
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => {
      if (!deleteUserTarget) throw new Error(t("Select a user to delete"));
      return adminApi.deleteUser(deleteUserTarget.id, deleteUserConfirmation.trim());
    },
    onSuccess: async (result) => {
      toast.success(
        result.storageCleanupFailures > 0
          ? t("User deleted, but some stored files could not be removed.")
          : t("User and affected messes permanently deleted"),
      );
      setSelectedUserId((current) => current === deleteUserTarget?.id ? null : current);
      setDeleteUserTarget(null);
      setDeleteUserConfirmation("");
      setDeleteUserOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "user"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "messes"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      ]);
    },
    onError: (error) => toast.error(messageFrom(error, t("Could not permanently delete user"))),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!selectedMessId || !messQuery.data) throw new Error(t("Select a mess to delete"));
      return adminApi.deleteMess(selectedMessId, confirmationName.trim());
    },
    onSuccess: async (result) => {
      if (result.storageCleanupFailures > 0) {
        toast.error(t("Mess deleted, but some stored files could not be removed."));
      } else {
        toast.success(t("Mess permanently deleted"));
      }
      setSelectedMessId(null);
      setConfirmationName("");
      setDeleteOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "messes"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
      ]);
    },
    onError: () => toast.error(t("Could not delete mess")),
  });

  const number = (value: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-GB").format(value);
  const date = (value: string | null | undefined) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
  };
  const money = (poisha: string) => {
    const formatted = formatPoisha(poisha);
    if (locale !== "bn") return formatted;
    const digits = "০১২৩৪৫৬৭৮৯";
    return formatted.replace(/[0-9]/g, (digit) => digits[Number(digit)] ?? digit);
  };

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      toast.success(t("Signed out"));
      router.replace("/");
      router.refresh();
    } catch (error) {
      setSigningOut(false);
      toast.error(error instanceof Error ? error.message : t("Could not sign out"));
    }
  }

  function changeTab(nextTab: AdminTab) {
    setTab(nextTab);
    setSearch("");
    setPage(1);
    setSelectedUserId(null);
    setSelectedMessId(null);
  }

  if (profilePending) {
    return <LoadingPage label={t("Loading admin console…")} />;
  }

  if (profileError) {
    if (profileErrorCause instanceof ApiError && profileErrorCause.isNotFound) {
      return (
        <NotFoundState
          title="Not found"
          description="The page or data you requested could not be found."
          backHref="/"
        />
      );
    }

    return (
      <AccessPage
        title={t("Could not verify platform access")}
        description={t("Reload your profile and try again.")}
        onRetry={() => void refetchProfile()}
        t={t}
      />
    );
  }

  if (!isAdmin) {
    return (
      <AccessPage
        title={t("No access")}
        description={t("You need a platform administrator account to open this page.")}
        t={t}
      />
    );
  }

  const activeListQuery = tab === "users" ? usersQuery : messesQuery;
  const meta = activeListQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const selectedMess = messQuery.data;
  const overviewCards: [string, number | undefined][] = [
    [t("Users"), overviewQuery.data?.users],
    [t("Platform admins"), overviewQuery.data?.admins],
    [t("Messes"), overviewQuery.data?.messes],
    [t("Archived messes"), overviewQuery.data?.archivedMesses],
    [t("Active memberships"), overviewQuery.data?.activeMemberships],
  ];

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <Logo className="size-7" />
          <span>Mealio</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              {t("Back to dashboard")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" disabled={signingOut} onClick={() => void handleSignOut()}>
            <LogOut className="size-4" />
            {t("Sign out")}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("Platform administration")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Manage all Mealio accounts and mess workspaces.")}</p>
          </div>
        </div>

        {overviewQuery.isPending ? (
          <LoadingInline label={t("Loading…")} />
        ) : overviewQuery.isError ? (
          <ErrorPanel
            error={overviewQuery.error}
            message={t("Could not load platform overview.")}
            onRetry={() => void overviewQuery.refetch()}
            retryLabel={t("Retry")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {overviewCards.map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold">{value === undefined ? "—" : number(value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "users" ? "default" : "outline"} onClick={() => changeTab("users")}>
            {t("Users")}
          </Button>
          <Button variant={tab === "messes" ? "default" : "outline"} onClick={() => changeTab("messes")}>
            {t("Messes")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/grocery-master">Shared grocery master</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{tab === "users" ? t("User management") : t("Mess management")}</CardTitle>
              <CardDescription>
                {tab === "users"
                  ? t("Search accounts, inspect memberships and manage platform roles.")
                  : t("Inspect mess members, financial totals and all stored records.")}
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={tab === "users" ? t("Search users by name, email or phone") : t("Search messes by name, area or owner")}
                aria-label={t("Search")}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeListQuery.isPending ? (
              <LoadingInline label={t("Loading…")} />
            ) : activeListQuery.isError ? (
              <ErrorPanel error={activeListQuery.error} message={t("Could not load this list.")} onRetry={() => void activeListQuery.refetch()} retryLabel={t("Retry")} />
            ) : tab === "users" ? (
              <div className="space-y-4">
                {(usersQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("No users found.")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px] text-left text-sm">
                      <thead className="border-b text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t("Account")}</th>
                          <th className="px-3 py-2 font-medium">{t("Phone")}</th>
                          <th className="px-3 py-2 font-medium">{t("Platform role")}</th>
                          <th className="px-3 py-2 font-medium">{t("Account status")}</th>
                          <th className="px-3 py-2 font-medium">{t("Memberships")}</th>
                          <th className="px-3 py-2 font-medium">{t("Created")}</th>
                          <th className="px-3 py-2 font-medium">{t("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {usersQuery.data?.items.map((user) => (
                          <tr key={user.id} className={selectedUserId === user.id ? "bg-muted/50" : ""}>
                            <td className="px-3 py-3">
                              <button className="text-left hover:underline" onClick={() => setSelectedUserId(user.id)}>
                                <span className="block font-medium">{user.name}</span>
                                <span className="block text-xs text-muted-foreground">{user.email}</span>
                              </button>
                            </td>
                            <td className="px-3 py-3">{user.phone || "—"}</td>
                            <td className="px-3 py-3">{t(user.platformRole === "ADMIN" ? "Admin" : "User")}</td>
                            <td className="px-3 py-3">
                              <span className={user.blockedAt ? "text-destructive" : "text-muted-foreground"}>
                                {t(user.blockedAt ? "Blocked" : "Active")}
                              </span>
                            </td>
                            <td className="px-3 py-3">{number(user._count.memberships)}</td>
                            <td className="px-3 py-3">{date(user.createdAt)}</td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={roleMutation.isPending || user.id === profile.id}
                                  onClick={() =>
                                    roleMutation.mutate({
                                      userId: user.id,
                                      platformRole: user.platformRole === "ADMIN" ? "USER" : "ADMIN",
                                    })
                                  }
                                >
                                  {t(user.platformRole === "ADMIN" ? "Remove admin" : "Make admin")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={user.blockedAt ? "outline" : "destructive"}
                                  disabled={blockUserMutation.isPending || user.id === profile.id}
                                  onClick={() => {
                                    setBlockUserTarget(user);
                                    setBlockUserOpen(true);
                                  }}
                                >
                                  <Ban className="size-4" />
                                  {t(user.blockedAt ? "Unblock" : "Block")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deleteUserMutation.isPending || user.id === profile.id}
                                  onClick={() => {
                                    setDeleteUserTarget(user);
                                    setDeleteUserConfirmation("");
                                    setDeleteUserOpen(true);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  {t("Delete permanently")}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {selectedUserId && userQuery.isPending ? (
                  <LoadingInline label={t("Loading account details…")} />
                ) : userQuery.data ? (
                  <Card className="bg-muted/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{t("Account details")}: {userQuery.data.name}</CardTitle>
                      <CardDescription>{userQuery.data.email}{userQuery.data.phone ? ` · ${userQuery.data.phone}` : ""}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm">{t("Created messes")}: {number(userQuery.data._count.createdMesses)}</p>
                      <p className="text-sm">{t("Account status")}: {t(userQuery.data.blockedAt ? "Blocked" : "Active")}</p>
                      <p className="text-sm font-medium">{t("Memberships")}</p>
                      {userQuery.data.memberships.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("No memberships found.")}</p>
                      ) : (
                        <ul className="divide-y rounded-lg border">
                          {userQuery.data.memberships.map((membership) => (
                            <li key={membership.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                              <span>{membership.mess.name}{membership.mess.area ? ` · ${membership.mess.area}` : ""}</span>
                              <span className="text-xs text-muted-foreground">
                                {t(membership.role === "MANAGER" ? "Manager" : "Member")} · {t(membership.status)} · {date(membership.joinedAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ) : selectedUserId && userQuery.isError ? (
                  <ErrorPanel error={userQuery.error} message={t("Could not load account details.")} onRetry={() => void userQuery.refetch()} retryLabel={t("Retry")} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t("Select an account to see memberships.")}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {(messesQuery.data?.items.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{t("No messes found.")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[660px] text-left text-sm">
                      <thead className="border-b text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t("Mess")}</th>
                          <th className="px-3 py-2 font-medium">{t("Owner")}</th>
                          <th className="px-3 py-2 font-medium">{t("Members")}</th>
                          <th className="px-3 py-2 font-medium">{t("Status")}</th>
                          <th className="px-3 py-2 font-medium">{t("Created")}</th>
                          <th className="px-3 py-2 font-medium">{t("Actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {messesQuery.data?.items.map((mess) => (
                          <tr key={mess.id} className={selectedMessId === mess.id ? "bg-muted/50" : ""}>
                            <td className="px-3 py-3">
                              <button
                                className="text-left hover:underline"
                                aria-label={`${t("View mess details")}: ${mess.name}`}
                                onClick={() => setSelectedMessId(mess.id)}
                              >
                                <span className="block font-medium">{mess.name}</span>
                                <span className="block text-xs text-muted-foreground">{mess.area || t("No area specified")}</span>
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <span className="block">{mess.createdBy.name}</span>
                              <span className="text-xs text-muted-foreground">{mess.createdBy.email}</span>
                            </td>
                            <td className="px-3 py-3">{number(mess._count.memberships)}</td>
                            <td className="px-3 py-3">{t(mess.archivedAt ? "Archived" : "Active")}</td>
                            <td className="px-3 py-3">{date(mess.createdAt)}</td>
                            <td className="px-3 py-3">
                              <Button size="sm" variant="outline" onClick={() => setSelectedMessId(mess.id)}>
                                <Eye className="size-4" />
                                {t("View details")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Dialog
                  open={Boolean(selectedMessId)}
                  onOpenChange={(open) => {
                    if (!open && !deleteOpen) setSelectedMessId(null);
                  }}
                >
                  <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader className="sr-only">
                      <DialogTitle>{t("Mess details")}</DialogTitle>
                      <DialogDescription>{t("View all information about this mess.")}</DialogDescription>
                    </DialogHeader>
                    {selectedMessId && messQuery.isPending ? (
                      <LoadingInline label={t("Loading mess details…")} />
                    ) : selectedMess ? (
                  <Card className="border-destructive/30">
                    <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-base">{t("Mess details")}: {selectedMess.name}</CardTitle>
                        <CardDescription>
                          {selectedMess.createdBy.name} · {selectedMess.createdBy.email}
                          {selectedMess.area ? ` · ${selectedMess.area}` : ""}
                        </CardDescription>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="size-4" />
                        {t("Delete mess")}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <p>{t("Address")}: {selectedMess.address || "—"}</p>
                        <p>{t("Created")}: {date(selectedMess.createdAt)}</p>
                        <p>{t("Status")}: {t(selectedMess.archived ? "Archived" : "Active")}</p>
                        <p>{t("Timezone")}: {selectedMess.timezone}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <SummaryTile label={t("Total deposits")} value={money(selectedMess.totals.depositsPoisha)} />
                        <SummaryTile label={t("Total expenses")} value={money(selectedMess.totals.expensesPoisha)} />
                        <SummaryTile label={t("Bazar total")} value={money(selectedMess.totals.bazarPoisha)} />
                      </div>
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">{t("Stored records")}</h3>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {messCountLabels.map(({ key, label }) => (
                            <div key={key} className="flex justify-between rounded-md border bg-background px-3 py-2 text-sm">
                              <span className="text-muted-foreground">{t(label)}</span>
                              <span className="font-medium">{number(selectedMess._count[key])}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">{t("Members")}</h3>
                        {selectedMess.memberships.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("No members yet.")}</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[580px] text-left text-sm">
                              <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2 font-medium">{t("Name")}</th>
                                  <th className="px-3 py-2 font-medium">{t("Email")}</th>
                                  <th className="px-3 py-2 font-medium">{t("Mess role")}</th>
                                  <th className="px-3 py-2 font-medium">{t("Status")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {selectedMess.memberships.map((membership) => (
                                  <tr key={membership.id}>
                                    <td className="px-3 py-2">{membership.user.name}</td>
                                    <td className="px-3 py-2">{membership.user.email}</td>
                                    <td className="px-3 py-2">{t(membership.role === "MANAGER" ? "Manager" : "Member")}</td>
                                    <td className="px-3 py-2">{t(membership.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                      <section className="space-y-2">
                        <h3 className="text-sm font-semibold">{t("Monthly records")}</h3>
                        {selectedMess.months.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("No months found.")}</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedMess.months.map((month) => (
                              <div key={month.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                                <span className="font-medium">{number(month.month)}/{number(month.year)} · {t(month.status)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {t("Meals")}: {number(month._count.mealRecords)} · {t("Expenses")}: {number(month._count.expenses)} · {t("Deposits")}: {number(month._count.deposits)} · {t("Bazar entries")}: {number(month._count.bazarEntries)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </CardContent>
                  </Card>
                    ) : selectedMessId && messQuery.isError ? (
                      <ErrorPanel error={messQuery.error} message={t("Could not load mess details.")} onRetry={() => void messQuery.refetch()} retryLabel={t("Retry")} />
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("Select a mess to inspect its data.")}</p>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {meta ? (
              <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                <span>{t("Page")} {number(meta.page)} {t("of")} {number(meta.totalPages)} · {number(meta.total)} {t("results")}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    <ChevronLeft className="size-4" />
                    {t("Previous")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                    {t("Next")}
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={blockUserOpen}
        onOpenChange={(open) => {
          setBlockUserOpen(open);
          if (!open) setBlockUserTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t(blockUserTarget?.blockedAt ? "Unblock this user?" : "Block this user?")}</DialogTitle>
            <DialogDescription>
              {blockUserTarget?.blockedAt
                ? t("Unblocking restores access the next time this user signs in.")
                : t("Blocking immediately revokes current sessions and prevents this user from using the app until unblocked.")}
              {blockUserTarget ? <strong className="mt-2 block text-foreground">{blockUserTarget.name} · {blockUserTarget.email}</strong> : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={blockUserMutation.isPending} onClick={() => setBlockUserOpen(false)}>{t("Cancel")}</Button>
            <Button
              variant={blockUserTarget?.blockedAt ? "default" : "destructive"}
              loading={blockUserMutation.isPending}
              disabled={!blockUserTarget}
              onClick={() => {
                if (!blockUserTarget) return;
                blockUserMutation.mutate({
                  userId: blockUserTarget.id,
                  blocked: !blockUserTarget.blockedAt,
                });
              }}
            >
              {t(blockUserTarget?.blockedAt ? "Unblock user" : "Block user")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteUserOpen}
        onOpenChange={(open) => {
          setDeleteUserOpen(open);
          if (!open) {
            setDeleteUserConfirmation("");
            setDeleteUserTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Permanently delete this user?")}</DialogTitle>
            <DialogDescription>
              {t("This permanently deletes the account, credentials, sessions, and every mess the user owns or belongs to, including all records and other members' data in those messes. This cannot be undone.")}
              {deleteUserTarget ? <strong className="mt-2 block text-foreground">{deleteUserTarget.name} · {deleteUserTarget.email}</strong> : null}
              <span className="mt-2 block">{t("Enter the exact email address to confirm.")}</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteUserConfirmation}
            onChange={(event) => setDeleteUserConfirmation(event.target.value)}
            placeholder={t("Type the user's email")}
            aria-label={t("Type the user's email")}
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" disabled={deleteUserMutation.isPending} onClick={() => setDeleteUserOpen(false)}>{t("Cancel")}</Button>
            <Button
              variant="destructive"
              loading={deleteUserMutation.isPending}
              disabled={!deleteUserTarget || deleteUserConfirmation.trim() !== deleteUserTarget.email}
              onClick={() => deleteUserMutation.mutate()}
            >
              {t("Delete permanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmationName("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Permanently delete this mess?")}</DialogTitle>
            <DialogDescription>
              {t("This permanently removes the mess and all of its database records. This action cannot be undone.")}
              {selectedMess ? <strong className="mt-2 block text-foreground">{selectedMess.name}</strong> : null}
              <span className="mt-2 block">{t("Enter the exact mess name to confirm.")}</span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            placeholder={t("Type the mess name")}
            aria-label={t("Type the mess name")}
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setDeleteOpen(false)}>{t("Cancel")}</Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              disabled={!selectedMess || confirmationName.trim() !== selectedMess.name}
              onClick={() => deleteMutation.mutate()}
            >
              {t("Delete mess")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingPage({ label }: { label: string }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><LoadingAnimation label={label} /><span>{label}</span></div>;
}

function LoadingInline({ label }: { label: string }) {
  return <div className="flex flex-col items-center justify-center gap-1 py-6 text-sm text-muted-foreground"><LoadingAnimation label={label} size="small" /><span>{label}</span></div>;
}

function ErrorPanel({
  error,
  message,
  onRetry,
  retryLabel,
}: {
  error: unknown;
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  if (error instanceof ApiError && error.isNotFound) {
    return (
      <NotFoundState
        title="Not found"
        description="The page or data you requested could not be found."
        backHref="/dashboard"
        backLabel="Back to dashboard"
        compact
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>{retryLabel}</Button>
    </div>
  );
}

function AccessPage({
  title,
  description,
  onRetry,
  t,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
  t: (text: string) => string;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <Logo className="size-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? <Button variant="outline" onClick={onRetry}>{t("Retry")}</Button> : null}
      <Button asChild variant="ghost"><Link href="/dashboard">{t("Back to dashboard")}</Link></Button>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
