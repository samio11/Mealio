"use client";

import { useState, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
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

/**
 * Confirmation before a state-changing action. When `requireReason` is set the
 * user must type a reason, which is sent to the API for the audit log.
 *
 * `trigger` must be a single element that forwards props/ref (a Button works).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  requireReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Why is this change being made?",
  onConfirm,
  pending = false,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonProps["variant"];
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => void;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const reasonMissing = requireReason && reason.trim().length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        {requireReason ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Input
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={reasonPlaceholder}
              autoComplete="off"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            loading={pending}
            disabled={reasonMissing}
            onClick={() => {
              onConfirm(reason.trim());
              setOpen(false);
              setReason("");
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
