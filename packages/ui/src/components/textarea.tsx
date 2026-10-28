import { cn } from "cn";
import * as React from "react";

function Textarea({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"textarea"> & { variant?: "default" | "bare" }) {
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
        "data-[variant=bare]:border-0 data-[variant=bare]:bg-transparent data-[variant=bare]:px-1 data-[variant=bare]:shadow-none data-[variant=bare]:focus-visible:ring-0 dark:data-[variant=bare]:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
