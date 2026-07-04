import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        muted: "border-border bg-white/50 text-muted-foreground dark:bg-slate-900/40",
        success: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        info: "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
        warning: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        danger: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

