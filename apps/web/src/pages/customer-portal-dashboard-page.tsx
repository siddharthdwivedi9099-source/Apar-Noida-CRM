import { useEffect, useState } from "react";
import type { CustomerPortalDashboardResponse, PortalDemoRequestResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function CustomerPortalDashboardPage() {
  const { accessToken } = useAuth();
  const [dashboard, setDashboard] = useState<CustomerPortalDashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void apiRequest<CustomerPortalDashboardResponse>("/customer-portal/dashboard", { accessToken })
      .then((response) => {
        if (!cancelled) {
          setDashboard(response);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setErrorMessage(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer portal unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading portal dashboard...</CardTitle>
          <CardDescription>Gathering your account tickets, training, and knowledge access.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const metrics = [
    ["Open tickets", dashboard.metrics.openTicketCount],
    ["Resolved tickets", dashboard.metrics.resolvedTicketCount],
    ["Assigned training", dashboard.metrics.trainingAssignedCount],
    ["Completed training", dashboard.metrics.trainingCompletedCount],
    ["Knowledge articles", dashboard.metrics.knowledgeArticleCount],
    ["AI sessions", dashboard.metrics.activeAiSessionCount]
  ] as const;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-white/40 bg-white/35 dark:border-slate-700/50 dark:bg-slate-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Badge>Account Portal</Badge>
              <CardTitle className="mt-3 text-3xl">{dashboard.profile.account.name}</CardTitle>
              <CardDescription>
                View only your customer account data: tickets, training, approved knowledge, and customer-safe AI.
              </CardDescription>
            </div>
            <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm dark:bg-slate-950/45">
              <p className="font-semibold">{dashboard.profile.displayName}</p>
              <p className="text-muted-foreground">{dashboard.profile.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-white/55 p-4 dark:bg-slate-950/35">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product Announcements</CardTitle>
            <CardDescription>Placeholder area for release notes and account-specific updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.placeholders.productAnnouncements.map((announcement) => (
              <div key={announcement.title} className="rounded-2xl border border-dashed border-border p-4">
                <Badge variant="muted">{announcement.status}</Badge>
                <p className="mt-3 font-semibold">{announcement.title}</p>
                <p className="text-sm text-muted-foreground">{announcement.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Feedback / CSAT</CardTitle>
            <CardDescription>Customer satisfaction capture is available from the profile page.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border bg-white/50 p-4 dark:bg-slate-950/30">
              <p className="font-semibold">{dashboard.placeholders.feedback.csatEnabled ? "CSAT ready" : "CSAT disabled"}</p>
              <p className="text-sm text-muted-foreground">{dashboard.placeholders.feedback.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DemoRequestCard />
    </div>
  );
}

function DemoRequestCard() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", companyName: "", email: "", productInterest: "", preferredDate: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((c) => ({ ...c, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setErrorMessage(null);
    try {
      const response = await apiRequest<PortalDemoRequestResponse>("/customer-portal/demo-request", {
        method: "POST",
        accessToken,
        body: { ...form, preferredDate: form.preferredDate || null }
      });
      setMessage(response.confirmationMessage);
      setForm({ firstName: "", lastName: "", companyName: "", email: "", productInterest: "", preferredDate: "" });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a demo</CardTitle>
        <CardDescription>Tell us what you'd like to see and our sales team will reach out.</CardDescription>
      </CardHeader>
      <CardContent>
        {message ? <p className="mb-3 text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="mb-3 text-sm text-rose-600">{errorMessage}</p> : null}
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={submit}>
          <Input placeholder="First name" value={form.firstName} onChange={set("firstName")} disabled={busy} required />
          <Input placeholder="Last name" value={form.lastName} onChange={set("lastName")} disabled={busy} required />
          <Input placeholder="Company" value={form.companyName} onChange={set("companyName")} disabled={busy} required />
          <Input type="email" placeholder="Email" value={form.email} onChange={set("email")} disabled={busy} required />
          <Input placeholder="Product interest" value={form.productInterest} onChange={set("productInterest")} disabled={busy} required />
          <Input type="date" aria-label="Preferred date" value={form.preferredDate} onChange={set("preferredDate")} disabled={busy} />
          <div className="sm:col-span-2"><Button type="submit" disabled={busy}>Request demo</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
