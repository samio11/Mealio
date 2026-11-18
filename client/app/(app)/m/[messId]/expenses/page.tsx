"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, ReceiptText, RotateCcw, Trash2, X } from "lucide-react";
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
import { expensesApi } from "@/lib/api/endpoints";
import type { AllocationMethod, ExpenseCategory, ExpenseStatus } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDate, humanize, todayInDhaka } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";

const STATUSES: ExpenseStatus[] = ["PENDING", "APPROVED", "REJECTED", "REVERSED"];
const CATEGORIES: ExpenseCategory[] = [
  "RENT",
  "ELECTRICITY",
  "GAS",
  "WIFI",
  "CLEANING",
  "OTHER_SHARED",
  "MEMBER_SPECIFIC",
  "MEAL_BAZAR",
  "REFUND_ADJUSTMENT",
];
const ALLOCATIONS: AllocationMethod[] = ["EQUAL", "MEAL_COUNT", "CUSTOM"];

export default function ExpensesPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const { isManager, data: membersData, isPending: memberPending } = useMyMembership(messId);

  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filters = { monthId, status, category, page };
  const expenses = useQuery({
    queryKey: qk.expenses(messId, filters),
    queryFn: () =>
      expensesApi.list(messId, {
        monthId: monthId as string,
        status: status === "all" ? undefined : status,
        category: category === "all" ? undefined : category,
        page,
        pageSize: 10,
      }),
    enabled: Boolean(monthId),
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expenses" description="Expenses belong to the current month." />
        {memberPending ? <TableSkeleton columns={5} rows={4} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="Expenses" />}
      </div>
    );
  }

  const members = (membersData?.items ?? []).map((item) => ({ id: item.id, name: item.displayName ?? item.name }));
  const items = expenses.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        description={`Shared and member-specific costs for ${activeMonth.label}. Approved expenses reduce the mess cash.`}
        actions={
          isManager ? (
            <ExpenseDialog messId={messId} monthId={monthId as string} members={members} />
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Records" value={expenses.data?.meta.total ?? 0} icon={ReceiptText} />
        <StatCard
          label="Approved (this page)"
          value={<Money value={items.filter((e) => e.status === "APPROVED").reduce((s, e) => s + BigInt(e.amountPoisha), 0n).toString()} />}
          icon={ReceiptText}
          tone="negative"
        />
        <StatCard label="Pending (this page)" value={items.filter((e) => e.status === "PENDING").length} icon={ReceiptText} tone="warning" />
        <StatCard label="Categories" value={CATEGORIES.length} icon={ReceiptText} hint="Meal bazar is created from approved bazar entries" />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Expense records</CardTitle>
            <CardDescription>Pending expenses await a manager decision; approved ones count in the report.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={(value) => { setCategory(value); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanize(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="w-40">
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
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {expenses.isPending ? (
            <div className="px-5">
              <TableSkeleton columns={6} rows={6} />
            </div>
          ) : expenses.isError ? (
            <div className="px-5">
              <ErrorState error={expenses.error} onRetry={() => void expenses.refetch()} compact />
            </div>
          ) : items.length === 0 ? (
            <div className="px-5">
              <EmptyState
                icon={ReceiptText}
                title="No expenses recorded"
                description={isManager ? "Add rent, utilities and other shared costs here." : "A manager has not recorded any expenses yet."}
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Split</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(expense.incurredOn)}</TableCell>
                      <TableCell className="max-w-[16rem] truncate">{expense.description}</TableCell>
                      <TableCell>{humanize(expense.category)}</TableCell>
                      <TableCell>{humanize(expense.allocationMethod)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={expense.amountPoisha} />
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col gap-1">
                          <StatusBadge status={expense.status} />
                          {expense.rejectionReason ? (
                            <span className="max-w-[14rem] truncate text-xs text-muted-foreground">{expense.rejectionReason}</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {isManager && expense.status === "PENDING" ? (
                            <>
                              <ApproveButton messId={messId} expenseId={expense.id} />
                              <RejectButton messId={messId} expenseId={expense.id} />
                              <DeleteButton messId={messId} expenseId={expense.id} />
                            </>
                          ) : null}
                          {isManager && expense.status === "APPROVED" ? (
                            <ReverseButton messId={messId} expenseId={expense.id} />
                          ) : null}
                          {!isManager ? <span className="text-muted-foreground">—</span> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-5 pb-4">
                <Pagination meta={expenses.data?.meta} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApproveButton({ messId, expenseId }: { messId: string; expenseId: string }) {
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: () => expensesApi.approve(messId, expenseId),
    onSuccess: () => {
      toast.success("Expense approved");
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not approve"),
  });
  return (
    <Button size="icon-sm" variant="outline" aria-label="Approve" loading={approve.isPending} onClick={() => approve.mutate()}>
      <Check />
    </Button>
  );
}

function RejectButton({ messId, expenseId }: { messId: string; expenseId: string }) {
  const queryClient = useQueryClient();
  const reject = useMutation({
    mutationFn: (reason: string) => expensesApi.reject(messId, expenseId, reason),
    onSuccess: () => {
      toast.success("Expense rejected");
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
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
      title="Reject this expense?"
      description="A reason is required and stored in the audit log."
      confirmLabel="Reject"
      variant="destructive"
      requireReason
      pending={reject.isPending}
      onConfirm={(reason) => reject.mutate(reason)}
    />
  );
}

function ReverseButton({ messId, expenseId }: { messId: string; expenseId: string }) {
  const queryClient = useQueryClient();
  const reverse = useMutation({
    mutationFn: (reason: string) => expensesApi.reverse(messId, expenseId, reason),
    onSuccess: () => {
      toast.success("Expense reversed — a balancing entry was created");
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reverse"),
  });
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="outline" aria-label="Reverse">
          <RotateCcw />
        </Button>
      }
      title="Reverse this approved expense?"
      description="A balancing anti-entry is posted so the month stays auditable. A reason is required."
      confirmLabel="Reverse"
      variant="destructive"
      requireReason
      pending={reverse.isPending}
      onConfirm={(reason) => reverse.mutate(reason)}
    />
  );
}

function DeleteButton({ messId, expenseId }: { messId: string; expenseId: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => expensesApi.remove(messId, expenseId),
    onSuccess: () => {
      toast.success("Expense deleted");
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
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

function ExpenseDialog({
  messId,
  monthId,
  members,
}: {
  messId: string;
  monthId: string;
  members: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("RENT");
  const [amountTaka, setAmountTaka] = useState("");
  const [description, setDescription] = useState("");
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>("EQUAL");
  const [incurredOn, setIncurredOn] = useState(todayInDhaka());
  const [note, setNote] = useState("");
  const [allocs, setAllocs] = useState<Record<string, string>>({});

  const customTotal = Object.values(allocs).reduce((sum, value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const create = useMutation({
    mutationFn: () =>
      expensesApi.create(messId, {
        monthId,
        category,
        amountTaka,
        description: description.trim(),
        allocationMethod,
        incurredOn,
        note: note.trim() || null,
        allocations:
          allocationMethod === "CUSTOM"
            ? Object.entries(allocs)
                .filter(([, value]) => value.trim() !== "")
                .map(([memberId, value]) => ({ memberId, amountTaka: value }))
            : undefined,
      }),
    onSuccess: () => {
      toast.success("Expense recorded as pending");
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
      setOpen(false);
      reset();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not record the expense"),
  });

  const reset = () => {
    setAmountTaka("");
    setDescription("");
    setNote("");
    setAllocs({});
    setAllocationMethod("EQUAL");
  };

  const customValid = allocationMethod !== "CUSTOM" || Object.values(allocs).some((value) => value.trim() !== "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Record expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record an expense</DialogTitle>
          <DialogDescription>
            Meal bazar is created automatically from approved bazar entries — use the other categories for shared costs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {humanize(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount (৳)</Label>
              <Input
                id="expense-amount"
                inputMode="decimal"
                value={amountTaka}
                onChange={(event) => setAmountTaka(event.target.value)}
                placeholder="5000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-desc">Description</Label>
            <Input
              id="expense-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="House rent for the month"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Split method</Label>
              <Select value={allocationMethod} onValueChange={(value) => setAllocationMethod(value as AllocationMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOCATIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {humanize(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Incurred on</Label>
              <Input id="expense-date" type="date" value={incurredOn} onChange={(event) => setIncurredOn(event.target.value)} />
            </div>
          </div>

          {allocationMethod === "CUSTOM" ? (
            <div className="space-y-2">
              <Label>Custom split</Label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border p-3">
                {members.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm">{entry.name}</span>
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      value={allocs[entry.id] ?? ""}
                      onChange={(event) => setAllocs((prev) => ({ ...prev, [entry.id]: event.target.value }))}
                      placeholder="৳"
                      aria-label={`Amount for ${entry.name}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-right text-xs text-muted-foreground">Custom total: {customTotal.toFixed(2)}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="expense-note">Note (optional)</Label>
            <Textarea id="expense-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabled={amountTaka.trim() === "" || description.trim().length < 2 || !customValid}
            onClick={() => create.mutate()}
          >
            Record expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
