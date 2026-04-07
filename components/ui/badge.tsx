import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-accent/18 bg-accent/8 text-accent",
        secondary: "border-border bg-white text-secondary",
        success: "border-accent/18 bg-accent/8 text-accent",
        warning: "border-foreground/12 bg-foreground/5 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
