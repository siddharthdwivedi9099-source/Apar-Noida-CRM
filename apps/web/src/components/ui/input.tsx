import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-white/80 px-4 py-2 text-sm text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-950/60",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };

