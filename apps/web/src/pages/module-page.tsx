import type { ModuleHighlight } from "@crm/types";
import { ArrowRight, Orbit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ModulePageProps {
  eyebrow: string;
  title: string;
  summary: string;
  highlights: ModuleHighlight[];
  implementationGuidance: string[];
}

export function ModulePage({
  eyebrow,
  title,
  summary,
  highlights,
  implementationGuidance
}: ModulePageProps) {
  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-6 p-8 lg:grid-cols-[1.5fr_1fr] lg:p-10">
          <div className="space-y-5">
            <Badge>{eyebrow}</Badge>
            <div className="space-y-3">
              <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight">{title}</h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">{summary}</p>
            </div>
          </div>
          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-slate-50 shadow-panel">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <Orbit className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Phase 1 stance</p>
                <p className="text-sm text-slate-300">Structure now, feature logic later.</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              This page is intentionally a placeholder surface for the eventual module. It proves routing, layout,
              and information architecture without introducing domain workflows yet.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Module foundation</CardTitle>
            <CardDescription>
              The cards below outline the placeholder boundaries this module will grow into.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {highlights.map((highlight) => (
              <div
                key={highlight.title}
                className="rounded-[1.25rem] border border-border/70 bg-background/70 p-5 shadow-sm"
              >
                <Badge variant={highlight.status === "foundation" ? "success" : "muted"}>{highlight.status}</Badge>
                <h3 className="mt-4 font-display text-lg font-semibold">{highlight.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{highlight.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Implementation guidance</CardTitle>
            <CardDescription>
              These notes keep Phase 1 scoped correctly while giving us a clear build runway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {implementationGuidance.map((guidancePoint) => (
              <div key={guidancePoint} className="flex gap-3 rounded-[1.25rem] bg-background/70 p-4">
                <div className="mt-0.5 rounded-full bg-primary/15 p-2 text-primary">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{guidancePoint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

