import { useEffect, useState } from "react";
import type { TenantTerminologyEntry } from "@crm/types";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

const textareaClassName =
  "flex min-h-[96px] w-full rounded-[1.25rem] border border-input bg-background px-4 py-3 text-sm shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function TerminologySettingsPage() {
  const { accessToken } = useAuth();
  const { terminology, reload } = useTenantConfig();
  const [draftTerminology, setDraftTerminology] = useState<TenantTerminologyEntry[]>(terminology);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftTerminology(terminology);
  }, [terminology]);

  async function handleSave() {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest("/tenant-config/terminology", {
        method: "PUT",
        accessToken,
        body: {
          terminology: draftTerminology
        }
      });
      await reload();
      setSuccessMessage("Terminology settings were updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-8 lg:p-10">
        <Badge>Terminology Configuration</Badge>
        <div className="mt-5 space-y-3">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Rename core business language without changing the underlying module model.
          </h2>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            These labels feed the live shell, so navigation and page titles can adapt to each tenant&apos;s preferred
            language.
          </p>
        </div>
      </section>

      <AdminNav />

      <Card>
        <CardHeader>
          <CardTitle>Business labels</CardTitle>
          <CardDescription>
            Configure singular and plural terminology for the main modules already exposed in the UI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {draftTerminology.map((entry) => (
              <div key={entry.moduleKey} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <p className="font-display text-xl font-semibold">{entry.moduleKey}</p>
                  <Badge variant="muted">Live label</Badge>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Singular</span>
                    <Input
                      value={entry.singular}
                      onChange={(event) =>
                        setDraftTerminology((currentValue) =>
                          currentValue.map((candidate) =>
                            candidate.moduleKey === entry.moduleKey
                              ? {
                                  ...candidate,
                                  singular: event.target.value
                                }
                              : candidate
                          )
                        )
                      }
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Plural</span>
                    <Input
                      value={entry.plural}
                      onChange={(event) =>
                        setDraftTerminology((currentValue) =>
                          currentValue.map((candidate) =>
                            candidate.moduleKey === entry.moduleKey
                              ? {
                                  ...candidate,
                                  plural: event.target.value
                                }
                              : candidate
                          )
                        )
                      }
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Description</span>
                    <textarea
                      className={textareaClassName}
                      value={entry.description ?? ""}
                      onChange={(event) =>
                        setDraftTerminology((currentValue) =>
                          currentValue.map((candidate) =>
                            candidate.moduleKey === entry.moduleKey
                              ? {
                                  ...candidate,
                                  description: event.target.value.trim() || null
                                }
                              : candidate
                          )
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save terminology"}
            </Button>
            {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
