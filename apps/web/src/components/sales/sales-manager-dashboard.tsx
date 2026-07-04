import { useEffect, useState } from "react";
import type {
  ApprovalsResponse,
  CrmLookupUserSummary,
  ManagerForecastResponse,
  ManagerLeadSlaResponse,
  ManagerPerformanceResponse,
  ManagerPipelineResponse,
  SalesWorkspaceOptionsResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SalesManagerDashboardProps {
  accessToken: string | null;
  canManage: boolean;
}

export function SalesManagerDashboard({ accessToken, canManage }: SalesManagerDashboardProps) {
  const [pipeline, setPipeline] = useState<ManagerPipelineResponse | null>(null);
  const [forecast, setForecast] = useState<ManagerForecastResponse | null>(null);
  const [performance, setPerformance] = useState<ManagerPerformanceResponse | null>(null);
  const [leadSla, setLeadSla] = useState<ManagerLeadSlaResponse | null>(null);
  const [discounts, setDiscounts] = useState<ApprovalsResponse | null>(null);
  const [owners, setOwners] = useState<CrmLookupUserSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reassign, setReassign] = useState<Record<string, { ownerId: string; reason: string }>>({});

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [p, f, perf, sla, opts] = await Promise.all([
        apiRequest<ManagerPipelineResponse>("/opportunities/manager/pipeline", { method: "GET", accessToken }),
        apiRequest<ManagerForecastResponse>("/opportunities/manager/forecast", { method: "GET", accessToken }),
        apiRequest<ManagerPerformanceResponse>("/opportunities/manager/performance", { method: "GET", accessToken }),
        apiRequest<ManagerLeadSlaResponse>("/sales-workspaces/manager/lead-sla", { method: "GET", accessToken }),
        apiRequest<SalesWorkspaceOptionsResponse>("/sales-workspaces/options", { method: "GET", accessToken })
      ]);
      setPipeline(p);
      setForecast(f);
      setPerformance(perf);
      setLeadSla(sla);
      setOwners(opts.owners);
      try {
        const d = await apiRequest<ApprovalsResponse>("/approvals?approvalType=discount_approval&status=pending", { method: "GET", accessToken });
        setDiscounts(d);
      } catch {
        setDiscounts(null);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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

  if (!pipeline || !forecast || !performance || !leadSla) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Team pipeline</CardTitle>
          <CardDescription>
            {pipeline.totalOpen} open · {formatCurrencyAmount(pipeline.pipelineValue)} pipeline · {formatCurrencyAmount(pipeline.weightedValue)} weighted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-background/75 p-3">
              <p className="text-sm font-semibold">By owner</p>
              {pipeline.byOwner.map((o) => (
                <div key={o.owner?.id ?? "unassigned"} className="mt-1 flex items-center justify-between text-sm">
                  <span>{o.owner?.displayName ?? "Unassigned"}</span>
                  <span>{o.openCount} · {formatCurrencyAmount(o.pipelineValue)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-3">
              <p className="text-sm font-semibold">Aging</p>
              {pipeline.aging.map((a) => (
                <div key={a.bucket} className="mt-1 flex items-center justify-between text-sm">
                  <span>{a.bucket}</span>
                  <span>{a.count} · {formatCurrencyAmount(a.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.25rem] bg-background/75 p-3">
            <p className="text-sm font-semibold">High-risk deals ({pipeline.highRiskDeals.length})</p>
            {pipeline.highRiskDeals.slice(0, 8).map((d) => (
              <div key={d.id} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{d.name} · {d.owner?.displayName ?? "Unassigned"}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={d.risk === "high" ? "default" : "muted"}>{d.risk}</Badge>
                  <span className="text-xs text-muted-foreground">{d.riskReasons.join(", ")}</span>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Forecast</CardTitle>
            <CardDescription>Won {formatCurrencyAmount(forecast.wonValue)} · open weighted {formatCurrencyAmount(forecast.openWeightedValue)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {forecast.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categorized open pipeline yet.</p>
            ) : (
              forecast.categories.map((c) => (
                <div key={c.category?.key ?? "uncat"} className="flex items-center justify-between text-sm">
                  <span>{c.category?.label ?? "Uncategorized"}</span>
                  <span>{c.count} · {formatCurrencyAmount(c.value)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rep performance</CardTitle>
            <CardDescription>Win rate, conversion, deal size, cycle time per rep (SMGR-006).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {performance.reps.map((r) => (
              <div key={r.owner?.id ?? "unassigned"} className="rounded-[1rem] bg-background/75 p-2 text-sm">
                <p className="font-medium">{r.owner?.displayName ?? "Unassigned"}</p>
                <p className="text-xs text-muted-foreground">
                  win {r.winRate}% · conv {r.conversionRate}% · avg {formatCurrencyAmount(r.avgDealSize)} · cycle {r.avgCycleDays}d · {r.wonCount}W/{r.lostCount}L
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Lead SLA</CardTitle>
          <CardDescription>
            {leadSla.assignedCount} assigned · {leadSla.acceptedCount} accepted · {leadSla.overdueFirstContactCount} overdue first contact · {leadSla.untouchedCount} untouched · {leadSla.breachedCount} breached
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {leadSla.leads.filter((l) => l.slaStatus === "breached" || l.untouched).slice(0, 12).map((l) => (
            <div key={l.id} className="rounded-[1rem] bg-background/75 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{l.fullName} · {l.companyName}</span>
                <span className="flex items-center gap-2">
                  {l.slaStatus ? <Badge variant={l.slaStatus === "breached" ? "default" : "muted"}>SLA {l.slaStatus}</Badge> : null}
                  {l.untouched ? <Badge variant="muted">untouched</Badge> : null}
                </span>
              </div>
              {canManage ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <select className={selectClassName} value={reassign[l.id]?.ownerId ?? ""} onChange={(event) => setReassign((c) => ({ ...c, [l.id]: { ownerId: event.target.value, reason: c[l.id]?.reason ?? "" } }))} disabled={busy !== null}>
                    <option value="">Reassign to…</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>{owner.displayName}</option>
                    ))}
                  </select>
                  <Input placeholder="Reason" value={reassign[l.id]?.reason ?? ""} onChange={(event) => setReassign((c) => ({ ...c, [l.id]: { ownerId: c[l.id]?.ownerId ?? "", reason: event.target.value } }))} disabled={busy !== null} />
                  <Button type="button" variant="outline" disabled={busy !== null || !reassign[l.id]?.ownerId || !(reassign[l.id]?.reason ?? "").trim()} onClick={() => void run(`reassign-${l.id}`, () => apiRequest(`/sales-workspaces/leads/${l.id}/reassign`, { method: "POST", accessToken, body: { ownerId: reassign[l.id].ownerId, reason: reassign[l.id].reason.trim() } }), "Lead reassigned.")}>
                    Reassign
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discount approvals</CardTitle>
          <CardDescription>Pending discount requests within your authority (SMGR-004).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(discounts?.approvals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending discount approvals.</p>
          ) : (
            (discounts?.approvals ?? []).map((a) => (
              <div key={a.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
                <p className="font-medium">{a.title}</p>
                {a.description ? <p className="mt-1 text-muted-foreground">{a.description}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">Requested {formatDateTime(a.createdAt)}</p>
                {canManage ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" disabled={busy !== null} onClick={() => void run(`appr-${a.id}`, () => apiRequest(`/approvals/${a.id}/decision`, { method: "POST", accessToken, body: { decision: "approved" } }), "Approved.")}>
                      Approve
                    </Button>
                    <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(`rej-${a.id}`, () => apiRequest(`/approvals/${a.id}/decision`, { method: "POST", accessToken, body: { decision: "rejected" } }), "Rejected.")}>
                      Reject
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`rev-${a.id}`, () => apiRequest(`/approvals/${a.id}/comments`, { method: "POST", accessToken, body: { comment: "Please revise and resubmit." } }), "Revision requested.")}>
                      Request revision
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
