import { useEffect, useState } from "react";
import type { TenantCoreSettings } from "@crm/types";
import { Building2, LayoutTemplate, Palette, ShieldCheck, Shapes, Type } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

const selectClassName =
  "flex h-11 w-full rounded-[1.25rem] border border-input bg-background px-4 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function AdminSettingsPage() {
  const { accessToken } = useAuth();
  const { tenant, settings, summary, reload } = useTenantConfig();
  const [formState, setFormState] = useState<TenantCoreSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest("/tenant-config/settings", {
        method: "PUT",
        accessToken,
        body: formState
      });
      await reload();
      setSuccessMessage("Workspace settings were updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="space-y-5">
            <Badge>Tenant Configuration Engine</Badge>
            <div className="space-y-3">
              <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight">
                Configure the tenant workspace before deeper CRM modules land.
              </h2>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground">
                This admin area now controls workspace settings, branding, module switches, terminology, and the
                metadata foundations for custom fields and layouts.
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-primary p-6 text-primary-foreground shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] opacity-80">Tenant summary</p>
            <div className="mt-4 space-y-3">
              <div>
                <p className="font-semibold">{tenant?.name ?? "Tenant workspace"}</p>
                <p className="text-sm opacity-85">{tenant?.slug ?? "tenant-slug"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] opacity-75">Option sets</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{summary.optionSetCount}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] opacity-75">Layouts</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{summary.formLayoutCount}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] opacity-75">Custom fields</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{summary.customFieldCount}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] opacity-75">Pipelines</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{summary.pipelineCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AdminNav />

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Workspace settings</CardTitle>
            <CardDescription>
              Update the tenant-facing workspace profile, formatting defaults, and timezone foundation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-2">
                <span className="text-sm font-medium">Workspace name</span>
                <Input
                  value={formState.workspaceName}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      workspaceName: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Timezone</span>
                <Input
                  value={formState.timezone}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      timezone: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Locale</span>
                <Input
                  value={formState.locale}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      locale: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Currency</span>
                <Input
                  value={formState.currency}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      currency: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Date format</span>
                <Input
                  value={formState.dateFormat}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      dateFormat: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Time format</span>
                <select
                  className={selectClassName}
                  value={formState.timeFormat}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      timeFormat: event.target.value as TenantCoreSettings["timeFormat"]
                    }))
                  }
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </label>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save workspace settings"}
                </Button>
                {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
                {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration quick links</CardTitle>
            <CardDescription>
              Jump into the specialized settings pages for theme, modules, naming, and access controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                href: "/admin/theme",
                title: "Theme settings",
                description: "Update branding colors, density, logo, and sidebar/card presentation.",
                icon: Palette
              },
              {
                href: "/admin/modules",
                title: "Module settings",
                description: "Control which modules appear in navigation and route access.",
                icon: Building2
              },
              {
                href: "/admin/terminology",
                title: "Terminology settings",
                description: "Rename business-facing labels like Leads, Accounts, and Tickets.",
                icon: Type
              },
              {
                href: "/admin/custom-fields",
                title: "Custom field foundation",
                description: "Review field metadata, option-set readiness, and form-layout placeholders.",
                icon: Shapes
              },
              {
                href: "/admin/rbac",
                title: "RBAC management",
                description: "Continue managing roles, permissions, and user assignment rules.",
                icon: ShieldCheck
              }
            ].map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex items-start gap-3 rounded-[1.25rem] bg-background/75 p-4 transition hover:bg-secondary/70"
                >
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
