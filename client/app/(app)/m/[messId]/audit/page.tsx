"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ScrollText, Search, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditApi } from "@/lib/api/endpoints";
import type { AuditLog } from "@/lib/api/types";
import { formatDateTime, humanize } from "@/lib/format";
import { qk } from "@/lib/hooks/queries";
import { useMyMembership } from "@/lib/hooks/use-my-membership";

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { messId } = useParams<{ messId: string }>();
  const { isManager, isPending: membershipPending } = useMyMembership(messId);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const filters = { entityType, action, page };
  const query = useQuery({
    queryKey: qk.audit(messId, filters),
    queryFn: () =>
      auditApi.list(messId, {
        entityType: entityType.trim() || undefined,
        action: action.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(isManager),
  });

  if (!membershipPending && !isManager) {
    return (
      <div className="space-y-5">
        <PageHeader title="Activity log" description="Every change made in this mess, in one place." />
        <Alert variant="warning">
          <TriangleAlert />
          <div>
            <AlertTitle>Managers only</AlertTitle>
            <AlertDescription>The audit trail is visible to mess managers.</AlertDescription>
          </div>
        </Alert>
      </div>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity log"
        description="An immutable record of who changed what. Entries are never edited or deleted."
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Most recent first. Filter by the record type or the action.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="audit-entity" className="text-xs text-muted-foreground">
                Record type
              </label>
              <Input
                id="audit-entity"
                value={entityType}
                onChange={(event) => {
                  setEntityType(event.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Deposit"
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="audit-action" className="text-xs text-muted-foreground">
                Action
              </label>
              <Input
                id="audit-action"
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setPage(1);
                }}
                placeholder="e.g. CREATE"
                className="w-36"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {query.isPending ? (
            <div className="px-5">
              <TableSkeleton columns={5} rows={8} />
            </div>
          ) : query.isError ? (
            <div className="px-5">
              <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
            </div>
          ) : items.length === 0 ? (
            <div className="px-5">
              <EmptyState
                icon={entityType.trim() || action.trim() ? Search : ScrollText}
                title={entityType.trim() || action.trim() ? "No matching entries" : "Nothing recorded yet"}
                description={
                  entityType.trim() || action.trim()
                    ? "Try a different record type or action."
                    : "Actions such as approvals, reminders and edits will appear here."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
          )}
          {!query.isPending && !query.isError && items.length > 0 ? (
            <div className="px-5 pb-4">
              <Pagination meta={query.data?.meta} onPageChange={setPage} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const hasDetails = log.before != null || log.after != null;

  return (
    <>
      <TableRow>
        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
        <TableCell>{log.actorName ?? "System"}</TableCell>
        <TableCell>
          <Badge variant="secondary">{humanize(log.action)}</Badge>
        </TableCell>
        <TableCell>
          <span className="flex flex-col">
            <span className="font-medium">{humanize(log.entityType)}</span>
            <span className="max-w-40 truncate font-mono text-xs text-muted-foreground">{log.entityId}</span>
          </span>
        </TableCell>
        <TableCell className="text-right">
          {hasDetails ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={open ? "Hide details" : "Show details"}
            >
              {open ? "Hide" : "View"}
              <ChevronDown className={open ? "rotate-180 transition-transform" : "transition-transform"} />
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {open && hasDetails ? (
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableCell colSpan={5} className="whitespace-normal">
            <div className="space-y-2 py-1 text-xs">
              {log.reason ? (
                <p>
                  <span className="font-medium">Reason:</span> {log.reason}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">Before</p>
                  <pre className="overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px] leading-relaxed">
                    {jsonOf(log.before)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 font-medium text-muted-foreground">After</p>
                  <pre className="overflow-x-auto rounded-md bg-background p-2 font-mono text-[11px] leading-relaxed">
                    {jsonOf(log.after)}
                  </pre>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function jsonOf(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
