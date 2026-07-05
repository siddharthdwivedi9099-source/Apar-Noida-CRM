import { useEffect, useState, type FormEvent } from "react";
import type { PartnerDealRegistrationsResponse, PartnerManagementResponse, PartnerManagementView } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface PartnerManagementPanelProps {
  partnerId: string;
  accessToken: string | null;
  canManage: boolean;
}

const APP_FIELDS: Array<[string, string]> = [
  ["companyDetails", "Company details"], ["geography", "Geography"], ["industryFocus", "Industry focus"],
  ["salesCapacity", "Sales capacity"], ["technicalCapability", "Technical capability"], ["customerBase", "Customer base"],
  ["certifications", "Certifications"], ["references", "References"]
];

export function PartnerManagementPanel({ partnerId, accessToken, canManage }: PartnerManagementPanelProps) {
  const [view, setView] = useState<PartnerManagementView | null>(null);
  const [deals, setDeals] = useState<PartnerDealRegistrationsResponse["deals"]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [app, setApp] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState({ salesCapacityRating: "", technicalCapabilityRating: "", customerBaseSize: "" });

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [mgmt, dealsResponse] = await Promise.all([
        apiRequest<PartnerManagementResponse>(`/partners/${partnerId}/management`, { method: "GET", accessToken }),
        apiRequest<PartnerDealRegistrationsResponse>(`/partners/${partnerId}/deals`, { method: "GET", accessToken })
      ]);
      setView(mgmt.management);
      setDeals(dealsResponse.deals);
      const a = mgmt.management.application;
      setApp(Object.fromEntries(APP_FIELDS.map(([key]) => [key, (a as unknown as Record<string, string | null>)[key] ?? ""])) as Record<string, string>);
      setRatings({ salesCapacityRating: a.salesCapacityRating === null ? "" : String(a.salesCapacityRating), technicalCapabilityRating: a.technicalCapabilityRating === null ? "" : String(a.technicalCapabilityRating), customerBaseSize: a.customerBaseSize === null ? "" : String(a.customerBaseSize) });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
     
  }, [accessToken, partnerId]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function handleApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("app", () => apiRequest(`/partners/${partnerId}/application`, { method: "PUT", accessToken, body: {
      ...app,
      salesCapacityRating: ratings.salesCapacityRating === "" ? null : Number(ratings.salesCapacityRating),
      technicalCapabilityRating: ratings.technicalCapabilityRating === "" ? null : Number(ratings.technicalCapabilityRating),
      customerBaseSize: ratings.customerBaseSize === "" ? null : Number(ratings.customerBaseSize)
    } }), "Application saved.");
  }

  if (!view) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* PM-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Partner application</CardTitle>
          <CardDescription>
            Status: <Badge variant="muted">{view.application.status}</Badge> · fit score {view.fitScore.score} ({view.fitScore.band}). AI fit scoring is a governed placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form className="space-y-2" onSubmit={handleApplication}>
              <div className="grid gap-2 md:grid-cols-2">
                {APP_FIELDS.map(([key, label]) => (
                  <textarea key={key} className={textareaClassName} rows={2} placeholder={label} value={app[key] ?? ""} onChange={(event) => setApp((c) => ({ ...c, [key]: event.target.value }))} disabled={busy !== null} />
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input type="number" placeholder="Sales capacity rating (0-5)" value={ratings.salesCapacityRating} onChange={(event) => setRatings((c) => ({ ...c, salesCapacityRating: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Technical rating (0-5)" value={ratings.technicalCapabilityRating} onChange={(event) => setRatings((c) => ({ ...c, technicalCapabilityRating: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Customer base size" value={ratings.customerBaseSize} onChange={(event) => setRatings((c) => ({ ...c, customerBaseSize: event.target.value }))} disabled={busy !== null} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy !== null}>Save application</Button>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("app-approve", () => apiRequest(`/partners/${partnerId}/application/decision`, { method: "POST", accessToken, body: { decision: "approved" } }), "Partner approved.")}>Approve</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("app-review", () => apiRequest(`/partners/${partnerId}/application/decision`, { method: "POST", accessToken, body: { decision: "under_review" } }), "Marked under review.")}>Under review</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("app-reject", () => apiRequest(`/partners/${partnerId}/application/decision`, { method: "POST", accessToken, body: { decision: "rejected" } }), "Partner rejected.")}>Reject</Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* PM-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>{view.onboarding.completedCount}/{view.onboarding.totalCount} complete ({view.onboarding.percentComplete}%). Steps carry due dates as reminders (PM-002).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.onboarding.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-[1rem] bg-background/75 p-2 text-sm">
              <span>{item.label}{item.dueDate ? <span className="text-xs text-muted-foreground"> · due {item.dueDate}</span> : null}</span>
              <Badge variant={item.status === "completed" ? "muted" : "default"}>{item.status}</Badge>
            </div>
          ))}
          {canManage ? <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("onboard", () => apiRequest(`/partners/${partnerId}/onboarding/generate`, { method: "POST", accessToken, body: {} }), "Onboarding checklist generated.")}>Generate checklist</Button> : null}
        </CardContent>
      </Card>

      {/* PM-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Deal registrations</CardTitle>
          <CardDescription>Approve, reject, or request clarification; approval starts a protection period (PM-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {deals.length === 0 ? <p className="text-sm text-muted-foreground">No registered deals.</p> : deals.map((deal) => (
            <div key={deal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
              <span>{deal.name} · {deal.customerName ?? "—"} · {formatCurrencyAmount(deal.amount)} <Badge variant="muted">{deal.stage?.label ?? "—"}</Badge></span>
              {canManage ? (
                <span className="flex gap-2">
                  <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(`deal-a-${deal.id}`, () => apiRequest(`/partners/${partnerId}/deals/${deal.id}/decision`, { method: "POST", accessToken, body: { decision: "approved" } }), "Deal approved.")}>Approve</Button>
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`deal-c-${deal.id}`, () => apiRequest(`/partners/${partnerId}/deals/${deal.id}/decision`, { method: "POST", accessToken, body: { decision: "clarification" } }), "Clarification requested.")}>Clarify</Button>
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`deal-r-${deal.id}`, () => apiRequest(`/partners/${partnerId}/deals/${deal.id}/decision`, { method: "POST", accessToken, body: { decision: "rejected" } }), "Deal rejected.")}>Reject</Button>
                </span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
