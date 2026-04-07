import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[14px] border border-input-border bg-white px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-ring disabled:bg-background-soft",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
