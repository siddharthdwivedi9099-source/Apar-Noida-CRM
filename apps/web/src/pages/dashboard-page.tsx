import { aiFoundationCards } from "@crm/ai";
import { platformMetadata } from "@crm/config";
import { authFoundation } from "@crm/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const foundationHighlights = [
  {
    label: "Frontend shell",
    value: "Permission-aware",
    detail: "Sidebar, topbar, login page, protected routes, and permission-aware navigation are in place."
  },
  {
    label: "Backend API",
    value: "/api/v1",
    detail: "Express now serves auth, health, RBAC management, permission checks, and centralized error handling."
  },
  {
    label: "Shared packages",
    value: "6 packages",
    detail: "Config, types, UI, auth, AI, and database packages now share a single RBAC vocabulary."
  }
] as const;

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="space-y-5">
            <Badge>{platformMetadata.currentPhase}</Badge>
            <div className="space-y-4">
              <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight">
                The workspace foundation now includes tenant-aware RBAC and a working role management surface.
              </h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                This dashboard is intentionally centered on platform readiness rather than business metrics. It now
                reflects the authenticated shell, PostgreSQL-backed identity flow, shared packages, RBAC controls,
                and the local runtime needed before CRM domain features begin.
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-slate-50 shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current guardrails</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-semibold">Authentication and RBAC are now live</p>
                <p className="mt-1 text-sm text-slate-300">
                  Login, logout, refresh rotation, session tracking, protected routes, and admin role management are
                  implemented for the seeded tenant flow.
                </p>
              </div>
              <div>
                <p className="font-semibold">Module access now follows permission bundles</p>
                <p className="mt-1 text-sm text-slate-300">
                  Leads, accounts, campaigns, support, success, admin, and AI routes only appear when the current
                  user has matching module permissions.
                </p>
              </div>
              <div>
                <p className="font-semibold">AI remains governed but non-executable</p>
                <p className="mt-1 text-sm text-slate-300">
                  The platform keeps the AI architecture visible, and RBAC now distinguishes between AI use and AI
                  management before model-backed workflows arrive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Phase 4 platform overview</CardTitle>
            <CardDescription>
              These cards summarize the current authenticated and authorized platform foundation before business
              modules are fully built out.
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
            <CardTitle>AI foundation preview</CardTitle>
            <CardDescription>These cards are powered from the shared AI package to keep future surfaces consistent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiFoundationCards.map((item) => (
              <div key={item.title} className="rounded-[1.25rem] bg-background/75 p-5 shadow-sm">
                <Badge variant={item.status === "foundation" ? "success" : "muted"}>{item.status}</Badge>
                <p className="mt-3 font-semibold">{item.title}</p>
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
              The secure platform baseline is in place. The next phase can focus on domain workflows that plug into
              the RBAC layer already shipping here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Start the CRM kernel with accounts, contacts, leads, and activity structures.",
              "Connect real business APIs to the module-level and action-level permissions already seeded.",
              "Expand tenant administration into full user lifecycle management, audit review, and settings workflows."
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
