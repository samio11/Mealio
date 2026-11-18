"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, Download, PiggyBank, ReceiptText, Sparkles, TrendingDown, Wallet } from "lucide-react";
import { useParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Money } from "@/components/shared/money";
import { NoMonthState } from "@/components/shared/no-month";
import { PageHeader } from "@/components/shared/page-header";
import { CardsSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aiApi, reportsApi } from "@/lib/api/endpoints";
import { useActiveMonth } from "@/lib/context/active-month";
import { clampPercent, formatDateTime, humanize } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";
import { QUERY_CACHE } from "@/lib/query-cache";

export default function ReportsPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const { member, isManager, isPending: memberPending } = useMyMembership(messId);

  const report = useQuery({
    queryKey: qk.report(messId, monthId ?? "none"),
    queryFn: () => reportsApi.monthly(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
    staleTime: QUERY_CACHE.reportStaleTime,
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description="Reports are produced per month." />
        {memberPending ? <CardsSkeleton count={4} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="Reports" />}
      </div>
    );
  }

  const data = report.data;
  const categoryData = (data?.expenses.byCategory ?? []).map((row) => ({
    category: humanize(row.category),
    taka: Number(row.amountTaka),
    amount: row.amountTaka,
  }));
  const utilisation = data ? clampPercent(data.budget.utilisationPercent) : 0;

  return (
    <div id="monthly-report" className="space-y-5">
      {data ? (
        <p className="report-print-only text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Mealio · Monthly financial report
        </p>
      ) : null}
      <PageHeader
        title={`Report — ${activeMonth.label}`}
        description="Every figure below is derived from verified deposits and approved expenses only."
        actions={
          <>
            <Button className="report-screen-only" variant="outline" disabled={!data} onClick={() => window.print()}>
              <Download />
              Save as PDF
            </Button>
            {isManager ? <AiSummaryButton messId={messId} monthId={monthId as string} /> : null}
          </>
        }
      />

      {report.isError ? <ErrorState error={report.error} onRetry={() => void report.refetch()} /> : null}

      {report.isPending ? (
        <CardsSkeleton count={4} />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              className="report-card"
              label="Meal rate"
              value={<Money value={data.meal.mealRatePoisha} />}
              hint={`${data.meal.totalMealCount} meals · ${activeMonth.status === "OPEN" ? "live (may change)" : "final"}`}
              icon={BarChart3}
            />
            <StatCard className="report-card" label="Meal expense" value={<Money value={data.meal.mealExpensePoisha} />} hint="Approved meal-bazar" icon={ReceiptText} />
            <StatCard
              className="report-card"
              label="Verified deposits"
              value={<Money value={data.deposits.verifiedTotalPoisha} />}
              hint={`${data.deposits.pendingCount} still pending`}
              icon={PiggyBank}
              tone="positive"
            />
            <StatCard
              className="report-card"
              label="Closing cash"
              value={<Money value={data.cash.closingCashPoisha} />}
              hint="Opening + confirmed deposits − payments"
              icon={Wallet}
              tone={BigInt(data.cash.closingCashPoisha) < 0n ? "negative" : "positive"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="report-card lg:col-span-2">
              <CardHeader>
                <CardTitle>Expenses by category</CardTitle>
                <CardDescription>Approved amounts only.</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length === 0 ? (
                  <EmptyState icon={ReceiptText} title="No approved expenses yet" />
                ) : (
                  <div className="report-chart h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} width={60} />
                        <Tooltip
                          formatter={(value: number) => [`৳${value.toFixed(2)}`, "Amount"]}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="taka" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {categoryData.length > 0 ? (
                  <table className="report-print-only w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left font-medium">Category</th>
                        <th className="text-right font-medium">Approved amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryData.map((row) => (
                        <tr key={row.category}>
                          <td>{row.category}</td>
                          <td className="text-right tabular">৳{Number(row.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </CardContent>
            </Card>

            <Card className="report-card">
              <CardHeader>
                <CardTitle>Budget</CardTitle>
                <CardDescription>
                  {data.budget.utilisationPercent.toFixed(1)}% used
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${utilisation}%` }}
                  />
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Budget</dt>
                    <dd>
                      <Money value={data.budget.budgetPoisha} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Spent</dt>
                    <dd>
                      <Money value={data.budget.spentPoisha} />
                    </dd>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-medium">
                    <dt>Remaining</dt>
                    <dd>
                      <Money value={data.budget.remainingPoisha} tone={BigInt(data.budget.remainingPoisha) < 0n ? "negative" : "default"} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="report-card report-member-table">
            <CardHeader>
              <CardTitle>Member balances</CardTitle>
              <CardDescription>
                Deposits − meal cost − allocated charges. Negative means the member owes the mess.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {data.members.length === 0 ? (
                <div className="px-5">
                  <EmptyState icon={TrendingDown} title="No member activity this month" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Meals</TableHead>
                      <TableHead className="text-right">Meal cost</TableHead>
                      <TableHead className="text-right">Deposits</TableHead>
                      <TableHead className="text-right">Charges</TableHead>
                      <TableHead className="text-right">Adjustments</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.members.map((row) => (
                      <TableRow key={row.memberId} className={row.memberId === member?.id ? "bg-primary/5" : undefined}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{row.memberName ?? "Member"}</span>
                            {row.memberId === member?.id ? <Badge variant="secondary">You</Badge> : null}
                          </span>
                        </TableCell>
                        <TableCell className="tabular text-right">{row.mealCount}</TableCell>
                        <TableCell className="text-right">
                          <Money value={row.mealCostPoisha} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.verifiedDepositsPoisha} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.allocatedChargesPoisha} tone="muted" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.adjustmentsPoisha} tone="muted" signed />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.balancePoisha} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard className="report-card" label="Outstanding (owed to mess)" value={<Money value={data.totals.outstandingPoisha} />} icon={TrendingDown} tone="warning" />
            <StatCard className="report-card" label="Advance (owed to members)" value={<Money value={data.totals.advancePoisha} />} icon={PiggyBank} tone="positive" />
            <StatCard className="report-card" label="Net position" value={<Money value={data.totals.memberBalancePoisha} />} icon={Wallet} />
          </div>

          <p className="text-xs text-muted-foreground">Report generated {formatDateTime(data.generatedAt)} (Asia/Dhaka).</p>
        </>
      ) : null}
    </div>
  );
}

function AiSummaryButton({ messId, monthId }: { messId: string; monthId: string }) {
  const [open, setOpen] = useState(false);
  const summary = useMutation({
    mutationFn: () => aiApi.reportSummary(messId, monthId),
    onError: (error) => {
      setOpen(false);
      toast.error(error instanceof Error ? error.message : "AI request failed");
    },
    onMutate: () => setOpen(true),
  });

  const result = summary.data;

  return (
    <>
      <Button
        className="report-screen-only"
        loading={summary.isPending}
        onClick={() => (result ? setOpen(true) : summary.mutate())}
      >
        <Sparkles />
        {result ? "View AI summary" : "AI summary"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI draft summary
            </DialogTitle>
            <DialogDescription>
              Draft for review — the AI never posts or approves financial entries.
              {result?.model ? ` Model: ${result.model}.` : ""}
            </DialogDescription>
          </DialogHeader>
          {summary.isPending ? (
            <p className="text-sm text-muted-foreground">Preparing a summary from this month&apos;s verified report…</p>
          ) : result?.status === "SUCCEEDED" && result.data ? (
            <div className="space-y-5 text-sm leading-6">
              <p>{result.data.summary}</p>
              {result.data.highlights.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highlights</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.data.highlights.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {result.data.concerns.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Watch-outs</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.data.concerns.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {result?.errorMessage ?? "The AI is not configured or returned no summary. Nothing was changed."}
            </p>
          )}
          {result && !summary.isPending ? (
            <div className="flex justify-end">
              <Button variant="outline" loading={summary.isPending} onClick={() => summary.mutate()}>
                <Sparkles />
                Regenerate
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
