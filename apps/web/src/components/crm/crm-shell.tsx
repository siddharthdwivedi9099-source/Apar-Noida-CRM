import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface CrmHeroProps {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function CrmHero({ eyebrow, title, summary, actions, aside }: CrmHeroProps) {
  return (
    <section className="glass-panel overflow-hidden rounded-[2rem]">
      <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
        <div className="space-y-5">
          <Badge>{eyebrow}</Badge>
          <div className="space-y-3">
            <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight">{title}</h2>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">{summary}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
    </section>
  );
}

interface CrmMetricCardProps {
  label: string;
  value: string;
  description: string;
}

export function CrmMetricCard({ label, value, description }: CrmMetricCardProps) {
  return (
    <div className="rounded-[1.25rem] bg-background/75 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

interface CrmEmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function CrmEmptyState({ title, description, action }: CrmEmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 p-8">
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-semibold">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
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
      <CardContent className="space-y-3 p-8">
        <div className="h-4 w-32 animate-pulse rounded-full bg-secondary/80" />
        <div className="h-10 w-full max-w-xl animate-pulse rounded-2xl bg-secondary/80" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-full bg-secondary/60" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-secondary/60" />
        <div className="space-y-1 pt-3">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
