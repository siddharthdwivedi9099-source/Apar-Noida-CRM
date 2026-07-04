import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Inbox, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CrmHeroProps {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function CrmHero({ eyebrow, title, summary, actions, aside }: CrmHeroProps) {
  return (
    <section className="hero-surface glass-panel overflow-hidden rounded-[2rem]">
      <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
        <div className="space-y-5">
          <Badge variant="info" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </Badge>
          <div className="space-y-3">
            <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">{title}</h2>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">{summary}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3 pt-1">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
    </section>
  );
}

type MetricTone = "primary" | "success" | "info" | "warning" | "danger" | "neutral";

const metricToneChip: Record<MetricTone, string> = {
  primary: "icon-chip-soft",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  danger: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground"
};

interface CrmMetricCardProps {
  label: string;
  value: string;
  description: string;
  /** Optional lucide icon rendered in a tinted chip. */
  icon?: ComponentType<{ className?: string }>;
  /** Colour accent for the chip. */
  tone?: MetricTone;
  /** Makes the whole card a clickable, hover-lifting link. */
  href?: string;
  /** Small emphasis line (e.g. a delta) shown under the value. */
  hint?: string;
}

export function CrmMetricCard({ label, value, description, icon: Icon, tone = "primary", href, hint }: CrmMetricCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl", metricToneChip[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-3 font-display text-3xl font-semibold", tone === "primary" && "gradient-text")}>{value}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-muted-foreground">{hint}</p> : null}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="interactive-card block rounded-[1.25rem] border border-white/50 bg-background/80 p-5 shadow-sm backdrop-blur dark:border-white/10"
      >
        {inner}
      </Link>
    );
  }

  return <div className="rounded-[1.25rem] border border-white/50 bg-background/80 p-5 shadow-sm backdrop-blur dark:border-white/10">{inner}</div>;
}

interface CrmEmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}

export function CrmEmptyState({ title, description, action, icon: Icon = Inbox }: CrmEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="icon-chip-soft h-14 w-14">
          <Icon className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

interface CrmLoadingStateProps {
  title: string;
  description: string;
}

export function CrmLoadingState({ title, description }: CrmLoadingStateProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-4 rounded-2xl bg-background/60 p-4">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-secondary/70" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-secondary/70" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-secondary/60" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded-xl bg-secondary/60" />
          </div>
        ))}
        <div className="space-y-1 pt-1 text-center">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
