"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  Moon,
  Sun,
  Sunrise,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
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
import { TableSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mealsApi } from "@/lib/api/endpoints";
import type { MealType, MemberMealTimeline, MemberMealTimelineDay } from "@/lib/api/types";
import { formatDate, humanize } from "@/lib/format";

export const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];

const MEAL_ON_FIELDS: Record<MealType, keyof MemberMealTimelineDay> = {
  BREAKFAST: "breakfastOn",
  LUNCH: "lunchOn",
  DINNER: "dinnerOn",
};

const MEAL_TOTAL_FIELDS: Record<MealType, keyof MemberMealTimelineDay> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
};

const MEAL_META: Record<
  MealType,
  { labelEn: string; labelBn: string; description: string; icon: typeof Sunrise }
> = {
  BREAKFAST: {
    labelEn: "Breakfast",
    labelBn: "সকালের নাশতা",
    description: "Daily breakfast meal count per member (including guest meals).",
    icon: Sunrise,
  },
  LUNCH: {
    labelEn: "Lunch",
    labelBn: "দুপুরের খাবার",
    description: "Daily lunch meal count per member (including guest meals).",
    icon: Sun,
  },
  DINNER: {
    labelEn: "Dinner",
    labelBn: "রাতের খাবার",
    description: "Daily dinner meal count per member (including guest meals).",
    icon: Moon,
  },
};

/**
 * Curated high-contrast, visually pleasing color palette for member lines.
 * Distinguishable across dark and light themes.
 */
export const MEMBER_COLORS: string[] = [
  "#2563eb", // Royal Blue
  "#16a34a", // Emerald Green
  "#ea580c", // Vibrant Orange
  "#9333ea", // Purple
  "#dc2626", // Red
  "#0891b2", // Cyan / Teal
  "#db2777", // Deep Pink
  "#ca8a04", // Amber / Gold
  "#4f46e5", // Indigo
  "#059669", // Mint Green
  "#e11d48", // Rose Red
  "#7c3aed", // Violet
  "#0284c7", // Sky Blue
  "#d97706", // Dark Amber
  "#0d9488", // Dark Teal
  "#be123c", // Ruby
];

