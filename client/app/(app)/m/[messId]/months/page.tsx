"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CalendarRange, Lock, LockOpen, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { BlockSkeleton } from "@/components/shared/skeletons";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { monthsApi } from "@/lib/api/endpoints";
import type { MessMonth, MealSetting, MealType } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDate, humanize, monthLabelLong, todayInDhaka } from "@/lib/format";
import { qk, useMonths } from "@/lib/hooks/queries";
import { useMyMembership } from "@/lib/hooks/use-my-membership";

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];

export default function MonthsPage() {
  const { messId } = useParams<{ messId: string }>();
  const { isManager, isPending: membershipPending } = useMyMembership(messId);
  const monthsQuery = useMonths(messId);
  const { activeMonth, setActiveMonthId } = useActiveMonth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!membershipPending && !isManager) {
    return (
      <div className="space-y-5">
        <PageHeader title="Months & settings" description="Each month holds its own meals, budgets and totals." />
        <Alert variant="warning">
          <TriangleAlert />
          <div>
            <AlertTitle>Managers only</AlertTitle>
            <AlertDescription>
              Only mess managers can create months or change their settings.
            </AlertDescription>
          </div>
        </Alert>
      </div>
    );
  }

  const months = monthsQuery.data ?? [];
  const selected = months.find((month) => month.id === selectedId) ?? activeMonth ?? months[0] ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Months & settings"
        description="Every month has its own opening cash, budget and meal rules. Close a month when it is settled."
        actions={<NewMonthDialog messId={messId} existing={months} />}
      />

      {monthsQuery.isPending ? (
        <BlockSkeleton className="h-64 rounded-xl" />
      ) : monthsQuery.isError ? (
        <ErrorState error={monthsQuery.error} onRetry={() => void monthsQuery.refetch()} />
      ) : months.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarRange className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">No months yet</p>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Create the first month to start recording meals, bazar, deposits and expenses.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Months</CardTitle>
              <CardDescription>{months.length} month(s) recorded</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 px-2 pb-3">
              {months.map((month) => {
                const isSelected = selected?.id === month.id;
                return (
                  <button
                    key={month.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(month.id);
                      setActiveMonthId(month.id);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isSelected ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
                    }`}
                  >
                    <span>{monthLabelLong(month.year, month.month)}</span>
                    <StatusBadge status={month.status} />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {selected ? <MonthDetail messId={messId} monthId={selected.id} /> : null}
        </div>
      )}
    </div>
  );
}

function MonthDetail({ messId, monthId }: { messId: string; monthId: string }) {
  const queryClient = useQueryClient();
  const { setActiveMonthId } = useActiveMonth();
  const detail = useQuery({
    queryKey: qk.month(messId, monthId),
    queryFn: () => monthsApi.get(messId, monthId),
  });

  const [openingCash, setOpeningCash] = useState("");
  const [budget, setBudget] = useState("");

  const month = detail.data;

  useEffect(() => {
    if (month) {
      setOpeningCash(poishaToTaka(month.openingCashPoisha));
      setBudget(poishaToTaka(month.budgetPoisha));
    }
  }, [month]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: qk.months(messId) });
    void queryClient.invalidateQueries({ queryKey: qk.month(messId, monthId) });
    void queryClient.invalidateQueries({ queryKey: qk.mealCounts(messId, monthId) });
    void queryClient.invalidateQueries({ queryKey: qk.summary(messId, monthId) });
    void queryClient.invalidateQueries({ queryKey: qk.report(messId, monthId) });
    void queryClient.invalidateQueries({ queryKey: qk.balances(messId, monthId) });
  };

  const update = useMutation({
    mutationFn: () => monthsApi.update(messId, monthId, { openingCashTaka: openingCash || "0", budgetTaka: budget || "0" }),
    onSuccess: () => {
      toast.success("Month updated");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the month"),
  });

  const setStatus = useMutation({
    mutationFn: (next: "close" | "reopen") =>
      next === "close" ? monthsApi.close(messId, monthId) : monthsApi.reopen(messId, monthId),
    onSuccess: (_data, next) => {
      toast.success(next === "close" ? "Month closed" : "Month reopened");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not change the month status"),
  });

  if (detail.isPending) return <BlockSkeleton className="h-96 rounded-xl" />;
  if (detail.isError || !month) {
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  }

  const closed = month.status === "CLOSED";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Opening cash"
          value={<Money value={month.openingCashPoisha} />}
          icon={CalendarRange}
          hint="Cash carried into this month"
        />
        <StatCard label="Budget" value={<Money value={month.budgetPoisha} />} hint="Planned spending for the month" />
        <StatCard label="Days in month" value={month.daysInMonth} hint={monthLabelLong(month.year, month.month)} />
        <StatCard
          label="Status"
          value={<StatusBadge status={month.status} />}
          hint={month.closedAt ? `Closed ${formatDate(month.closedAt.slice(0, 10))}` : "Open for changes"}
        />
      </div>

      {closed ? (
        <Alert variant="info">
          <Lock />
          <div>
            <AlertTitle>This month is closed</AlertTitle>
            <AlertDescription>
              Meal entries and settings are locked. The final meal count, meal rate and member totals are available in
              the monthly report.
            </AlertDescription>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href={`/m/${messId}/reports`} onClick={() => setActiveMonthId(monthId)}>
                View monthly report
              </Link>
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Opening cash & budget</CardTitle>
          <CardDescription>Amounts are in taka. The meal rate uses approved meal expenses ÷ total meals.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate();
            }}
          >
            <div className="w-full space-y-2 sm:max-w-48">
              <Label htmlFor="opening-cash">Opening cash (৳)</Label>
              <Input
                id="opening-cash"
                inputMode="decimal"
                value={openingCash}
                disabled={closed}
                onChange={(event) => setOpeningCash(event.target.value)}
              />
            </div>
            <div className="w-full space-y-2 sm:max-w-48">
              <Label htmlFor="budget">Budget (৳)</Label>
              <Input
                id="budget"
                inputMode="decimal"
                value={budget}
                disabled={closed}
                onChange={(event) => setBudget(event.target.value)}
              />
            </div>
            <Button type="submit" loading={update.isPending} disabled={closed}>
              <Save />
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meal settings</CardTitle>
          <CardDescription>
            Enabled meals count only when explicitly marked on. Members can change meals until the cut-off (Dhaka time).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meal</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Cut-off</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(month.mealSettings ?? []).map((setting) => (
                <MealSettingRow
                  key={setting.id}
                  messId={messId}
                  monthId={monthId}
                  setting={setting}
                  closed={closed}
                  onSaved={invalidate}
                />
              ))}
              {(month.mealSettings ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    No meal settings recorded for this month.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Month status</CardTitle>
          <CardDescription>
            Closing locks meal entries and settings so the report shows final meal counts and member totals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {closed ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <LockOpen />
                  Reopen month
                </Button>
              }
              title={`Reopen ${monthLabelLong(month.year, month.month)}?`}
              description="Managers will be able to add or change records again. The report will use live data."
              confirmLabel="Reopen"
              pending={setStatus.isPending}
              onConfirm={() => setStatus.mutate("reopen")}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="outline">
                  <Lock />
                  Close month
                </Button>
              }
              title={`Close ${monthLabelLong(month.year, month.month)}?`}
              description="Meal, bazar, deposit, expense and setting changes will be locked. Review the final meal count, rate and member totals in Reports."
              confirmLabel="Close month"
              pending={setStatus.isPending}
              onConfirm={() => setStatus.mutate("close")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MealSettingRow({
  messId,
  monthId,
  setting,
  closed,
  onSaved,
}: {
  messId: string;
  monthId: string;
  setting: MealSetting;
  closed: boolean;
  onSaved: () => void;
}) {
  const [cutoff, setCutoff] = useState(setting.cutoff);

  useEffect(() => setCutoff(setting.cutoff), [setting.cutoff]);

  const update = useMutation({
    mutationFn: (body: { enabled?: boolean; cutoff?: string }) =>
      monthsApi.updateMealSetting(messId, monthId, setting.mealType, body),
    onSuccess: () => {
      toast.success(`${humanize(setting.mealType)} updated`);
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the meal setting"),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{humanize(setting.mealType)}</TableCell>
      <TableCell>
        <Switch
          checked={setting.enabled}
          disabled={closed || update.isPending}
          onCheckedChange={(value) => update.mutate({ enabled: value })}
          aria-label={`${humanize(setting.mealType)} enabled`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="time"
          className="h-8 w-32"
          value={cutoff}
          disabled={closed || update.isPending}
          onChange={(event) => setCutoff(event.target.value)}
          onBlur={() => {
            if (cutoff && cutoff !== setting.cutoff) update.mutate({ cutoff });
          }}
          aria-label={`${humanize(setting.mealType)} cut-off time`}
        />
      </TableCell>
    </TableRow>
  );
}

function NewMonthDialog({ messId, existing }: { messId: string; existing: MessMonth[] }) {
  const queryClient = useQueryClient();
  const { setActiveMonthId } = useActiveMonth();
  const [open, setOpen] = useState(false);
  const today = todayInDhaka();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [openingCash, setOpeningCash] = useState("0");
  const [budget, setBudget] = useState("0");
  const [enabled, setEnabled] = useState<Record<MealType, boolean>>({
    BREAKFAST: true,
    LUNCH: true,
    DINNER: true,
  });
  const create = useMutation({
    mutationFn: () =>
      monthsApi.create(messId, {
        year,
        month,
        openingCashTaka: openingCash || "0",
        budgetTaka: budget || "0",
        mealSettings: MEAL_TYPES.map((mealType) => ({
          mealType,
          enabled: enabled[mealType],
        })),
      }),
    onSuccess: (created) => {
      toast.success(`${monthLabelLong(created.year, created.month)} created`);
      void queryClient.invalidateQueries({ queryKey: qk.months(messId) });
      setActiveMonthId(created.id);
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create the month"),
  });

  const duplicate = existing.some((item) => item.year === year && item.month === month);
  const yearValid = Number.isInteger(year) && year >= 2000 && year <= 2200;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus />
          New month
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a month</DialogTitle>
          <DialogDescription>
            Each month gets its own meal settings, opening cash and budget.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-month-year">Year</Label>
              <Input
                id="new-month-year"
                type="number"
                min={2000}
                max={2200}
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {monthLabelLong(2000, value).split(" ")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {duplicate ? (
            <Alert variant="warning">
              <TriangleAlert />
              <div>
                <AlertTitle>Already exists</AlertTitle>
                <AlertDescription>{monthLabelLong(year, month)} already has an entry for this mess.</AlertDescription>
              </div>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-opening-cash">Opening cash (৳)</Label>
              <Input
                id="new-opening-cash"
                inputMode="decimal"
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-budget">Budget (৳)</Label>
              <Input
                id="new-budget"
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meals counted this month</Label>
            <div className="divide-y rounded-lg border">
              {MEAL_TYPES.map((mealType) => (
                <div key={mealType} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm font-medium">{humanize(mealType)}</span>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={enabled[mealType]}
                        onCheckedChange={(value) => setEnabled((prev) => ({ ...prev, [mealType]: value }))}
                        aria-label={`${humanize(mealType)} enabled`}
                      />
                      Enabled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={duplicate || !yearValid} onClick={() => create.mutate()}>
            <CalendarPlus />
            Create month
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "1234500" poisha → "12345" taka for a plain text input (no ৳, no grouping). */
function poishaToTaka(poisha: string): string {
  const value = BigInt(poisha);
  const taka = value / 100n;
  const paisa = value % 100n;
  return paisa === 0n ? taka.toString() : `${taka.toString()}.${paisa.toString().padStart(2, "0")}`;
}
