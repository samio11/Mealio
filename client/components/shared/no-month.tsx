"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown on any month-scoped page when the mess has no months configured yet.
 * Nothing in the app can be recorded before the first month exists.
 */
export function NoMonthState({
  messId,
  isManager,
  what,
}: {
  messId: string;
  isManager: boolean;
  what?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No month configured yet</CardTitle>
        <CardDescription>
          {what ? `${what} belongs to a month. ` : ""}
          {isManager
            ? "Create this month's entry to start recording meals, bazar, deposits and expenses."
            : "Ask a mess manager to open this month before anything can be recorded."}
        </CardDescription>
      </CardHeader>
      {isManager ? (
        <CardContent>
          <Button asChild>
            <Link href={`/m/${messId}/months`}>
              <CalendarPlus />
              Set up a month
            </Link>
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
