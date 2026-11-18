import { Badge, type BadgeProps } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

type Variant = NonNullable<BadgeProps["variant"]>;

/**
 * One place that decides how every domain status is coloured, so a "VERIFIED"
 * deposit looks the same everywhere it appears.
 */
const STATUS_VARIANTS: Record<string, Variant> = {
  // Membership
  ACTIVE: "success",
  INVITED: "info",
  SUSPENDED: "warning",
  REMOVED: "muted",
  // Invitation
  PENDING: "warning",
  ACCEPTED: "success",
  REVOKED: "muted",
  EXPIRED: "muted",
  // Month
  OPEN: "info",
  CLOSED: "muted",
  // Deposit
  VERIFIED: "success",
  REJECTED: "destructive",
  // Expense
  APPROVED: "success",
  REVERSED: "muted",
  // Bazar
  DRAFT: "muted",
  PENDING_REVIEW: "warning",
  // Duty
  SCHEDULED: "info",
  COMPLETED: "success",
  SKIPPED: "muted",
  // Price verification
  UNVERIFIED: "muted",
  VERIFIED_PRICE: "success",
  OUTDATED: "warning",
  // AI
  SUCCEEDED: "success",
  FAILED: "destructive",
  SKIPPED_AI: "muted",
  // Roles
  MANAGER: "default",
  MEMBER: "secondary",
  ADMIN: "default",
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: string | null | undefined;
  className?: string;
  label?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const variant = STATUS_VARIANTS[status] ?? "outline";
  return (
    <Badge variant={variant} className={className}>
      {label ?? humanize(status)}
    </Badge>
  );
}
