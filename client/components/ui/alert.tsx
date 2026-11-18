import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border p-4 text-sm [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "border-destructive/30 bg-destructive/6 text-destructive",
      warning: "border-warning/40 bg-warning/10 text-warning-foreground",
      success: "border-success/30 bg-success/8 text-success",
      info: "border-info/30 bg-info/8 text-info",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mb-1 font-medium leading-none", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)} {...props} />;
}
