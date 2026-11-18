"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Info, Plus, Soup, Trash2, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { NoMonthState } from "@/components/shared/no-month";
import { PageHeader } from "@/components/shared/page-header";
import { CardsSkeleton, TableSkeleton } from "@/components/shared/skeletons";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { mealsApi, menusApi } from "@/lib/api/endpoints";
import type { MealRecord, MealType, MemberMealCount, MemberMealTimeline, MemberMealTimelineDay } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDate, humanize, todayInDhaka } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";
import { QUERY_CACHE } from "@/lib/query-cache";

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];

type OnOff = "ON" | "OFF";

function recordKey(memberId: string, mealType: MealType): string {
  return `${memberId}:${mealType}`;
}

function guestCountFor(day: MemberMealTimelineDay | undefined, mealType: MealType): number {
  if (!day) return 0;
  if (mealType === "BREAKFAST") return day.breakfastGuests;
  if (mealType === "LUNCH") return day.lunchGuests;
  return day.dinnerGuests;
}

export default function MealsPage() {
  const { messId } = useParams<{ messId: string }>();
  const queryClient = useQueryClient();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const [date, setDate] = useState<string>(todayInDhaka());

  const { member, isManager, data: membersData, isPending: memberPending } = useMyMembership(messId);

  const dayStatus = useQuery({
    queryKey: qk.mealStatus(messId, date),
    queryFn: () => mealsApi.dayStatus(messId, date),
    enabled: Boolean(activeMonth),
    staleTime: QUERY_CACHE.liveStaleTime,
  });

  const records = useQuery({
    queryKey: qk.mealRecords(messId, { date }),
    queryFn: () => mealsApi.records(messId, { date, pageSize: 100 }),
    enabled: Boolean(activeMonth),
    staleTime: QUERY_CACHE.liveStaleTime,
  });

  const counts = useQuery({
    queryKey: qk.mealCounts(messId, monthId ?? "none"),
    queryFn: () => mealsApi.counts(messId, monthId as string),
    enabled: Boolean(monthId),
    staleTime: QUERY_CACHE.liveStaleTime,
  });

  const timeline = useQuery({
    queryKey: qk.mealTimeline(messId, monthId ?? "none"),
    queryFn: () => mealsApi.timeline(messId, monthId as string),
    enabled: Boolean(monthId),
    staleTime: QUERY_CACHE.liveStaleTime,
  });

  const menus = useQuery({
    queryKey: qk.menus(messId, { monthId }),
    queryFn: () => menusApi.list(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
  });

  /** Saved status per member+meal for the selected date. */
  const recordMap = useMemo(() => {
    const map = new Map<string, MealRecord>();
    for (const record of records.data?.items ?? []) map.set(recordKey(record.memberId, record.mealType), record);
    return map;
  }, [records.data]);

  const settingsByType = useMemo(() => {
    const map = new Map<MealType, { enabled: boolean; closed: boolean; cutoff: string }>();
    for (const setting of dayStatus.data?.settings ?? []) map.set(setting.mealType, setting);
    return map;
  }, [dayStatus.data]);

  const baseStatus = (memberId: string, mealType: MealType): OnOff => {
    const saved = recordMap.get(recordKey(memberId, mealType));
    return saved?.status === "ON" ? "ON" : "OFF";
  };

  const invalidateMealData = () => {
    void queryClient.invalidateQueries({ queryKey: qk.mealRecords(messId, { date }) });
    if (monthId) {
      void queryClient.invalidateQueries({ queryKey: qk.mealCounts(messId, monthId) });
      void queryClient.invalidateQueries({ queryKey: qk.mealTimeline(messId, monthId) });
      void queryClient.invalidateQueries({ queryKey: qk.summary(messId, monthId) });
      void queryClient.invalidateQueries({ queryKey: qk.balances(messId, monthId) });
      void queryClient.invalidateQueries({ queryKey: qk.report(messId, monthId) });
    }
  };

  const setOwn = useMutation({
    mutationFn: (body: { mealType: MealType; status: OnOff }) => mealsApi.setRecord(messId, { date, ...body }),
    onSuccess: () => invalidateMealData(),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your meal"),
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meals & menu" description="Meals are recorded against the current month." />
        {memberPending ? <CardsSkeleton count={3} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="Meals" />}
      </div>
    );
  }

  const activeMembers = membersData?.items ?? [];
  const menusByDate = [...(menus.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const monthClosed = activeMonth.status === "CLOSED";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Meals & menu"
        description={`Record the meals actually eaten in ${activeMonth.label}. New meals start off until marked on.`}
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="meal-date" className="text-xs text-muted-foreground">
              Date
            </Label>
            <Input
              id="meal-date"
              type="date"
              value={date}
              max={todayInDhaka()}
              onChange={(event) => setDate(event.target.value)}
              className="w-40"
            />
          </div>
        }
      />

      {dayStatus.isError ? <ErrorState error={dayStatus.error} onRetry={() => void dayStatus.refetch()} /> : null}

      {/* Member self-service */}
      {!isManager ? (
        member ? (
          <Card>
            <CardHeader>
              <CardTitle>Your meals on {formatDate(date)}</CardTitle>
              <CardDescription>
                Turn meals on or off before the cut-off (Dhaka time). After it, ask a manager to change them.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {MEAL_TYPES.map((mealType) => {
                const setting = settingsByType.get(mealType);
                const enabled = setting?.enabled ?? true;
                const closed = setting?.closed ?? false;
                const current = baseStatus(member.id, mealType);
                const disabled = !enabled || closed || monthClosed || setOwn.isPending;
                return (
                  <div key={mealType} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{humanize(mealType)}</p>
                      <StatusBadge status={current} label={current === "ON" ? "On" : "Off"} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {monthClosed
                        ? "Month closed"
                        : enabled
                          ? closed
                            ? `Cut-off passed (${setting?.cutoff} Dhaka time)`
                            : `Cut-off ${setting?.cutoff} Dhaka time`
                          : "Disabled this month"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant={current === "ON" ? "default" : "outline"}
                        disabled={disabled}
                        onClick={() => setOwn.mutate({ mealType, status: "ON" })}
                      >
                        On
                      </Button>
                      <Button
                        size="sm"
                        variant={current === "OFF" ? "default" : "outline"}
                        disabled={disabled}
                        onClick={() => setOwn.mutate({ mealType, status: "OFF" })}
                      >
                        Off
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <EmptyState icon={Soup} title="Could not find your membership in this mess" />
        )
      ) : null}

      {/* Manager daily entry */}
      {isManager ? (
        <ManagerDayEntry
          messId={messId}
          date={date}
          timeline={timeline.data ?? []}
          members={activeMembers.map((item) => ({ id: item.id, name: item.displayName ?? item.name }))}
          baseStatus={baseStatus}
          settingsByType={settingsByType}
          monthClosed={monthClosed}
          loading={records.isPending || dayStatus.isPending}
          onSaved={invalidateMealData}
        />
      ) : null}

      <MonthlyMealTimeline
        messId={messId}
        monthId={activeMonth.id}
        monthLabel={activeMonth.label}
        daysInMonth={activeMonth.daysInMonth}
        isManager={Boolean(isManager)}
        monthClosed={monthClosed}
        timeline={timeline.data ?? []}
        timelinePending={timeline.isPending}
        timelineError={timeline.error}
        onRetry={() => void timeline.refetch()}
        counts={counts.data ?? []}
        members={activeMembers.map((item) => ({ id: item.id, name: item.displayName ?? item.name }))}
        onSaved={invalidateMealData}
      />

      {/* Menus */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Menu & notice</CardTitle>
            <CardDescription>What is being cooked each day, plus any notice for the members.</CardDescription>
          </div>
          {isManager ? <MenuDialog messId={messId} monthId={monthId as string} /> : null}
        </CardHeader>
        <CardContent>
          {menus.isPending ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : menusByDate.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No menu published this month"
              description={isManager ? "Add a menu so members know what to expect." : "A manager has not published the menu yet."}
            />
          ) : (
            <ul className="divide-y">
              {menusByDate.map((menu) => (
                <li key={menu.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatDate(menu.date)}</span>
                      <StatusBadge status={menu.mealType} label={humanize(menu.mealType)} />
                    </div>
                    <p className="mt-1 text-sm">{menu.menuText}</p>
                    {menu.noticeText ? (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-warning-foreground">
                        <Info className="mt-0.5 size-3.5 shrink-0" />
                        {menu.noticeText}
                      </p>
                    ) : null}
                  </div>
                  {isManager ? <DeleteMenuButton messId={messId} menuId={menu.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Manager daily entry                                                        */
/* -------------------------------------------------------------------------- */

function ManagerDayEntry({
  messId,
  date,
  timeline,
  members,
  baseStatus,
  settingsByType,
  monthClosed,
  loading,
  onSaved,
}: {
  messId: string;
  date: string;
  timeline: MemberMealTimeline[];
  members: { id: string; name: string }[];
  baseStatus: (memberId: string, mealType: MealType) => OnOff;
  settingsByType: Map<MealType, { enabled: boolean; closed: boolean; cutoff: string }>;
  monthClosed: boolean;
  loading: boolean;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<MealType>("LUNCH");
  const [draft, setDraft] = useState<Record<string, OnOff>>({});
  const [reason, setReason] = useState("");
  const [guestMemberId, setGuestMemberId] = useState("");
  const [guestMealType, setGuestMealType] = useState<MealType>("LUNCH");
  const [guestCountInput, setGuestCountInput] = useState("0");
  const [guestCountDirty, setGuestCountDirty] = useState(false);
  const guestSelectionKey = `${date}:${guestMemberId}:${guestMealType}`;
  const previousGuestSelectionKey = useRef(guestSelectionKey);

  // Reset local edits whenever the date or meal type changes.
  useEffect(() => {
    setDraft({});
    setReason("");
  }, [date, mealType]);

  useEffect(() => {
    if (!members.some((entry) => entry.id === guestMemberId)) {
      setGuestMemberId(members[0]?.id ?? "");
    }
  }, [guestMemberId, members]);

  useEffect(() => {
    const memberTimeline = timeline.find((item) => item.memberId === guestMemberId);
    const day = memberTimeline?.days.find((item) => item.date === date);
    const selectionChanged = previousGuestSelectionKey.current !== guestSelectionKey;
    if (selectionChanged) {
      previousGuestSelectionKey.current = guestSelectionKey;
      setGuestCountDirty(false);
    }
    if (selectionChanged || !guestCountDirty) {
      setGuestCountInput(String(guestCountFor(day, guestMealType)));
    }
  }, [date, guestMealType, guestMemberId, guestSelectionKey, guestCountDirty, timeline]);

  const setting = settingsByType.get(mealType);
  const enabled = setting?.enabled ?? true;

  const effective = (memberId: string): OnOff => draft[memberId] ?? baseStatus(memberId, mealType);

  const save = useMutation({
    mutationFn: async () => {
      const onIds: string[] = [];
      const offIds: string[] = [];
      for (const entry of members) {
        if (effective(entry.id) === "ON") onIds.push(entry.id);
        else offIds.push(entry.id);
      }
      const trimmed = reason.trim();
      if (onIds.length > 0) {
        await mealsApi.bulk(messId, { memberIds: onIds, date, mealType, status: "ON", reason: trimmed || undefined });
      }
      if (offIds.length > 0) {
        await mealsApi.bulk(messId, { memberIds: offIds, date, mealType, status: "OFF", reason: trimmed || undefined });
      }
      return { count: onIds.length + offIds.length };
    },
    onSuccess: (result) => {
      toast.success(`Saved ${result.count} meal record(s)`);
      setDraft({});
      setReason("");
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save meal records"),
  });

  const guestCount = Number(guestCountInput);
  const guestCountValid = Number.isInteger(guestCount) && guestCount >= 0 && guestCount <= 50;
  const saveGuestMeals = useMutation({
    mutationFn: () =>
      mealsApi.setGuestMeals(messId, {
        memberId: guestMemberId,
        date,
        mealType: guestMealType,
        guestCount,
      }),
    onSuccess: (record) => {
      toast.success(`Saved ${record.guestCount} guest meal(s)`);
      setGuestCountDirty(false);
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save guest meals"),
  });

  const onCount = members.filter((entry) => effective(entry.id) === "ON").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily meal entry</CardTitle>
        <CardDescription>
          {monthClosed
            ? "This month is closed. Reopen it under Months & settings to correct meal records."
            : `Record who is eating on ${formatDate(date)}. Counts update instantly for the report.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
          <TabsList>
            {MEAL_TYPES.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                disabled={monthClosed || !(settingsByType.get(type)?.enabled ?? true)}
              >
                {humanize(type)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {!enabled ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {humanize(mealType)} is disabled for this month (change it under Months &amp; settings).
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={monthClosed || loading || save.isPending || members.length === 0}
            onClick={() => setDraft(Object.fromEntries(members.map((entry) => [entry.id, "ON" as OnOff])))}
          >
            All on
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={monthClosed || loading || save.isPending || members.length === 0}
            onClick={() => setDraft(Object.fromEntries(members.map((entry) => [entry.id, "OFF" as OnOff])))}
          >
            All off
          </Button>
          <span className="text-sm text-muted-foreground">{onCount} eating</span>
          <Link href={`/m/${messId}/months`} className="text-sm text-primary underline-offset-4 hover:underline">
            Meal settings
          </Link>
        </div>

        {loading ? (
          <TableSkeleton columns={2} rows={4} />
        ) : members.length === 0 ? (
          <EmptyState icon={Soup} title="No active members to record" />
        ) : (
          <ul className="divide-y rounded-lg border">
            {members.map((entry) => {
              const value = effective(entry.id);
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate text-sm font-medium">{entry.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={value === "ON" ? "default" : "outline"}
                      disabled={monthClosed || !enabled || save.isPending}
                      onClick={() => setDraft((prev) => ({ ...prev, [entry.id]: "ON" }))}
                    >
                      On
                    </Button>
                    <Button
                      size="sm"
                      variant={value === "OFF" ? "default" : "outline"}
                      disabled={monthClosed || !enabled || save.isPending}
                      onClick={() => setDraft((prev) => ({ ...prev, [entry.id]: "OFF" }))}
                    >
                      Off
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="bulk-reason">Reason for manual changes (optional)</Label>
          <Input
            id="bulk-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Correcting the meal list"
            autoComplete="off"
          />
        </div>

        <div className="flex justify-end">
          <Button
            loading={save.isPending}
            disabled={monthClosed || !enabled || members.length === 0}
            onClick={() => save.mutate()}
          >
            Save {humanize(mealType)} records
          </Button>
        </div>

        <section className="space-y-3 rounded-lg border bg-muted/10 p-4" aria-labelledby="guest-meals-title">
          <div>
            <h3 id="guest-meals-title" className="font-semibold">Guest meals</h3>
            <p className="text-sm text-muted-foreground">
              Assign today&apos;s guest meals to a member and meal. Guests are included in that member&apos;s meal count.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8rem_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="guest-meal-member">Member</Label>
              <Select value={guestMemberId} onValueChange={setGuestMemberId} disabled={members.length === 0}>
                <SelectTrigger id="guest-meal-member">
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-meal-type">Meal</Label>
              <Select value={guestMealType} onValueChange={(value) => setGuestMealType(value as MealType)}>
                <SelectTrigger id="guest-meal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{humanize(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-meal-count">Guests</Label>
              <Input
                id="guest-meal-count"
                type="number"
                min={0}
                max={50}
                step={1}
                value={guestCountInput}
                onChange={(event) => {
                  setGuestCountDirty(true);
                  setGuestCountInput(event.target.value);
                }}
              />
            </div>
            <Button
              type="button"
              className="w-full lg:w-auto"
              loading={saveGuestMeals.isPending}
              disabled={
                monthClosed ||
                loading ||
                saveGuestMeals.isPending ||
                !guestMemberId ||
                !guestCountValid ||
                !(settingsByType.get(guestMealType)?.enabled ?? true)
              }
              onClick={() => saveGuestMeals.mutate()}
            >
              Save guests
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Month timeline and manual month editor                                     */
/* -------------------------------------------------------------------------- */

const MEAL_ON_FIELDS: Record<MealType, keyof MemberMealTimelineDay> = {
  BREAKFAST: "breakfastOn",
  LUNCH: "lunchOn",
  DINNER: "dinnerOn",
};

function MonthlyMealTimeline({
  messId,
  monthId,
  monthLabel,
  daysInMonth,
  isManager,
  monthClosed,
  timeline,
  timelinePending,
  timelineError,
  onRetry,
  counts,
  members,
  onSaved,
}: {
  messId: string;
  monthId: string;
  monthLabel: string;
  daysInMonth: number;
  isManager: boolean;
  monthClosed: boolean;
  timeline: MemberMealTimeline[];
  timelinePending: boolean;
  timelineError: Error | null;
  onRetry: () => void;
  counts: MemberMealCount[];
  members: { id: string; name: string }[];
  onSaved: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Monthly meal timeline — {monthLabel}</CardTitle>
          <CardDescription>
            Daily breakfast, lunch, and dinner totals for each member. Guest meals are included.
          </CardDescription>
        </div>
        {isManager ? (
          <MonthMealEditor
            messId={messId}
            monthId={monthId}
            monthLabel={monthLabel}
            monthClosed={monthClosed}
            members={members}
            timeline={timeline}
            timelinePending={timelinePending}
            onSaved={onSaved}
          />
        ) : null}
      </CardHeader>
      <CardContent>
        {timelinePending ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1].map((item) => <div key={item} className="h-72 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : timelineError ? (
          <ErrorState error={timelineError} onRetry={onRetry} compact />
        ) : timeline.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title="No monthly meal timeline yet" />
        ) : (
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {timeline.map((memberTimeline) => {
              const count = counts.find((row) => row.memberId === memberTimeline.memberId);
              const totals = memberTimeline.days.reduce(
                (sum, point) => ({
                  breakfast: sum.breakfast + point.breakfast,
                  lunch: sum.lunch + point.lunch,
                  dinner: sum.dinner + point.dinner,
                  guests:
                    sum.guests +
                    point.breakfastGuests +
                    point.lunchGuests +
                    point.dinnerGuests,
                }),
                { breakfast: 0, lunch: 0, dinner: 0, guests: 0 },
              );
              const mealTotals = count ?? {
                ...totals,
                memberId: memberTimeline.memberId,
                total: totals.breakfast + totals.lunch + totals.dinner,
                guestMeals: totals.guests,
                activeDays: 0,
              };
              const tickInterval = Math.max(0, Math.ceil(daysInMonth / 7) - 1);

              return (
                <Card key={memberTimeline.memberId} className="min-w-0 overflow-hidden">
                  <CardHeader className="gap-2 pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{memberTimeline.memberName}</CardTitle>
                      <Badge variant="secondary">{mealTotals.total} meals</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Breakfast {mealTotals.breakfast}</span>
                      <span>Lunch {mealTotals.lunch}</span>
                      <span>Dinner {mealTotals.dinner}</span>
                      <span className="font-medium text-primary">{mealTotals.guestMeals} guest meals</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 min-w-0 w-full sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={memberTimeline.days} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="day"
                            type="number"
                            domain={[1, daysInMonth]}
                            allowDecimals={false}
                            interval={tickInterval}
                            minTickGap={12}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis allowDecimals={false} width={34} tick={{ fontSize: 11 }} />
                          <Tooltip
                            labelFormatter={(value) => `${monthLabel} · day ${value}`}
                            formatter={(value, name) => [`${value} meals`, name]}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Line
                            type="monotone"
                            dataKey="breakfast"
                            name="Breakfast"
                            stroke="var(--color-chart-1)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="lunch"
                            name="Lunch"
                            stroke="var(--color-chart-2)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="dinner"
                            name="Dinner"
                            stroke="var(--color-chart-3)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MonthMealEditor({
  messId,
  monthId,
  monthLabel,
  monthClosed,
  members,
  timeline,
  timelinePending,
  onSaved,
}: {
  messId: string;
  monthId: string;
  monthLabel: string;
  monthClosed: boolean;
  members: { id: string; name: string }[];
  timeline: MemberMealTimeline[];
  timelinePending: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [draft, setDraft] = useState<Record<string, OnOff>>({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!members.some((entry) => entry.id === memberId)) setMemberId(members[0]?.id ?? "");
  }, [memberId, members]);

  useEffect(() => {
    setDraft({});
    setReason("");
  }, [memberId, open]);

  const selectedMember = timeline.find((item) => item.memberId === memberId);
  const changedRecords = useMemo(() => {
    if (!selectedMember) return [];
    const changed: { date: string; mealType: MealType; status: OnOff }[] = [];

    for (const point of selectedMember.days) {
      for (const mealType of MEAL_TYPES) {
        const key = `${point.day}:${mealType}`;
        const original = point[MEAL_ON_FIELDS[mealType]] ? "ON" : "OFF";
        const status = draft[key] ?? original;
        if (status !== original) changed.push({ date: point.date, mealType, status });
      }
    }

    return changed;
  }, [draft, selectedMember]);

  const save = useMutation({
    mutationFn: () =>
      mealsApi.overrideMonth(messId, {
        monthId,
        memberId,
        records: changedRecords,
        reason: reason.trim(),
      }),
    onSuccess: (result) => {
      toast.success(`Updated ${result.updated} meal record(s)`);
      setOpen(false);
      onSaved();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update monthly meals"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={monthClosed || members.length === 0}>
          <CalendarDays />
          Edit full month
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit meals for {monthLabel}</DialogTitle>
          <DialogDescription>
            Choose a member, then change any meal for any day. Guest counts are kept as entered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="month-meal-member">Member</Label>
          <Select
            value={memberId}
            onValueChange={(value) => {
              setMemberId(value);
              setDraft({});
              setReason("");
            }}
            disabled={members.length === 0}
          >
            <SelectTrigger id="month-meal-member">
              <SelectValue placeholder="Choose a member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {timelinePending ? (
          <TableSkeleton columns={4} rows={6} />
        ) : !selectedMember ? (
          <EmptyState icon={UtensilsCrossed} title="No meal records available for this member" />
        ) : (
          <div className="max-h-[48dvh] overflow-auto rounded-md border">
            <Table className="min-w-[34rem]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Day</TableHead>
                  {MEAL_TYPES.map((mealType) => (
                    <TableHead key={mealType} className="text-center">{humanize(mealType)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedMember.days.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell className="whitespace-nowrap text-xs font-medium">{formatDate(point.date)}</TableCell>
                    {MEAL_TYPES.map((mealType) => {
                      const key = `${point.day}:${mealType}`;
                      const current =
                        draft[key] ?? (point[MEAL_ON_FIELDS[mealType]] ? "ON" : "OFF");
                      return (
                        <TableCell key={mealType} className="text-center">
                          <Button
                            size="sm"
                            variant={current === "ON" ? "default" : "outline"}
                            className="w-14"
                            aria-label={`${formatDate(point.date)} ${humanize(mealType)} ${current}`}
                            onClick={() =>
                              setDraft((previous) => ({
                                ...previous,
                                [key]: current === "ON" ? "OFF" : "ON",
                              }))
                            }
                          >
                            {current === "ON" ? "On" : "Off"}
                          </Button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="month-meal-reason">Reason for changes</Label>
          <Input
            id="month-meal-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Correcting the monthly meal entries"
            maxLength={300}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            loading={save.isPending}
            disabled={monthClosed || timelinePending || !memberId || changedRecords.length === 0 || reason.trim().length < 2}
            onClick={() => save.mutate()}
          >
            Save {changedRecords.length} change(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Menu upsert / delete                                                       */
/* -------------------------------------------------------------------------- */

function MenuDialog({ messId, monthId }: { messId: string; monthId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInDhaka());
  const [mealType, setMealType] = useState<MealType>("LUNCH");
  const [menuText, setMenuText] = useState("");
  const [noticeText, setNoticeText] = useState("");

  const upsert = useMutation({
    mutationFn: () =>
      menusApi.upsert(messId, {
        monthId,
        date,
        mealType,
        menuText: menuText.trim(),
        noticeText: noticeText.trim() ? noticeText.trim() : null,
      }),
    onSuccess: () => {
      toast.success("Menu saved");
      void queryClient.invalidateQueries({ queryKey: qk.menus(messId, { monthId }) });
      setOpen(false);
      setMenuText("");
      setNoticeText("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the menu"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add menu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publish a menu</DialogTitle>
          <DialogDescription>Saving again for the same date and meal updates the existing entry.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="menu-date">Date</Label>
              <Input id="menu-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Meal</Label>
              <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {humanize(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-text">Menu</Label>
            <Textarea
              id="menu-text"
              value={menuText}
              onChange={(event) => setMenuText(event.target.value)}
              placeholder="Rice, dal, beef curry, salad"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-notice">Notice (optional)</Label>
            <Textarea
              id="menu-notice"
              value={noticeText}
              onChange={(event) => setNoticeText(event.target.value)}
              placeholder="Dinner will be served at 9:30 pm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={upsert.isPending}>
            Cancel
          </Button>
          <Button loading={upsert.isPending} disabled={menuText.trim().length === 0} onClick={() => upsert.mutate()}>
            Save menu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteMenuButton({ messId, menuId }: { messId: string; menuId: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => menusApi.remove(messId, menuId),
    onSuccess: () => {
      toast.success("Menu removed");
      void queryClient.invalidateQueries({ queryKey: ["menus", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove the menu"),
  });
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Remove menu"
      loading={remove.isPending}
      onClick={() => remove.mutate()}
    >
      <Trash2 />
    </Button>
  );
}
