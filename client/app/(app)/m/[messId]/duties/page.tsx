"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, RefreshCw, Repeat, Shuffle, SkipForward, UserCog } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { NoMonthState } from "@/components/shared/no-month";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { dutiesApi } from "@/lib/api/endpoints";
import type { Duty } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDate, todayInDhaka } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";

export default function DutiesPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const { member, isManager, data: membersData, isPending: memberPending } = useMyMembership(messId);

  const duties = useQuery({
    queryKey: qk.duties(messId, { monthId }),
    queryFn: () => dutiesApi.list(messId, { monthId: monthId as string }),
    enabled: Boolean(monthId),
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bazar duty" description="The roster is generated per month." />
        {memberPending ? <TableSkeleton columns={4} rows={5} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="The duty roster" />}
      </div>
    );
  }

  const members = (membersData?.items ?? []).map((item) => ({
    id: item.id,
    name: item.displayName ?? item.name,
    isDutyEligible: item.isDutyEligible,
  }));
  const eligible = members.filter((item) => item.isDutyEligible);

  const today = todayInDhaka();
  const rows = [...(duties.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const visibleRows = isManager ? rows : rows.filter((duty) => duty.assigneeMemberId === member?.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bazar duty"
        description={`A fair, deterministic roster for ${activeMonth.label}. Rules are applied in a fixed order so the schedule is reproducible.`}
        actions={
          isManager ? (
            <>
              <SwapDialog messId={messId} duties={rows} />
              <GenerateDialog messId={messId} monthId={monthId as string} eligible={eligible} />
            </>
          ) : null
        }
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Roster</CardTitle>
            <CardDescription>
              {isManager ? "Every shopping day this month." : "Your upcoming and past shopping days."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {duties.isPending ? (
            <div className="px-5">
              <TableSkeleton columns={4} rows={6} />
            </div>
          ) : duties.isError ? (
            <div className="px-5">
              <ErrorState error={duties.error} onRetry={() => void duties.refetch()} compact />
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="px-5">
              <EmptyState
                icon={CalendarClock}
                title={isManager ? "No roster for this month yet" : "You have no duty days scheduled"}
                description={
                  isManager
                    ? "Generate the roster to spread shopping days across duty-eligible members."
                    : "Once the manager generates the roster, your days will appear here."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((duty) => (
                  <TableRow key={duty.id} className={duty.date === today ? "bg-primary/5" : undefined}>
                    <TableCell className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {formatDate(duty.date)}
                        {duty.date === today ? <Badge variant="secondary">Today</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {duty.assigneeName ?? "Unassigned"}
                        {duty.isManualOverride ? <Badge variant="outline">Manual</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell>{<StatusBadge status={duty.status} />}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isManager ? (
                          <>
                            <AssignDialog messId={messId} duty={duty} members={members} />
                            <StatusButtons messId={messId} duty={duty} />
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isManager ? (
        <p className="text-xs text-muted-foreground">
          Need to change a day? Ask a manager to reassign it — overrides are recorded with a reason in the activity log.
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Generate                                                                   */
/* -------------------------------------------------------------------------- */

function GenerateDialog({
  messId,
  monthId,
  eligible,
}: {
  messId: string;
  monthId: string;
  eligible: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preserve, setPreserve] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const generate = useMutation({
    mutationFn: () =>
      dutiesApi.generate(messId, {
        monthId,
        preserveOverrides: preserve,
        eligibleMemberIds: selected.length > 0 ? selected : undefined,
      }),
    onSuccess: (result) => {
      toast.success(`Roster generated for ${result.length} day(s)`);
      void queryClient.invalidateQueries({ queryKey: ["duties", messId] });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not generate the roster"),
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Shuffle />
          Generate roster
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate the duty roster</DialogTitle>
          <DialogDescription>
            Days are distributed evenly and deterministically. Existing manual overrides are kept by default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch id="preserve" checked={preserve} onCheckedChange={setPreserve} />
            <Label htmlFor="preserve">Preserve existing manual overrides</Label>
          </div>

          <div className="space-y-2">
            <Label>Eligible members (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Leave empty to use every duty-eligible active member.
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
              {eligible.length === 0 ? (
                <p className="text-sm text-muted-foreground">No duty-eligible members found.</p>
              ) : (
                eligible.map((entry) => (
                  <label key={entry.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.includes(entry.id)} onCheckedChange={() => toggle(entry.id)} />
                    {entry.name}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button loading={generate.isPending} onClick={() => generate.mutate()}>
            <RefreshCw />
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Assign (manual override)                                                   */
/* -------------------------------------------------------------------------- */

function AssignDialog({
  messId,
  duty,
  members,
}: {
  messId: string;
  duty: Duty;
  members: { id: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState<string>(duty.assigneeMemberId ?? "__none");
  const [reason, setReason] = useState("");

  const assign = useMutation({
    mutationFn: () =>
      dutiesApi.assign(messId, duty.id, {
        assigneeMemberId: assignee === "__none" ? null : assignee,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success("Duty reassigned");
      void queryClient.invalidateQueries({ queryKey: ["duties", messId] });
      setOpen(false);
      setReason("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reassign"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="outline" aria-label="Reassign duty">
          <UserCog />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign {formatDate(duty.date)}</DialogTitle>
          <DialogDescription>Manual changes override the generated roster and require a reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {members.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-reason">Reason</Label>
            <Input
              id="assign-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. He is travelling that week"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button loading={assign.isPending} disabled={reason.trim().length < 2} onClick={() => assign.mutate()}>
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

function StatusButtons({ messId, duty }: { messId: string; duty: Duty }) {
  const queryClient = useQueryClient();
  const setStatus = useMutation({
    mutationFn: (status: string) => dutiesApi.setStatus(messId, duty.id, { status }),
    onSuccess: () => {
      toast.success("Duty status updated");
      void queryClient.invalidateQueries({ queryKey: ["duties", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update status"),
  });

  return (
    <>
      <Button
        size="icon-sm"
        variant={duty.status === "COMPLETED" ? "default" : "outline"}
        aria-label="Mark completed"
        loading={setStatus.isPending && setStatus.variables === "COMPLETED"}
        onClick={() => setStatus.mutate("COMPLETED")}
      >
        <Check />
      </Button>
      <Button
        size="icon-sm"
        variant={duty.status === "SKIPPED" ? "default" : "outline"}
        aria-label="Mark skipped"
        loading={setStatus.isPending && setStatus.variables === "SKIPPED"}
        onClick={() => setStatus.mutate("SKIPPED")}
      >
        <SkipForward />
      </Button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Swap                                                                       */
/* -------------------------------------------------------------------------- */

function SwapDialog({ messId, duties }: { messId: string; duties: Duty[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");

  const swap = useMutation({
    mutationFn: () => dutiesApi.swap(messId, { fromDutyId: fromId, toDutyId: toId, reason: reason.trim() || undefined }),
    onSuccess: () => {
      toast.success("Duty days swapped");
      void queryClient.invalidateQueries({ queryKey: ["duties", messId] });
      setOpen(false);
      setFromId("");
      setToId("");
      setReason("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not swap the days"),
  });

  const candidates = duties.filter((duty) => duty.assigneeMemberId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Repeat />
          Swap days
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Swap two duty days</DialogTitle>
          <DialogDescription>The two assignees exchange their dates.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>First day</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a day" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((duty) => (
                  <SelectItem key={duty.id} value={duty.id}>
                    {formatDate(duty.date)} · {duty.assigneeName ?? "Unassigned"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Second day</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a day" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((duty) => (
                  <SelectItem key={duty.id} value={duty.id} disabled={duty.id === fromId}>
                    {formatDate(duty.date)} · {duty.assigneeName ?? "Unassigned"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="swap-reason">Reason (optional)</Label>
            <Input id="swap-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={swap.isPending}>
            Cancel
          </Button>
          <Button loading={swap.isPending} disabled={!fromId || !toId || fromId === toId} onClick={() => swap.mutate()}>
            Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
