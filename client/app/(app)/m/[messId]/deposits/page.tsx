"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PiggyBank, Plus, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Money } from "@/components/shared/money";
import { NoMonthState } from "@/components/shared/no-month";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatCard } from "@/components/shared/stat-card";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { depositsApi } from "@/lib/api/endpoints";
import type { DepositStatus, PaymentMethod } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDateShort, humanize } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";

const STATUSES: DepositStatus[] = ["PENDING", "VERIFIED", "REJECTED"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "OTHER"];

export default function DepositsPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const { member, isManager, data: membersData, isPending: memberPending } = useMyMembership(messId);

  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filters = { monthId, status, page };
  const deposits = useQuery({
    queryKey: qk.deposits(messId, filters),
    queryFn: () =>
      depositsApi.list(messId, {
        monthId: monthId as string,
        status: status === "all" ? undefined : status,
        page,
        pageSize: 10,
      }),
    enabled: Boolean(monthId),
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deposits" description="Deposits are recorded against the current month." />
        {memberPending ? <TableSkeleton columns={5} rows={4} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="Deposits" />}
      </div>
    );
  }

  const members = (membersData?.items ?? []).map((item) => ({ id: item.id, name: item.displayName ?? item.name }));
  const items = deposits.data?.items ?? [];

  const totals = items.reduce(
    (acc, deposit) => {
      const amount = BigInt(deposit.amountPoisha);
      if (deposit.status === "VERIFIED") acc.verified += amount;
      else if (deposit.status === "PENDING") acc.pending += amount;
      return acc;
    },
    { verified: 0n, pending: 0n },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposits"
        description={`Money members have put into the mess for ${activeMonth.label}. Only verified deposits count in the report.`}
        actions={<DepositDialog messId={messId} monthId={monthId as string} members={members} isManager={Boolean(isManager)} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verified (this page)" value={<Money value={totals.verified.toString()} />} icon={PiggyBank} tone="positive" />
        <StatCard label="Pending (this page)" value={<Money value={totals.pending.toString()} />} icon={PiggyBank} tone="warning" />
        <StatCard label="Entries shown" value={items.length} icon={PiggyBank} hint={`Page ${deposits.data?.meta.page ?? 1} of ${deposits.data?.meta.totalPages ?? 1}`} />
        <StatCard label="Total records" value={deposits.data?.meta.total ?? 0} icon={PiggyBank} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Deposit records</CardTitle>
            <CardDescription>A manager verifies each deposit before it affects the balance.</CardDescription>
          </div>
          <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {humanize(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {deposits.isPending ? (
            <div className="px-5">
              <TableSkeleton columns={6} rows={6} />
            </div>
          ) : deposits.isError ? (
            <div className="px-5">
              <ErrorState error={deposits.error} onRetry={() => void deposits.refetch()} compact />
            </div>
          ) : items.length === 0 ? (
            <div className="px-5">
              <EmptyState
                icon={PiggyBank}
                title="No deposits recorded"
                description="Record a deposit you have paid into the mess so it can be verified."
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((deposit) => (
                    <TableRow key={deposit.id} className={deposit.memberId === member?.id ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{deposit.memberName ?? "Member"}</span>
                          {deposit.memberId === member?.id ? <Badge variant="secondary">You</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell>{humanize(deposit.method)}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-muted-foreground">{deposit.reference ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Money value={deposit.amountPoisha} />
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col gap-1">
                          <StatusBadge status={deposit.status} />
                          {deposit.verifiedAt ? (
                            <span className="text-xs text-muted-foreground">{formatDateShort(deposit.verifiedAt.slice(0, 10))}</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {isManager && deposit.status === "PENDING" ? (
                            <>
                              <VerifyButton messId={messId} depositId={deposit.id} />
                              <RejectButton messId={messId} depositId={deposit.id} />
                            </>
                          ) : null}
                          {deposit.status === "PENDING" && (isManager || deposit.memberId === member?.id) ? (
                            <DeleteButton messId={messId} depositId={deposit.id} />
                          ) : null}
                          {deposit.status !== "PENDING" && !isManager ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-5 pb-4">
                <Pagination meta={deposits.data?.meta} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerifyButton({ messId, depositId }: { messId: string; depositId: string }) {
  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: () => depositsApi.verify(messId, depositId),
    onSuccess: () => {
      toast.success("Deposit verified");
      void queryClient.invalidateQueries({ queryKey: ["deposits", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not verify"),
  });
  return (
    <Button size="icon-sm" variant="outline" aria-label="Verify" loading={verify.isPending} onClick={() => verify.mutate()}>
      <Check />
    </Button>
  );
}

function RejectButton({ messId, depositId }: { messId: string; depositId: string }) {
  const queryClient = useQueryClient();
  const reject = useMutation({
    mutationFn: (reason: string) => depositsApi.reject(messId, depositId, reason),
    onSuccess: () => {
      toast.success("Deposit rejected");
      void queryClient.invalidateQueries({ queryKey: ["deposits", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reject"),
  });
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="outline" aria-label="Reject">
          <X />
        </Button>
      }
      title="Reject this deposit?"
      description="A reason is required and stored in the audit log."
      confirmLabel="Reject"
      variant="destructive"
      requireReason
      pending={reject.isPending}
      onConfirm={(reason) => reject.mutate(reason)}
    />
  );
}

function DeleteButton({ messId, depositId }: { messId: string; depositId: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => depositsApi.remove(messId, depositId),
    onSuccess: () => {
      toast.success("Deposit deleted");
      void queryClient.invalidateQueries({ queryKey: ["deposits", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete"),
  });
  return (
    <Button size="icon-sm" variant="ghost" aria-label="Delete" loading={remove.isPending} onClick={() => remove.mutate()}>
      <Trash2 />
    </Button>
  );
}

function DepositDialog({
  messId,
  monthId,
  members,
  isManager,
}: {
  messId: string;
  monthId: string;
  members: { id: string; name: string }[];
  isManager: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("__self");
  const [amountTaka, setAmountTaka] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: () =>
      depositsApi.create(messId, {
        monthId,
        memberId: memberId === "__self" ? undefined : memberId,
        amountTaka,
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Deposit recorded — waiting for verification");
      void queryClient.invalidateQueries({ queryKey: ["deposits", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
      setOpen(false);
      setAmountTaka("");
      setReference("");
      setNote("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not record the deposit"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Record deposit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record a deposit</DialogTitle>
          <DialogDescription>New deposits start as pending until a manager verifies them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isManager ? (
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self">Me</SelectItem>
                  {members.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Amount (৳)</Label>
            <Input
              id="deposit-amount"
              inputMode="decimal"
              value={amountTaka}
              onChange={(event) => setAmountTaka(event.target.value)}
              placeholder="2000"
            />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanize(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-ref">Reference (optional)</Label>
            <Input
              id="deposit-ref"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="bKash transaction id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-note">Note (optional)</Label>
            <Input id="deposit-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={amountTaka.trim().length === 0}
            onClick={() => create.mutate()}
          >
            Record deposit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
