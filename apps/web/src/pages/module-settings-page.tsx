import { useEffect, useState } from "react";
import type { TenantModuleState } from "@crm/types";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function ModuleSettingsPage() {
  const { accessToken } = useAuth();
  const { modules, reload } = useTenantConfig();
  const [draftModules, setDraftModules] = useState<TenantModuleState[]>(modules);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftModules(modules);
  }, [modules]);

  async function handleSave() {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest("/tenant-config/modules", {
        method: "PUT",
        accessToken,
        body: {
          modules: draftModules.map((module) => ({
            moduleKey: module.moduleKey,
            enabled: module.enabled
          }))
        }
      });
      await reload();
      setSuccessMessage("Module settings were updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-8 lg:p-10">
        <Badge>Module Configuration</Badge>
        <div className="mt-5 space-y-3">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Control which modules the tenant sees from the first page load.
          </h2>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Disabled modules drop out of navigation and route access even for users who still hold the relevant RBAC
            permissions.
          </p>
        </div>
      </section>

      <AdminNav />

      <Card>
        <CardHeader>
          <CardTitle>Tenant module switches</CardTitle>
          <CardDescription>
            Locked modules stay on for safety. Everything else can be enabled or disabled tenant-wide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {draftModules.map((module) => (
              <div key={module.moduleKey} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-xl font-semibold">{module.label}</p>
                      <Badge variant={module.enabled ? "success" : "muted"}>
                        {module.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {module.locked ? <Badge variant="muted">Locked</Badge> : null}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{module.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant={module.enabled ? "outline" : "default"}
                    disabled={module.locked}
                    onClick={() =>
                      setDraftModules((currentValue) =>
                        currentValue.map((entry) =>
                          entry.moduleKey === module.moduleKey
                            ? {
                                ...entry,
                                enabled: !entry.enabled
                              }
                            : entry
                        )
                      )
                    }
                  >
                    {module.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save module settings"}
            </Button>
            {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
