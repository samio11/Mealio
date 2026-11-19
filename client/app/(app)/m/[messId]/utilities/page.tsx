"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, X, Zap } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { expensesApi, utilitiesApi, type ListResult } from "@/lib/api/endpoints";
import type { ExpenseCategory, PaymentMethod, UtilityBill, UtilityShare } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDate, humanize, todayInDhaka } from "@/lib/format";
import { qk } from "@/lib/hooks/queries";
import { useMyMembership } from "@/lib/hooks/use-my-membership";

const UTILITY_CATEGORIES: ExpenseCategory[] = ["ELECTRICITY", "GAS", "WATER", "MAID", "GARBAGE"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "CARD"];

export default function UtilitiesPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const { member, isManager, isPending: memberPending } = useMyMembership(messId);
  const [page, setPage] = useState(1);
  const monthId = activeMonth?.id ?? null;
  const bills = useQuery({
    queryKey: qk.utilities(messId, { monthId, page }),
    queryFn: () => utilitiesApi.list(messId, { monthId: monthId as string, page, pageSize: 10 }),
    enabled: Boolean(monthId),
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Utility bills" description="Monthly shared utility bills and member payments." />
        {memberPending ? <TableSkeleton columns={5} rows={4} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="Utility bills" />}
      </div>
    );
  }

  const items = bills.data?.items ?? [];
  const approved = items.filter((bill) => bill.status === "APPROVED");
  const totalBills = approved.reduce((sum, bill) => sum + BigInt(bill.amountPoisha), 0n);
  const outstanding = approved.reduce(
    (sum, bill) =>
      sum +
      bill.shares.reduce(
        (shareSum, share) => shareSum + (share.payment?.status === "VERIFIED" ? 0n : BigInt(share.amountPoisha)),
        0n,
      ),
    0n,
  );
  const pendingPayments = items.reduce(
    (sum, bill) => sum + bill.shares.filter((share) => share.payment?.status === "PENDING").length,
    0,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Utility bills"
        description={`Shared bills for ${activeMonth.label}, split equally among active members. Members can submit payment details for manager verification.`}
        actions={
          isManager && activeMonth.status === "OPEN" ? (
            <UtilityBillDialog messId={messId} monthId={monthId as string} />
          ) : null
        }
      />
      <p className="-mt-3 text-sm text-muted-foreground">
        The manager tracks payment to the provider separately from the members&apos; shares.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Approved bills" value={approved.length} icon={Zap} />
        <StatCard label="Bill total" value={<Money value={totalBills.toString()} />} icon={Zap} tone="negative" />
        <StatCard label="Unpaid shares" value={<Money value={outstanding.toString()} />} icon={Zap} tone="warning" />
        <StatCard label="Payments to verify" value={pendingPayments} icon={Zap} />
      </div>

      {bills.isPending ? (
        <TableSkeleton columns={6} rows={6} />
      ) : bills.isError ? (
        <ErrorState error={bills.error} onRetry={() => void bills.refetch()} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Zap}
              title="No utility bills yet"
              description={isManager ? "Add this month's electricity, gas, water, maid or garbage bill." : "Your manager has not added any utility bills for this month."}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((bill) => (
            <UtilityBillCard
              key={bill.id}
              messId={messId}
              bill={bill}
              currentMemberId={member?.id}
              currentUserId={member?.userId}
              isManager={Boolean(isManager)}
              canChange={activeMonth.status === "OPEN"}
            />
          ))}
          <Pagination meta={bills.data?.meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function UtilityBillCard({
  messId,
  bill,
  currentMemberId,
  currentUserId,
  isManager,
  canChange,
}: {
  messId: string;
  bill: UtilityBill;
  currentMemberId?: string;
  currentUserId?: string;
  isManager: boolean;
  canChange: boolean;
}) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["utilities", messId] });
    void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
    void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    void queryClient.invalidateQueries({ queryKey: ["audit", messId] });
  };
  const approve = useMutation({
    mutationFn: () => expensesApi.approve(messId, bill.id),
    onSuccess: () => {
      toast.success("Utility bill published and split among active members");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not publish the bill"),
  });
  const reject = useMutation({
    mutationFn: (reason: string) => expensesApi.reject(messId, bill.id, reason),
    onSuccess: () => {
      toast.success("Utility bill rejected");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reject the bill"),
  });
  const remove = useMutation({
    mutationFn: () => utilitiesApi.remove(messId, bill.id),
    onSuccess: async () => {
      toast.success("Utility bill deleted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["utilities", messId] }),
        queryClient.invalidateQueries({ queryKey: ["expenses", messId] }),
        queryClient.invalidateQueries({ queryKey: ["reports", messId] }),
        queryClient.invalidateQueries({ queryKey: ["audit", messId] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the bill"),
  });
  const setBillPaid = useMutation({
    mutationFn: (paid: boolean) => utilitiesApi.setBillPaid(messId, bill.id, paid),
    onSuccess: async (result, paid) => {
      queryClient.setQueriesData<ListResult<UtilityBill>>(
        { queryKey: ["utilities", messId] },
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === result.id
                    ? {
                        ...item,
                        utilityBillPaid: result.paid,
                        utilityBillPaidById: result.paidById,
                        utilityBillPaidAt: result.paidAt,
                      }
                    : item,
                ),
              }
            : current,
      );
      toast.success(paid ? "Utility bill marked paid" : "Utility bill marked not paid");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["utilities", messId] }),
        queryClient.invalidateQueries({ queryKey: ["audit", messId] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update bill payment status"),
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {humanize(bill.category)}
            <StatusBadge status={bill.status} />
          </CardTitle>
          <CardDescription>
            {bill.description} · {formatDate(bill.incurredOn)}
          </CardDescription>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold"><Money value={bill.amountPoisha} /></div>
          {bill.status === "APPROVED" ? (
            <div className="mt-1 flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">Provider bill status</span>
              <StatusBadge
                status={bill.utilityBillPaid ? "PAID" : "UNPAID"}
                label={bill.utilityBillPaid ? "Paid" : "Not paid"}
              />
              {bill.utilityBillPaid && bill.utilityBillPaidById ? (
                <span className="text-xs text-muted-foreground">
                  {bill.utilityBillPaidById === currentUserId ? "Paid by you" : "Paid by manager"}
                </span>
              ) : null}
            </div>
          ) : null}
          {bill.shares.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              {isManager ? `${bill.shares.length} member shares` : "Your equal share"}
            </div>
          ) : null}
          {isManager && bill.status === "APPROVED" ? (
            <div className="mt-2 flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">Payment to provider</span>
              <span className="text-xs text-muted-foreground">Click Paid after you pay the provider; no member verification is needed.</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={bill.utilityBillPaid ? "default" : "outline"}
                  loading={setBillPaid.isPending && setBillPaid.variables === true}
                  disabled={!canChange || setBillPaid.isPending || bill.utilityBillPaid}
                  onClick={() => setBillPaid.mutate(true)}
                >
                  Paid
                </Button>
                <Button
                  size="sm"
                  variant={!bill.utilityBillPaid ? "default" : "outline"}
                  loading={setBillPaid.isPending && setBillPaid.variables === false}
                  disabled={!canChange || setBillPaid.isPending || !bill.utilityBillPaid}
                  onClick={() => setBillPaid.mutate(false)}
                >
                  Not paid
                </Button>
              </div>
            </div>
          ) : null}
          {isManager &&
          currentUserId === bill.createdById &&
          canChange &&
          bill.status !== "REVERSED" &&
          !bill.utilityBillPaid &&
          bill.shares.every((share) => share.payment === null) ? (
            <div className="mt-2 flex justify-end">
              <ConfirmDialog
                trigger={<Button size="sm" variant="outline"><Trash2 /> Delete utility bill</Button>}
                title="Delete this utility bill?"
                description="This removes the bill and its member shares. Bills with member payment requests or provider payments cannot be deleted."
                confirmLabel="Delete bill"
                variant="destructive"
                pending={remove.isPending}
                onConfirm={() => remove.mutate()}
              />
            </div>
          ) : null}
        </div>
      </CardHeader>
      {bill.status === "PENDING" ? (
        <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {isManager ? "Publish this bill to split it equally and open member payments." : "This bill is waiting for manager approval."}
          </p>
          {isManager && canChange ? (
            <div className="flex gap-2">
              <Button size="sm" loading={approve.isPending} onClick={() => approve.mutate()}>
                <Check /> Publish & split
              </Button>
              <ConfirmDialog
                trigger={<Button size="sm" variant="outline"><X /> Reject</Button>}
                title="Reject this utility bill?"
                description="A reason is required and stored in the audit log."
                confirmLabel="Reject bill"
                variant="destructive"
                requireReason
                pending={reject.isPending}
                onConfirm={(reason) => reject.mutate(reason)}
              />
            </div>
          ) : null}
        </CardContent>
      ) : null}
      {bill.status === "REJECTED" ? (
        <CardContent className="border-t pt-4 text-sm text-muted-foreground">
          This bill was rejected{bill.rejectionReason ? `: ${bill.rejectionReason}` : "."}
        </CardContent>
      ) : null}
      {bill.status === "APPROVED" || bill.status === "REVERSED" ? (
        <CardContent className="px-0 pb-0">
          {bill.shares.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              {bill.status === "REVERSED" ? "This bill was reversed." : "No active members were available for the split."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isManager ? <TableHead>Member</TableHead> : null}
                    <TableHead>Share</TableHead>
                    <TableHead>Payment method / reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.shares.map((share) => (
                    <UtilityShareRow
                      key={share.memberId}
                      messId={messId}
                      bill={bill}
                      share={share}
                      currentMemberId={currentMemberId}
                      isManager={isManager}
                      canChange={canChange && bill.status === "APPROVED"}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function UtilityShareRow({
  messId,
  bill,
  share,
  currentMemberId,
  isManager,
  canChange,
}: {
  messId: string;
  bill: UtilityBill;
  share: UtilityShare;
  currentMemberId?: string;
  isManager: boolean;
  canChange: boolean;
}) {
  const queryClient = useQueryClient();
  const payment = share.payment;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["utilities", messId] });
    void queryClient.invalidateQueries({ queryKey: ["deposits", messId] });
    void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
  };
  const verify = useMutation({
    mutationFn: () => utilitiesApi.verifyPayment(messId, payment!.id),
    onSuccess: () => {
      toast.success("Utility payment verified");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not verify payment"),
  });
  const reject = useMutation({
    mutationFn: (reason: string) => utilitiesApi.rejectPayment(messId, payment!.id, reason),
    onSuccess: () => {
      toast.success("Payment request rejected");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reject payment"),
  });

  const paidInFull = payment?.status === "VERIFIED";
  const isMine = share.memberId === currentMemberId;
  const status = BigInt(share.amountPoisha) === 0n ? "NO DUE" : paidInFull ? "PAID" : payment?.status ?? "UNPAID";
  const canSubmit = !isManager && isMine && canChange && !paidInFull && payment?.status !== "PENDING" && BigInt(share.amountPoisha) > 0n;

  return (
    <TableRow className={isMine ? "bg-primary/5" : undefined}>
      {isManager ? (
        <TableCell>
          <span className="flex items-center gap-2">
            <span>{share.memberName ?? "Member"}</span>
            {isMine ? <Badge variant="secondary">You</Badge> : null}
          </span>
        </TableCell>
      ) : null}
      <TableCell><Money value={share.amountPoisha} /></TableCell>
      <TableCell className="max-w-[14rem]">
        {payment ? (
          <span className="block truncate">
            {humanize(payment.method)}{payment.reference ? ` · ${payment.reference}` : ""}
          </span>
        ) : "—"}
        {payment?.rejectionReason ? (
          <span className="block truncate text-xs text-destructive">{payment.rejectionReason}</span>
        ) : null}
      </TableCell>
      <TableCell><StatusBadge status={status} /></TableCell>
      <TableCell className="text-right">
        {isManager && canChange && payment?.status === "PENDING" ? (
          <span className="inline-flex gap-1">
            <Button size="icon-sm" variant="outline" aria-label="Verify payment" loading={verify.isPending} onClick={() => verify.mutate()}>
              <Check />
            </Button>
            <ConfirmDialog
              trigger={<Button size="icon-sm" variant="outline" aria-label="Reject payment"><X /></Button>}
              title="Reject this payment request?"
              description="Give the member a reason so they can correct and resubmit it."
              confirmLabel="Reject"
              variant="destructive"
              requireReason
              pending={reject.isPending}
              onConfirm={(reason) => reject.mutate(reason)}
            />
          </span>
        ) : canSubmit ? (
          <UtilityPaymentDialog messId={messId} bill={bill} share={share} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function UtilityBillDialog({ messId, monthId }: { messId: string; monthId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("ELECTRICITY");
  const [amountTaka, setAmountTaka] = useState("");
  const [description, setDescription] = useState("");
  const [incurredOn, setIncurredOn] = useState(todayInDhaka());
  const [note, setNote] = useState("");
  const create = useMutation({
    mutationFn: () =>
      expensesApi.create(messId, {
        monthId,
        category,
        amountTaka,
        description: description.trim(),
        allocationMethod: "EQUAL",
        incurredOn,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Bill recorded. Publish it to split equally and notify members.");
      void queryClient.invalidateQueries({ queryKey: ["utilities", messId] });
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
      setOpen(false);
      setAmountTaka("");
      setDescription("");
      setNote("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not record the bill"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus /> Add utility bill</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a utility bill</DialogTitle>
          <DialogDescription>
            The bill is saved as pending. Publish it to split the exact total equally across active members. Maid service is optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Bill type</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UTILITY_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>{humanize(item)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="utility-amount">Total amount (৳)</Label>
              <Input id="utility-amount" inputMode="decimal" value={amountTaka} onChange={(event) => setAmountTaka(event.target.value)} placeholder="1200" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="utility-description">Description</Label>
            <Input id="utility-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="November electricity bill" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="utility-date">Bill date</Label>
            <Input id="utility-date" type="date" value={incurredOn} onChange={(event) => setIncurredOn(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="utility-note">Note (optional)</Label>
            <Textarea id="utility-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
          <Button
            loading={create.isPending}
            disabled={amountTaka.trim() === "" || description.trim().length < 2}
            onClick={() => create.mutate()}
          >
            Save bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UtilityPaymentDialog({ messId, bill, share }: { messId: string; bill: UtilityBill; share: UtilityShare }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      utilitiesApi.submitPayment(messId, bill.id, {
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Payment request sent. It will show as paid after manager verification.");
      void queryClient.invalidateQueries({ queryKey: ["utilities", messId] });
      setOpen(false);
      setReference("");
      setNote("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not submit payment"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {share.payment?.status === "REJECTED" ? "Resubmit" : "Submit payment"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit utility payment</DialogTitle>
          <DialogDescription>
            Record your full share of <Money value={share.amountPoisha} />. This does not process a card or mobile-wallet charge; the manager verifies receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((item) => (
                  <SelectItem key={item} value={item}>{humanize(item)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`utility-ref-${bill.id}`}>Transaction/reference (optional)</Label>
            <Input id={`utility-ref-${bill.id}`} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="bKash transaction ID" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`utility-payment-note-${bill.id}`}>Note (optional)</Label>
            <Textarea id={`utility-payment-note-${bill.id}`} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submit.isPending}>Cancel</Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>Send for verification</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
