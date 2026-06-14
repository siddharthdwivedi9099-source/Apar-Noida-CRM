import { authFoundation } from "@crm/auth";
import { platformMetadata } from "@crm/config";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-hero-glow px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="glass-panel flex flex-col justify-between rounded-[2rem] p-8 lg:p-12">
          <div className="space-y-6">
            <Badge variant="success">Phase 1 ready</Badge>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{platformMetadata.shortName}</p>
              <h1 className="max-w-3xl font-display text-5xl font-semibold leading-tight">
                Production-minded CRM foundations with an AI-native control plane.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Authentication is intentionally not implemented yet, but the shell, routing, theming, and shared
                packages are now initialized so Phase 2 can focus on secure access and domain delivery.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {authFoundation.protectedRoutes.slice(0, 3).map((routePath) => (
              <div key={routePath} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preview route</p>
                <p className="mt-2 font-medium">{routePath}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="self-center">
          <CardHeader>
            <Badge>Login placeholder</Badge>
            <CardTitle className="pt-3">Authentication lands in the next delivery phase</CardTitle>
            <CardDescription>
              This page holds the future login experience while keeping the app navigable for foundation review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.25rem] bg-background/80 p-5">
              <p className="text-sm font-medium">Planned here</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                SSO, session management, tenant-aware login flows, and role-sensitive post-login routing.
              </p>
            </div>
            <Button asChild className="w-full" size="lg">
              <Link to="/dashboard">Enter the initialized workspace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

