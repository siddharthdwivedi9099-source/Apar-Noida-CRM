import { useEffect, useState } from "react";
import type { TenantThemeSettings } from "@crm/types";
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

export function ThemeSettingsPage() {
  const { accessToken } = useAuth();
  const { theme, reload } = useTenantConfig();
  const [formState, setFormState] = useState<TenantThemeSettings>(theme);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState(theme);
  }, [theme]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest("/tenant-config/theme", {
        method: "PUT",
        accessToken,
        body: formState
      });
      await reload();
      setSuccessMessage("Theme settings were updated and applied.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-8 lg:p-10">
        <Badge>Theme Configuration</Badge>
        <div className="mt-5 space-y-3">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Control tenant branding, density, and visual tone from one page.
          </h2>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Saved changes apply through the shared shell so the sidebar, cards, accents, and typography stay aligned.
          </p>
        </div>
      </section>

      <AdminNav />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Theme settings</CardTitle>
            <CardDescription>
              Adjust the tenant logo, colors, mode, sidebar style, card style, font choice, and density.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Logo URL</span>
                <Input
                  value={formState.logo ?? ""}
                  placeholder="https://example.com/logo.svg"
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      logo: event.target.value.trim() || null
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Primary color</span>
                <Input
                  value={formState.primaryColor}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      primaryColor: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Secondary color</span>
                <Input
                  value={formState.secondaryColor}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      secondaryColor: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Accent color</span>
                <Input
                  value={formState.accentColor}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      accentColor: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Mode</span>
                <select
                  className={selectClassName}
                  value={formState.mode}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      mode: event.target.value as TenantThemeSettings["mode"]
                    }))
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Sidebar style</span>
                <select
                  className={selectClassName}
                  value={formState.sidebarStyle}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      sidebarStyle: event.target.value as TenantThemeSettings["sidebarStyle"]
                    }))
                  }
                >
                  <option value="glass">Glass</option>
                  <option value="solid">Solid</option>
                  <option value="contrast">Contrast</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Card style</span>
                <select
                  className={selectClassName}
                  value={formState.cardStyle}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      cardStyle: event.target.value as TenantThemeSettings["cardStyle"]
                    }))
                  }
                >
                  <option value="glass">Glass</option>
                  <option value="solid">Solid</option>
                  <option value="outline">Outline</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Font preference</span>
                <select
                  className={selectClassName}
                  value={formState.fontPreference}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      fontPreference: event.target.value as TenantThemeSettings["fontPreference"]
                    }))
                  }
                >
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="system">System</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Layout density</span>
                <select
                  className={selectClassName}
                  value={formState.density}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      density: event.target.value as TenantThemeSettings["density"]
                    }))
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>

              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save theme settings"}
                </Button>
                {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
                {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This preview mirrors the saved shell direction with your selected colors and layout decisions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="overflow-hidden rounded-[1.75rem] border shadow-panel"
              style={{
                background:
                  formState.mode === "dark"
                    ? "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,41,59,0.92))"
                    : "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(241,245,249,0.95))",
                borderColor: `${formState.primaryColor}40`
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{
                  background:
                    formState.sidebarStyle === "contrast"
                      ? formState.primaryColor
                      : `${formState.secondaryColor}22`,
                  color: formState.sidebarStyle === "contrast" ? "#fff" : undefined
                }}
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-70">Sidebar</p>
                  <p className="font-display text-lg font-semibold">Tenant shell preview</p>
                </div>
                <Badge variant="muted">{formState.mode}</Badge>
              </div>
              <div className="grid gap-4 p-5">
                <div className="rounded-[1.25rem] p-4" style={{ background: `${formState.primaryColor}18` }}>
                  <p className="text-sm font-semibold">Primary accent</p>
                  <p className="mt-2 text-sm opacity-80">{formState.primaryColor}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.25rem] p-4" style={{ background: `${formState.secondaryColor}20` }}>
                    <p className="text-sm font-semibold">Secondary</p>
                    <p className="mt-2 text-sm opacity-80">{formState.secondaryColor}</p>
                  </div>
                  <div className="rounded-[1.25rem] p-4" style={{ background: `${formState.accentColor}20` }}>
                    <p className="text-sm font-semibold">Accent</p>
                    <p className="mt-2 text-sm opacity-80">{formState.accentColor}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
