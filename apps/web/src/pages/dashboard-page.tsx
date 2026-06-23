import { platformMetadata } from "@crm/config";
import { authFoundation } from "@crm/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantConfig } from "@/providers/tenant-config-provider";

const foundationHighlights = [
  {
    label: "CRM modules",
    value: "Sales live",
    detail: "SDR and inside sales now extend the CRM kernel with focused lead queues, qualification workbenches, and handoff tracking."
  },
  {
    label: "Backend API",
    value: "/api/v1",
    detail: "Express now serves auth, RBAC, tenant config, tenant-safe CRM CRUD, sales workspaces, opportunity flows, campaign flows, and social APIs."
  },
  {
    label: "Shared packages",
    value: "6 packages",
    detail: "Config, types, UI, auth, AI, and database packages now share CRM, productivity, SDR, inside-sales, campaign, social, and RBAC contracts."
  }
] as const;

export function DashboardPage() {
  const { summary, settings } = useTenantConfig();

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="space-y-5">
            <Badge>{platformMetadata.currentPhase}</Badge>
            <div className="space-y-4">
              <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight">
                The workspace now includes dedicated SDR and inside-sales execution surfaces alongside live pipeline, campaign, and social workflows.
              </h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                This dashboard is still platform-forward, but the CRM kernel now includes opportunities, campaigns,
                social post planning, shared touchpoint tracking, SDR qualification queues, and inside-sales handoff
                workflows. It reflects the authenticated shell, PostgreSQL-backed identity flow, tenant configuration,
                and the live lead-to-revenue execution path.
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-slate-50 shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current guardrails</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold">Authentication, RBAC, tenant settings, SDR workspaces, sales pipeline, campaigns, and social planning are now live</p>
                <p className="mt-1 text-sm text-slate-300">
                  Login, logout, refresh rotation, session tracking, protected routes, admin role management, theme
                  settings, and the tenant-safe CRM, SDR, inside-sales, opportunity, campaign, and social marketing records now run on the seeded workspace.
                </p>
              </div>
              <div>
                <p className="font-semibold">Sales, CRM, and marketing records now follow permission bundles, tenant switches, audit logs, unified timelines, and workspace-specific task queues</p>
                <p className="mt-1 text-sm text-slate-300">
                  Leads, accounts, contacts, and opportunities now support CRUD, ownership, notes, activities, tasks,
                  timeline views, and soft delete while campaigns, social posts, and sales workspaces add approval,
                  scheduling, qualification, member, and channel-aware planning.
                </p>
              </div>
              <div>
                <p className="font-semibold">Tenant configuration now feeds live CRM, sales, and marketing forms</p>
                <p className="mt-1 text-sm text-slate-300">
                  {settings.workspaceName} now carries its own theme, terminology, module map, option sets, and
                  form-layout metadata, and the CRM, opportunity, campaign, and social forms are already consuming those tenant-managed labels and dropdowns.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Platform overview</CardTitle>
            <CardDescription>
              These cards summarize the current authenticated platform foundation now that SDR, inside sales, opportunities, campaigns, and social marketing are live.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {foundationHighlights.map((highlight) => (
              <div key={highlight.label} className="rounded-[1.25rem] bg-background/75 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{highlight.label}</p>
                <p className="mt-3 font-display text-3xl font-semibold">{highlight.value}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{highlight.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration readiness</CardTitle>
            <CardDescription>Tenant configuration assets are now available and already feeding the first CRM modules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                title: "Option sets",
                value: String(summary.optionSetCount),
                description: "Dropdowns, pipelines, ticket statuses, and success stages are tenant-configurable."
              },
              {
                title: "Custom fields",
                value: String(summary.customFieldCount),
                description: "Field metadata can now be created and soft deleted through the admin workspace."
              },
              {
                title: "Form layouts",
                value: String(summary.formLayoutCount),
                description: "Seeded lead, account, contact, opportunity, campaign, and social layout scaffolds are already stored per tenant."
              }
            ].map((item) => (
              <div key={item.title} className="rounded-[1.25rem] bg-background/75 p-5 shadow-sm">
                <Badge variant="muted">{item.title}</Badge>
                <p className="mt-3 font-display text-3xl font-semibold">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Route inventory</CardTitle>
            <CardDescription>
              The protected route map comes from the shared auth package foundation and is now filtered by permission.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {authFoundation.protectedRoutes.map((routePath) => (
              <div key={routePath} className="rounded-[1rem] border border-border/70 bg-background/75 px-4 py-3 text-sm">
                {routePath}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What comes next</CardTitle>
            <CardDescription>
              The secure platform baseline, sales workspaces, pipeline engine, campaign engine, and social workspace are in place. The next phase can deepen those workflows instead of rebuilding foundation pieces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Extend the SDR and inside-sales queues into richer sequencing, scheduling, and conversion workflows.",
              "Connect social publishing, engagement ingestion, and social lead capture to the new planning workspace.",
              "Keep applying module-level and action-level permissions to every new workflow surface.",
              "Read more custom fields, option sets, and layouts directly from the tenant configuration engine."
            ].map((nextStep) => (
              <div key={nextStep} className="rounded-[1rem] bg-background/75 px-4 py-4 text-sm leading-6 text-muted-foreground">
                {nextStep}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
