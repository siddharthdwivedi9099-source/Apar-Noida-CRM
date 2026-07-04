import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  LayoutGrid,
  Megaphone,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getVisibleNavItems } from "@/components/navigation/nav-items";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const quickActions = [
  { label: "Leads", caption: "Work your queue", href: "/leads", icon: Users },
  { label: "Opportunities", caption: "Move the pipeline", href: "/opportunities", icon: Target },
  { label: "Campaigns", caption: "Launch & nurture", href: "/campaigns", icon: Megaphone },
  { label: "Analytics", caption: "Live dashboards", href: "/analytics", icon: BarChart3 },
  { label: "Ask AI", caption: "Governed copilot", href: "/ask-ai", icon: Bot }
] as const;

export function DashboardPage() {
  const { summary, settings, modules } = useTenantConfig();
  const { user } = useAuth();

  const enabledModuleKeys = new Set(modules.filter((module) => module.enabled).map((module) => module.moduleKey));
  const workspaces = getVisibleNavItems(user?.permissionCodes ?? [], enabledModuleKeys).filter(
    (item) => item.href !== "/dashboard"
  );
  const firstName = (user?.displayName ?? "there").split(" ")[0];

  const stats = [
    { label: "Workspaces", value: String(workspaces.length), href: "#workspaces" },
    { label: "Option sets", value: String(summary.optionSetCount), href: "/admin" },
    { label: "Custom fields", value: String(summary.customFieldCount), href: "/custom-fields" },
    { label: "Form layouts", value: String(summary.formLayoutCount), href: "/admin" }
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="hero-surface glass-panel overflow-hidden rounded-[2rem] p-8 lg:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="info" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> {settings.workspaceName}
            </Badge>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
              {greeting()}, <span className="gradient-text">{firstName}</span>.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Your AI-native revenue operating system — pipeline, campaigns, support, success, and governed AI in one
              configurable workspace. Jump straight into anything below.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[26rem]">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                to={stat.href}
                className="interactive-card rounded-2xl border border-white/50 bg-white/70 p-4 text-left backdrop-blur dark:border-white/10 dark:bg-slate-900/50"
              >
                <p className="font-display text-3xl font-semibold gradient-text">{stat.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-tight">Quick actions</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                to={action.href}
                className="shine interactive-card animate-fade-up group relative overflow-hidden rounded-[1.5rem] border border-white/50 bg-white/75 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="icon-chip">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-lg font-semibold tracking-tight">{action.label}</p>
                <p className="text-sm text-muted-foreground">{action.caption}</p>
                <ArrowUpRight className="absolute right-4 top-4 h-5 w-5 text-muted-foreground/50 transition group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Workspace launcher */}
      <section id="workspaces" className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-tight">Your workspaces</h2>
          <Badge variant="muted" className="ml-1 normal-case tracking-normal">{workspaces.length}</Badge>
        </div>

        {workspaces.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No workspaces are enabled for your role yet. An administrator can enable modules and grant access.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
                  <Card interactive className="group h-full">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                      <span className="icon-chip-soft transition group-hover:scale-110">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowUpRight className="h-5 w-5 text-muted-foreground/40 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
