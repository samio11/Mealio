"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Gauge,
  PiggyBank,
  ReceiptText,
  ShoppingBasket,
  Soup,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { MonthlyMealTimeline } from "@/components/meals/monthly-meal-timeline";
import { Money } from "@/components/shared/money";
import { NoMonthState } from "@/components/shared/no-month";
import { PageHeader } from "@/components/shared/page-header";
import { CardsSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bazarApi, depositsApi, dutiesApi, expensesApi, mealsApi, menusApi, reportsApi } from "@/lib/api/endpoints";
import { useActiveMonth } from "@/lib/context/active-month";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";
import { formatDate, formatDateShort, humanize, todayInDhaka } from "@/lib/format";
import { QUERY_CACHE } from "@/lib/query-cache";

export default function MessDashboardPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const today = todayInDhaka();

  const queryClient = useQueryClient();
  const { member, isManager, isPending: memberPending, data: membersData } = useMyMembership(messId);

  const timeline = useQuery({
    queryKey: qk.mealTimeline(messId, monthId ?? "none"),
    queryFn: () => mealsApi.timeline(messId, monthId as string),
    enabled: Boolean(monthId) && Boolean(isManager),
    staleTime: QUERY_CACHE.liveStaleTime,
  });

  const summary = useQuery({
    queryKey: qk.summary(messId, monthId ?? "none"),
    queryFn: () => reportsApi.summary(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
    staleTime: QUERY_CACHE.reportStaleTime,
  });

  const balances = useQuery({
    queryKey: qk.balances(messId, monthId ?? "none"),
    queryFn: () => reportsApi.balances(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
    staleTime: QUERY_CACHE.reportStaleTime,
  });

  const counts = useQuery({
    queryKey: qk.mealCounts(messId, monthId ?? "none"),
    queryFn: () => mealsApi.counts(messId, monthId as string),
    enabled: Boolean(monthId),
    staleTime: QUERY_CACHE.liveStaleTime,
  });

  const duties = useQuery({
    queryKey: qk.duties(messId, { monthId }),
    queryFn: () => dutiesApi.list(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
  });

  const menus = useQuery({
    queryKey: qk.menus(messId, { monthId }),
    queryFn: () => menusApi.list(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
  });

  const pendingDeposits = useQuery({
    queryKey: qk.deposits(messId, { monthId, status: "PENDING" }),
    queryFn: () => depositsApi.list(messId, { monthId: monthId as string, status: "PENDING", pageSize: 5 }),
    enabled: Boolean(monthId) && isManager,
  });

  const pendingExpenses = useQuery({
    queryKey: qk.expenses(messId, { monthId, status: "PENDING" }),
    queryFn: () => expensesApi.list(messId, { monthId: monthId as string, status: "PENDING", pageSize: 5 }),
    enabled: Boolean(monthId) && isManager,
  });

  const pendingBazar = useQuery({
    queryKey: qk.bazar(messId, { monthId, status: "PENDING_REVIEW" }),
    queryFn: () => bazarApi.list(messId, { monthId: monthId as string, status: "PENDING_REVIEW", pageSize: 5 }),
    enabled: Boolean(monthId) && isManager,
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="A month is required before any figures can be calculated." />
        {memberPending ? <CardsSkeleton count={4} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} />}
      </div>
    );
  }

  const data = summary.data;
  const myRow = member ? (balances.data?.members ?? []).find((row) => row.memberId === member.id) ?? null : null;
  const myCount = member ? (counts.data ?? []).find((row) => row.memberId === member.id) ?? null : null;

  const upcoming = (duties.data ?? [])
    .filter((duty) => duty.status === "SCHEDULED" && duty.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const myUpcoming = member ? upcoming.filter((duty) => duty.assigneeMemberId === member.id) : [];

  const todayMenus = (menus.data ?? []).filter((menu) => menu.date === today);
  const pendingTotal =
    (pendingDeposits.data?.meta.total ?? 0) +
    (pendingExpenses.data?.meta.total ?? 0) +
    (pendingBazar.data?.meta.total ?? 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${activeMonth.label} dashboard`}
        description={
          isManager
            ? "Everything that needs your attention this month, and where the money stands."
            : "Your meals, deposits and balance for this month."
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/m/${messId}/meals`}>
                <UtensilsCrossed />
                Meals
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={isManager ? `/m/${messId}/reports` : `/m/${messId}/bazar`}>
                {isManager ? <Gauge /> : <ShoppingBasket />}
                {isManager ? "Monthly report" : "Bazar"}
              </Link>
            </Button>
          </>
        }
      />

      {summary.isError ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}

      {/* Headline figures */}
      {summary.isPending ? (
        <CardsSkeleton count={4} />
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Closing cash"
            value={<Money value={data.closingCashPoisha} />}
            hint="Opening + confirmed deposits − approved payments"
            icon={Wallet}
            tone={BigInt(data.closingCashPoisha) < 0n ? "negative" : "positive"}
          />
          <StatCard
            label="Budget remaining"
            value={<Money value={data.budgetRemainingPoisha} />}
            hint="Budget minus approved budget expenses"
            icon={Gauge}
            tone={BigInt(data.budgetRemainingPoisha) < 0n ? "negative" : "default"}
          />
          <StatCard
            label="Verified deposits"
            value={<Money value={data.verifiedDepositsPoisha} />}
            hint={`${data.pendingDepositsCount} pending`}
            icon={PiggyBank}
            tone="positive"
          />
          <StatCard
            label="Meal rate"
            value={<Money value={data.mealRatePoisha} />}
            hint={`${data.totalMealCount} meals counted`}
            icon={UtensilsCrossed}
          />
        </div>
      ) : null}

      {isManager ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard
            label="Approved expenses"
            value={<Money value={data?.approvedExpensesPoisha} />}
            hint={`${data?.pendingExpensesCount ?? 0} awaiting approval`}
            icon={ReceiptText}
          />
          <StatCard
            label="Active members"
            value={data?.activeMembersCount ?? "—"}
            hint="Membership is per mess"
            icon={Users}
          />
          <StatCard
            label="Waiting for verification"
            value={pendingTotal}
            hint="Deposits, expenses and bazar entries"
            icon={UserCheck}
            tone={pendingTotal > 0 ? "warning" : "positive"}
          />
        </div>
      ) : null}

      {/* Member's own position */}
      {!isManager && member ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Your position this month</CardTitle>
              <CardDescription>Meals you ate, money you deposited, and where you stand.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/m/${messId}/reports`}>
                Full breakdown
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {balances.isPending ? (
              <CardsSkeleton count={4} />
            ) : balances.isError ? (
              <ErrorState error={balances.error} onRetry={() => void balances.refetch()} compact />
            ) : myRow ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Meals eaten"
                  value={myRow.mealCount}
                  hint={
                    myCount ? `${myCount.breakfast} breakfast · ${myCount.lunch} lunch · ${myCount.dinner} dinner` : undefined
                  }
                  icon={Soup}
                />
                <StatCard label="Meal cost" value={<Money value={myRow.mealCostPoisha} />} icon={UtensilsCrossed} />
                <StatCard
                  label="Verified deposits"
                  value={<Money value={myRow.verifiedDepositsPoisha} />}
                  icon={PiggyBank}
                  tone="positive"
                />
                <StatCard
                  label={BigInt(myRow.balancePoisha) < 0n ? "You owe" : "Your credit"}
                  value={<Money value={myRow.balancePoisha} />}
                  hint={
                    BigInt(myRow.balancePoisha) < 0n
                      ? "Pay this to settle your share"
                      : "The mess owes you this amount"
                  }
                  icon={BigInt(myRow.balancePoisha) < 0n ? TrendingDown : TrendingUp}
                  tone={BigInt(myRow.balancePoisha) < 0n ? "negative" : "positive"}
                />
              </div>
            ) : (
              <EmptyState
                icon={CircleDollarSign}
                title="No activity recorded for you yet"
                description="Once your meals and deposits are recorded this month, your balance will appear here."
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's menu */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Today&apos;s menu</CardTitle>
              <CardDescription>{formatDate(today)} · Asia/Dhaka</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/m/${messId}/meals`}>
                Manage
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {menus.isPending ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : todayMenus.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No menu published for today"
                description="A manager can add the menu and any notice from the Meals page."
              />
            ) : (
              <ul className="space-y-3">
                {todayMenus.map((menu) => (
                  <li key={menu.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={menu.mealType} label={humanize(menu.mealType)} />
                    </div>
                    <p className="mt-2 text-sm">{menu.menuText}</p>
                    {menu.noticeText ? (
                      <p className="mt-1.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
                        {menu.noticeText}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Duties */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Bazar duty</CardTitle>
              <CardDescription>
                {isManager ? "Upcoming days for the whole mess" : "Your upcoming duty days"}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/m/${messId}/duties`}>
                Schedule
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {duties.isPending ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : (isManager ? upcoming : myUpcoming).length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={isManager ? "No duty schedule yet" : "You have no upcoming duty"}
                description={
                  isManager
                    ? "Generate a fair monthly roster from the Bazar duty page."
                    : "Your next shopping day will show up here once the roster is generated."
                }
              />
            ) : (
              <ul className="divide-y">
                {(isManager ? upcoming : myUpcoming).slice(0, 6).map((duty) => (
                  <li key={duty.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-muted-foreground" />
                      <span>{formatDateShort(duty.date)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="truncate text-muted-foreground">{duty.assigneeName ?? "Unassigned"}</span>
                      {duty.isManualOverride ? <Badge variant="outline">Manual</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verification queue (managers) */}
      {isManager ? (
        <Card>
          <CardHeader>
            <CardTitle>Needs verification</CardTitle>
            <CardDescription>Only verified deposits and approved expenses count in the official report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingTotal === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Nothing is waiting"
                description="All deposits, expenses and bazar entries for this month have been reviewed."
              />
            ) : (
              <>
                <QueueGroup
                  title="Deposits"
                  href={`/m/${messId}/deposits`}
                  loading={pendingDeposits.isPending}
                  total={pendingDeposits.data?.meta.total ?? 0}
                  rows={(pendingDeposits.data?.items ?? []).map((deposit) => ({
                    id: deposit.id,
                    primary: deposit.memberName ?? "Member",
                    secondary: `${humanize(deposit.method)}${deposit.reference ? ` · ${deposit.reference}` : ""}`,
                    amount: deposit.amountPoisha,
                    status: deposit.status,
                  }))}
                />
                <Separator />
                <QueueGroup
                  title="Expenses"
                  href={`/m/${messId}/expenses`}
                  loading={pendingExpenses.isPending}
                  total={pendingExpenses.data?.meta.total ?? 0}
                  rows={(pendingExpenses.data?.items ?? []).map((expense) => ({
                    id: expense.id,
                    primary: expense.description,
                    secondary: humanize(expense.category),
                    amount: expense.amountPoisha,
                    status: expense.status,
                  }))}
                />
                <Separator />
                <QueueGroup
                  title="Bazar entries"
                  href={`/m/${messId}/bazar`}
                  loading={pendingBazar.isPending}
                  total={pendingBazar.data?.meta.total ?? 0}
                  rows={(pendingBazar.data?.items ?? []).map((entry) => ({
                    id: entry.id,
                    primary: entry.shopName ?? "Bazar purchase",
                    secondary: `${entry.buyerName ?? "Buyer"} · ${formatDateShort(entry.purchaseDate)}`,
                    amount: entry.totalPoisha,
                    status: entry.status,
                  }))}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Monthly meal timeline (managers) */}
      {isManager ? (
        <MonthlyMealTimeline
          messId={messId}
          monthId={activeMonth.id}
          monthLabel={activeMonth.label}
          daysInMonth={activeMonth.daysInMonth ?? 30}
          isManager={Boolean(isManager)}
          monthClosed={activeMonth.status === "CLOSED"}
          timeline={timeline.data ?? []}
          timelinePending={timeline.isPending}
          timelineError={timeline.error}
          onRetry={() => void timeline.refetch()}
          members={(membersData?.items ?? []).map((item) => ({ id: item.id, name: item.displayName ?? item.name }))}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: qk.mealTimeline(messId, activeMonth.id) });
            void queryClient.invalidateQueries({ queryKey: qk.mealCounts(messId, activeMonth.id) });
            void queryClient.invalidateQueries({ queryKey: qk.summary(messId, activeMonth.id) });
            void queryClient.invalidateQueries({ queryKey: qk.balances(messId, activeMonth.id) });
          }}
        />
      ) : null}

      {/* Balances table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Member balances</CardTitle>
            <CardDescription>
              Deposits − meal cost − allocated charges. Negative means the member owes the mess.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/m/${messId}/reports`}>
              Full report
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {balances.isPending ? (
            <div className="px-5">
              <TableSkeleton columns={6} rows={5} />
            </div>
          ) : balances.isError ? (
            <div className="px-5">
              <ErrorState error={balances.error} onRetry={() => void balances.refetch()} compact />
            </div>
          ) : (balances.data?.members ?? []).length === 0 ? (
            <div className="px-5">
              <EmptyState icon={Users} title="No member activity this month yet" />
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
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balances.data?.members ?? []).map((row) => {
                  const isMe = member?.id === row.memberId;
                  return (
                    <TableRow key={row.memberId} className={isMe ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{row.memberName ?? "Member"}</span>
                          {isMe ? <Badge variant="secondary">You</Badge> : null}
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
                        <Money value={row.balancePoisha} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface QueueRow {
  id: string;
  primary: string;
  secondary: string;
  amount: string;
  status: string;
}

function QueueGroup({
  title,
  href,
  loading,
  total,
  rows,
}: {
  title: string;
  href: string;
  loading: boolean;
  total: number;
  rows: QueueRow[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {title}
          {total > 0 ? <span className="ml-2 text-muted-foreground">({total})</span> : null}
        </p>
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>
            Review
            <ArrowRight />
          </Link>
        </Button>
      </div>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Nothing pending.</p>
      ) : (
        <ul className="mt-1 divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.primary}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.secondary}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Money value={row.amount} compact />
                <StatusBadge status={row.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
