import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[14px] bg-[linear-gradient(90deg,rgba(229,226,218,0.45),rgba(255,255,255,0.88),rgba(229,226,218,0.45))]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
