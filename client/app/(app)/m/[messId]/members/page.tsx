"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Mail, Plus, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invitationsApi, membersApi } from "@/lib/api/endpoints";
import type { MessRole } from "@/lib/api/types";
import { formatDate, humanize, initialsOf } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";

export default function MembersPage() {
  const { messId } = useParams<{ messId: string }>();
  const { member: me, isManager } = useMyMembership(messId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description="Who is in this mess, their role, and who has been invited."
      />
      {isManager ? (
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MembersTab messId={messId} meId={me?.id} isManager={Boolean(isManager)} />
          </TabsContent>
          <TabsContent value="invitations">
            <InvitationsTab messId={messId} />
          </TabsContent>
        </Tabs>
      ) : (
        <MembersTab messId={messId} meId={me?.id} isManager={false} />
      )}
    </div>
  );
}

function MembersTab({ messId, meId, isManager }: { messId: string; meId?: string; isManager: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [includeRemoved, setIncludeRemoved] = useState(false);

  const filters = { search, includeRemoved };
  const members = useQuery({
    queryKey: qk.members(messId, filters),
    queryFn: () => membersApi.list(messId, { search: search || undefined, includeRemoved, pageSize: 100 }),
  });

  const update = useMutation({
    mutationFn: ({ memberId, body }: { memberId: string; body: Parameters<typeof membersApi.update>[2] }) =>
      membersApi.update(messId, memberId, body),
    onSuccess: () => {
      toast.success("Member updated");
      void queryClient.invalidateQueries({ queryKey: ["members", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the member"),
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => membersApi.remove(messId, memberId),
    onSuccess: () => {
      toast.success("Member removed");
      void queryClient.invalidateQueries({ queryKey: ["members", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove the member"),
  });

  const items = members.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Member list</CardTitle>
          <CardDescription>Roles and duty eligibility can be changed by a manager.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="include-removed" checked={includeRemoved} onCheckedChange={setIncludeRemoved} />
            <Label htmlFor="include-removed">Include removed</Label>
          </div>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or phone" className="w-48" />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {members.isPending ? (
          <div className="px-5">
            <TableSkeleton columns={5} rows={6} />
          </div>
        ) : members.isError ? (
          <div className="px-5">
            <ErrorState error={members.error} onRetry={() => void members.refetch()} compact />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5">
            <EmptyState icon={Users} title="No members found" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duty</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const isMe = row.id === meId;
                return (
                  <TableRow key={row.id} className={isMe ? "bg-primary/5" : undefined}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {row.image ? <AvatarImage src={row.image} alt={row.name} /> : null}
                          <AvatarFallback>{initialsOf(row.displayName ?? row.name)}</AvatarFallback>
                        </Avatar>
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2 font-medium">
                            {row.displayName ?? row.name}
                            {isMe ? <Badge variant="secondary">You</Badge> : null}
                          </span>
                          <span className="text-xs text-muted-foreground">{row.email}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {isManager && !isMe ? (
                        <Select
                          value={row.role}
                          onValueChange={(value) => update.mutate({ memberId: row.id, body: { role: value as MessRole } })}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge status={row.role} />
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isDutyEligible}
                        disabled={!isManager}
                        onCheckedChange={(value) => update.mutate({ memberId: row.id, body: { isDutyEligible: value } })}
                        aria-label="Duty eligible"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.joinedAt.slice(0, 10))}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isManager && !isMe && row.status !== "REMOVED" ? (
                          <ConfirmDialog
                            trigger={
                              <Button size="icon-sm" variant="ghost" aria-label="Remove member">
                                <UserMinus />
                              </Button>
                            }
                            title={`Remove ${row.displayName ?? row.name}?`}
                            description="They lose access to this mess. Their historical records are kept for the report."
                            confirmLabel="Remove"
                            variant="destructive"
                            pending={remove.isPending}
                            onConfirm={() => remove.mutate(row.id)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InvitationsTab({ messId }: { messId: string }) {
  const queryClient = useQueryClient();
  const invitations = useQuery({
    queryKey: qk.invitations(messId),
    queryFn: () => invitationsApi.list(messId),
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => invitationsApi.revoke(messId, invitationId),
    onSuccess: () => {
      toast.success("Invitation revoked");
      void queryClient.invalidateQueries({ queryKey: qk.invitations(messId) });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not revoke"),
  });

  const items = invitations.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>Invite people by email or phone. Email invitations include a link and a code valid until expiry.</CardDescription>
        </div>
        <InviteDialog messId={messId} />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {invitations.isPending ? (
          <div className="px-5">
            <TableSkeleton columns={4} rows={4} />
          </div>
        ) : invitations.isError ? (
          <div className="px-5">
            <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} compact />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5">
            <EmptyState
              icon={UserPlus}
              title="No invitations yet"
              description="Invite a flatmate by email or phone number to let them join."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invitee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Mail className="size-3.5 text-muted-foreground" />
                      {invitation.email ?? invitation.phone ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invitation.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invitation.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(invitation.expiresAt.slice(0, 10))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {invitation.inviteUrl && invitation.status === "PENDING" ? (
                        <Button
                          size="icon-sm"
                          variant="outline"
                          aria-label="Copy invite link"
                          onClick={() => {
                            void navigator.clipboard.writeText(invitation.inviteUrl as string);
                            toast.success("Invite link copied");
                          }}
                        >
                          <Copy />
                        </Button>
                      ) : null}
                      {invitation.status === "PENDING" ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Revoke"
                          loading={revoke.isPending && revoke.variables === invitation.id}
                          onClick={() => revoke.mutate(invitation.id)}
                        >
                          <UserMinus />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InviteDialog({ messId }: { messId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<MessRole>("MEMBER");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      invitationsApi.create(messId, {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
      }),
    onSuccess: (invitation) => {
      toast.success("Invitation created");
      void queryClient.invalidateQueries({ queryKey: qk.invitations(messId) });
      setCreatedUrl(invitation.inviteUrl ?? null);
      setCreatedCode(invitation.token ?? null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create the invitation"),
  });

  const valid = email.trim() !== "" || phone.trim() !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setEmail("");
          setPhone("");
          setCreatedUrl(null);
          setCreatedCode(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>Provide an email, a phone number, or both.</DialogDescription>
        </DialogHeader>
        {createdUrl ? (
          <div className="space-y-3">
            <p className="text-sm">Invitation created. Share the link or code with the invitee:</p>
            {createdCode ? (
              <div className="space-y-1.5">
                <Label htmlFor="invite-code">Invitation code</Label>
                <div className="flex items-center gap-2">
                  <Input id="invite-code" readOnly value={createdCode} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy invitation code"
                    onClick={() => {
                      void navigator.clipboard.writeText(createdCode);
                      toast.success("Invitation code copied");
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">They can paste this after signing in to join without creating a mess.</p>
              </div>
            ) : null}
            <Label htmlFor="invite-link">Invitation link</Label>
            <div className="flex items-center gap-2">
              <Input id="invite-link" readOnly value={createdUrl} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy link"
                onClick={() => {
                  void navigator.clipboard.writeText(createdUrl);
                  toast.success("Copied");
                }}
              >
                <Copy />
              </Button>
            </div>
            <a href={createdUrl} className="text-sm text-primary underline-offset-4 hover:underline">
              Open the invitation
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="flatmate@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-phone">Phone (optional)</Label>
              <Input
                id="invite-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="01712345678"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as MessRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          {createdUrl ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>
                <ShieldCheck />
                Create invitation
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