export function getMemberColor(index: number): string {
  if (index < MEMBER_COLORS.length) {
    return MEMBER_COLORS[index];
  }
  // Golden ratio HSL generation fallback for large groups
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue}, 72%, 46%)`;
}

type OnOff = "ON" | "OFF";

interface MonthlyMealTimelineProps {
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
  members: { id: string; name: string }[];
  onSaved: () => void;
  showEditor?: boolean;
}

export function MonthlyMealTimeline({
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
  members,
  onSaved,
  showEditor = true,
}: MonthlyMealTimelineProps) {
  const [selectedView, setSelectedView] = useState<"all" | MealType>("all");

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Monthly meal timeline — {monthLabel}</CardTitle>
          <CardDescription>
            Daily breakfast, lunch, and dinner trends for each member. Guest meals are included.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={selectedView}
            onValueChange={(val) => setSelectedView(val as "all" | MealType)}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2.5">All 3 charts</TabsTrigger>
              <TabsTrigger value="BREAKFAST" className="text-xs px-2.5">Breakfast</TabsTrigger>
              <TabsTrigger value="LUNCH" className="text-xs px-2.5">Lunch</TabsTrigger>
              <TabsTrigger value="DINNER" className="text-xs px-2.5">Dinner</TabsTrigger>
            </TabsList>
          </Tabs>

          {isManager && showEditor ? (
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
        </div>
      </CardHeader>
      <CardContent>
        {timelinePending ? (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-72 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : timelineError ? (
          <ErrorState error={timelineError} onRetry={onRetry} compact />
        ) : timeline.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title="No monthly meal timeline yet" />
        ) : (
          <div className="min-w-0 space-y-6">
            {(selectedView === "all" ? MEAL_TYPES : [selectedView]).map((mealType) => (
              <MealTypeTimelineChart
                key={mealType}
                mealType={mealType}
                timeline={timeline}
                daysInMonth={daysInMonth}
                monthLabel={monthLabel}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MealTypeTimelineChartProps {
  mealType: MealType;
  timeline: MemberMealTimeline[];
  daysInMonth: number;
  monthLabel: string;
}

export function MealTypeTimelineChart({
  mealType,
  timeline,
  daysInMonth,
  monthLabel,
}: MealTypeTimelineChartProps) {
  const mealField = MEAL_TOTAL_FIELDS[mealType];
  const meta = MEAL_META[mealType];
  const Icon = meta.icon;

  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);

  // Prepare chart data where x-axis is discrete day number 1, 2, 3, ... daysInMonth
  const data = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const point: Record<string, string | number> = { day };
      for (const member of timeline) {
        point[member.memberId] = Number(member.days[index]?.[mealField] ?? 0);
      }
      return point;
    });
  }, [daysInMonth, timeline, mealField]);

  // Total for the entire month for each member
  const memberTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const member of timeline) {
      const sum = member.days.reduce(
        (acc, day) => acc + Number(day[mealField] ?? 0),
        0,
      );
      map.set(member.memberId, sum);
    }
    return map;
  }, [timeline, mealField]);

  // Overall grand total meals for this meal type across all members this month
  const totalMonthMeals = useMemo(() => {
    let total = 0;
    for (const val of memberTotals.values()) total += val;
    return total;
  }, [memberTotals]);

  // Y-axis maximum: highest meal count in a single day by any member + 5 meals (extra headroom)
  const highestMealCount = useMemo(() => {
    return Math.max(
      0,
      ...timeline.flatMap((member) =>
        member.days.map((day) => Number(day[mealField] ?? 0)),
      ),
    );
  }, [timeline, mealField]);

  const yAxisMax = highestMealCount + 5;

  // Generate integer ticks for Y-axis (whole numbers only)
  const yAxisTicks = useMemo(() => {
    if (yAxisMax <= 8) {
      return Array.from({ length: yAxisMax + 1 }, (_, index) => index);
    }
    const step = yAxisMax <= 15 ? 2 : Math.ceil(yAxisMax / 6);
    const ticks: number[] = [];
    for (let val = 0; val <= yAxisMax; val += step) {
      ticks.push(val);
    }
    if (ticks[ticks.length - 1] !== yAxisMax) {
      ticks.push(yAxisMax);
    }
    return ticks;
  }, [yAxisMax]);

  return (
    <Card className="min-w-0 overflow-hidden border bg-card/60 shadow-xs">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{meta.labelEn}</CardTitle>
              <span className="text-xs text-muted-foreground font-normal">({meta.labelBn})</span>
            </div>
            <CardDescription className="text-xs">
              {meta.description}
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs font-mono">
            Peak: {highestMealCount}
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono">
            {totalMonthMeals} meals total
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        <div className="h-72 min-w-0 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 12, right: 16, bottom: daysInMonth > 20 ? 30 : 16, left: 4 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.6}
              />
              <XAxis
                dataKey="day"
                type="number"
                domain={[1, daysInMonth]}
                ticks={Array.from({ length: daysInMonth }, (_, index) => index + 1)}
                allowDecimals={false}
                interval={0}
                angle={daysInMonth > 20 ? -45 : 0}
                textAnchor={daysInMonth > 20 ? "end" : "middle"}
                height={daysInMonth > 20 ? 46 : 24}
                tick={{ fontSize: 10, fill: "currentColor" }}
                stroke="var(--color-border)"
              />
              <YAxis
                type="number"
                domain={[0, yAxisMax]}
                ticks={yAxisTicks}
                allowDecimals={false}
                width={36}
                tick={{ fontSize: 11, fill: "currentColor" }}
                stroke="var(--color-border)"
              />
              <Tooltip
                content={
                  <CustomMealTooltip
                    monthLabel={monthLabel}
                    mealTitle={meta.labelEn}
                    timeline={timeline}
                  />
                }
              />
              {timeline.map((member, index) => {
                const color = getMemberColor(index);
                const isDimmed =
                  hoveredMemberId !== null && hoveredMemberId !== member.memberId;
                const isHighlighted = hoveredMemberId === member.memberId;

                return (
                  <Line
                    key={member.memberId}
                    type="linear"
                    dataKey={member.memberId}
                    name={member.memberName}
                    stroke={color}
                    strokeWidth={isHighlighted ? 3.5 : 2.5}
                    strokeOpacity={isDimmed ? 0.2 : 1}
                    dot={{
                      r: isHighlighted ? 4 : 2.5,
                      fill: color,
                      stroke: "#ffffff",
                      strokeWidth: 1,
                    }}
                    activeDot={{
                      r: 6,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Member Legend: shows each member line's color and their total for this meal type */}
        <div className="mt-3 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members & total {meta.labelEn.toLowerCase()} meals:
            </span>
            {hoveredMemberId ? (
              <button
                type="button"
                onClick={() => setHoveredMemberId(null)}
                className="text-xs text-primary underline hover:text-primary/80"
              >
                Reset highlight
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {timeline.map((member, index) => {
              const color = getMemberColor(index);
              const count = memberTotals.get(member.memberId) ?? 0;
              const isSelected = hoveredMemberId === member.memberId;

              return (
                <button
                  type="button"
                  key={member.memberId}
                  onClick={() =>
                    setHoveredMemberId((prev) =>
                      prev === member.memberId ? null : member.memberId,
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border/60 bg-muted/30 text-foreground hover:bg-muted/70"
                  }`}
                  title={`Click to highlight ${member.memberName}'s line`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate max-w-[9rem]">{member.memberName}</span>
                  <span className="font-mono font-medium text-muted-foreground">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CustomMealTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string;
    value?: string | number;
    color?: string;
  }>;
  label?: string | number;
  monthLabel: string;
  mealTitle: string;
  timeline: MemberMealTimeline[];
}

function CustomMealTooltip({
  active,
  payload,
  label,
  monthLabel,
  mealTitle,
}: CustomMealTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Sort payload by meal count descending, so active eaters appear first
  const sorted = [...payload].sort(
    (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
  );
  const total = sorted.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <div className="min-w-44 rounded-lg border bg-background/95 p-3 text-xs shadow-xl backdrop-blur-xs">
      <div className="flex items-center justify-between border-b pb-1.5 mb-2 font-medium">
        <span className="text-foreground">
          {monthLabel} · Day {label} ({mealTitle})
        </span>
        <span className="font-mono font-bold text-primary">
          {total} meal{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
        {sorted.map((item) => {
          const count = Number(item.value ?? 0);
          return (
            <div
              key={String(item.dataKey)}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className={`truncate ${
                    count > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.name}
                </span>
              </div>
              <span
                className={`font-mono ${
                  count > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
    if (!members.some((entry) => entry.id === memberId)) {
      setMemberId(members[0]?.id ?? "");
    }
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
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update monthly meals"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={monthClosed || members.length === 0}>
          <CalendarDays className="size-3.5" />
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
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.name}
                </SelectItem>
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
                    <TableHead key={mealType} className="text-center">
                      {humanize(mealType)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedMember.days.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell className="whitespace-nowrap text-xs font-medium">
                      {formatDate(point.date)}
                    </TableCell>
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
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {changedRecords.length} record(s) changed
          </p>
          <Button
            onClick={() => save.mutate()}
            disabled={changedRecords.length === 0 || monthClosed}
            loading={save.isPending}
          >
            <Check className="size-4" />
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
