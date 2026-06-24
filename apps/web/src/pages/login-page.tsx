import { useState } from "react";
import { platformMetadata } from "@crm/config";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [tenantSlug, setTenantSlug] = useState(import.meta.env.VITE_DEFAULT_TENANT_SLUG ?? "sample-tenant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Default to the workspace root so the post-login landing page is resolved
  // from the signed-in user's own permissions (e.g. portal users land in the
  // portal), rather than forcing everyone to the internal dashboard.
  const redirectTarget = (location.state as { from?: string } | null)?.from ?? "/";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({
        tenantSlug,
        email,
        password
      });

      navigate(redirectTarget, { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to complete sign-in right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero-glow px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="glass-panel flex flex-col justify-between rounded-[2rem] p-8 lg:p-12">
          <div className="space-y-6">
            <Badge variant="success">Secure access</Badge>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{platformMetadata.shortName}</p>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-tight">
                Tenant-aware access, shared CRM productivity, and audit-friendly platform entry.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                PostgreSQL-backed identity scaffolding now sits under tenant-aware RBAC, role templates, protected
                routes, permission-aware navigation, tenant configuration, and shared timeline-ready CRM workflows so
                the shell can move from secure access into governed daily use.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Tenant slug",
                value: "sample-tenant"
              },
              {
                title: "Role-based demo login",
                value: "<role>@sample-tenant.local"
              },
              {
                title: "Demo password",
                value: "Demo@1234"
              }
            ].map((credential) => (
              <div key={credential.title} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{credential.title}</p>
                <p className="mt-2 break-all font-medium">{credential.value}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="self-center">
          <CardHeader>
            <Badge>Secure login</Badge>
            <CardTitle className="pt-3">Sign in to the initialized tenant workspace</CardTitle>
            <CardDescription>
              Public signup is intentionally disabled. Users are expected to be seeded or created by an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="tenantSlug">
                  Tenant slug
                </label>
                <Input
                  id="tenantSlug"
                  autoComplete="organization"
                  value={tenantSlug}
                  onChange={(event) => setTenantSlug(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  autoComplete="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  autoComplete="current-password"
                  type="password"
                  required
                  placeholder="Your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {errorMessage ? (
                <div className="rounded-[1.25rem] border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                  {errorMessage}
                </div>
              ) : null}

              <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="rounded-[1.25rem] bg-background/80 p-5">
              <p className="text-sm font-medium">Current phase scope</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Authentication, RBAC enforcement, tenant configuration, and permission-aware navigation are
                implemented. Public registration still stays out of scope.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
