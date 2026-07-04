import { cn } from "@/lib/utils";

export type StatusTone = "success" | "danger" | "warning" | "info" | "hot" | "neutral";

const toneStyles: Record<StatusTone, { dot: string; pill: string }> = {
  success: { dot: "bg-emerald-500", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" },
  danger: { dot: "bg-rose-500", pill: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" },
  warning: { dot: "bg-amber-500", pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" },
  info: { dot: "bg-sky-500", pill: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300" },
  hot: { dot: "bg-orange-500", pill: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300" },
  neutral: { dot: "bg-slate-400", pill: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300" }
};

// Keyword → tone. Ordered by priority (first match wins). Covers lead/opportunity/
// ticket/support/CS/partner/approval vocab so any status is legible at a glance.
const rules: Array<[StatusTone, string[]]> = [
  ["danger", ["lost", "reject", "fail", "churn", "block", "breach", "overdue", "critical", "error", "disqualif", "cancel", "declin", "expired", "at risk", "at-risk", "red", "unhealthy", "detractor", "escalat", "conflict", "high risk"]],
  ["success", ["won", "approv", "resolved", "closed won", "complete", "convert", "healthy", "success", "paid", "live", "done", "passed", "active", "green", "promoter", "delivered", "signed", "accepted", "onboarded", "renewed", "qualified", "sql"]],
  ["hot", ["hot", "urgent", "vip", "priority", "strategic", "p1"]],
  ["warning", ["pending", "review", "hold", "wait", "aging", "due", "high", "nurtur", "passive", "medium", "warn", "amber", "yellow", "in progress", "in-progress", "processing", "draft-review", "requested", "negotiat"]],
  ["info", ["new", "open", "draft", "schedul", "assigned", "contacted", "working", "prospect", "discovery", "proposal", "demo", "mql", "low", "info", "blue", "created", "todo", "to do", "not started", "not_started", "registered"]]
];

export function statusTone(value: string | null | undefined): StatusTone {
  const v = (value ?? "").toString().trim().toLowerCase().replace(/_/g, " ");
  if (!v) return "neutral";
  for (const [tone, keys] of rules) {
    if (keys.some((k) => v.includes(k))) return tone;
  }
  return "neutral";
}

interface StatusPillProps {
  children?: React.ReactNode;
  /** Value used to derive the colour; defaults to the text content. */
  value?: string | null;
  /** Force a specific tone. */
  tone?: StatusTone;
  className?: string;
  size?: "sm" | "md";
}

export function StatusPill({ children, value, tone, className, size = "md" }: StatusPillProps) {
  const label = children ?? value ?? "—";
  const resolved = tone ?? statusTone(value ?? (typeof label === "string" ? label : ""));
  const styles = toneStyles[resolved];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[0.68rem]" : "px-2.5 py-1 text-xs",
        styles.pill,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}
