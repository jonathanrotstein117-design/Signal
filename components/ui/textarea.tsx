import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-28 w-full rounded-[14px] border border-input-border bg-white px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-ring disabled:bg-background-soft",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
