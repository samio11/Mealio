import { Skeleton } from "@/components/ui/skeleton";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Loading placeholder that mirrors a real table so the layout does not jump. */
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <div>
      <LoadingAnimation label="Loading…" size="small" className="mx-auto h-10 w-10" />
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index}>
                <Skeleton className="h-3 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, cellIndex) => (
                <TableCell key={cellIndex}>
                  <Skeleton className={cellIndex === 0 ? "h-4 w-40" : "h-4 w-24"} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      <LoadingAnimation label="Loading…" size="small" className="mx-auto h-10 w-10" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function BlockSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className ?? "h-64 rounded-xl")}>
      <Skeleton className="absolute inset-0 h-full w-full" />
      <LoadingAnimation label="Loading…" size="small" className="absolute inset-0 m-auto" />
    </div>
  );
}
