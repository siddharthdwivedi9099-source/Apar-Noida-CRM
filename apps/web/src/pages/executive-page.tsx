import { useEffect, useState } from "react";
import type { CrmLookupUserSummary, ExecutiveCommandCenterResponse, ExecutiveInsightsResponse, ExecutiveKpi, StrategicRisksResponse } from "@crm/types";
import { strategicRiskSeverities, riskStatuses } from "@crm/types";
import { CrmHero, CrmMetricCard } from "@/components/crm/crm-shell";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";


function kpiValue(kpi: ExecutiveKpi): string {
  if (kpi.value === null) return "—";
  if (kpi.unit === "currency") return formatCurrencyAmount(kpi.value);
  if (kpi.unit === "percent") return `${kpi.value}%`;
  return String(kpi.value);
}

export function ExecutivePage() {
  const { accessToken } = useAuth();
  const [cc, setCc] = useState<ExecutiveCommandCenterResponse | null>(null);
  const [insights, setInsights] = useState<ExecutiveInsightsResponse | null>(null);
  const [risks, setRisks] = useState<StrategicRisksResponse | null>(null);
  const [owners, setOwners] = useState<CrmLookupUserSummary[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", region: "", product: "" });
  const [risk, setRisk] = useState({ title: "", source: "manual", ownerId: "", severity: "medium", impact: "", mitigation: "", dueDate: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function query(): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  }

  async function loadAll() {
    if (!accessToken) return;
    try {
      const [c, i, r] = await Promise.all([
        apiRequest<ExecutiveCommandCenterResponse>(`/executive/command-center${query()}`, { accessToken }),
        apiRequest<ExecutiveInsightsResponse>(`/executive/insights${query()}`, { accessToken }),
        apiRequest<StrategicRisksResponse>("/executive/risks", { accessToken })
      ]);
      setCc(c);
      setInsights(i);
      setRisks(r);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadAll();
    if (accessToken) {
      apiRequest<{ owners: CrmLookupUserSummary[] }>("/customer-success/options", { accessToken }).then((o) => setOwners(o.owners)).catch(() => undefined);
    }
     
  }, [accessToken]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) return;
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await loadAll();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <CrmHero eyebrow="Executive" title="Command center" summary="Revenue, pipeline, forecast, health, SLA, partner revenue, and strategic risks at a glance." />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* EXE-001 filters + KPIs */}
      <Card>
        <CardHeader>
          <CardTitle>Business performance</CardTitle>
          <CardDescription>Drill by period, region, and product. AI executive summary is a governed placeholder (EXE-001).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" aria-label="From" value={filters.from} onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))} />
            <Input type="date" aria-label="To" value={filters.to} onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))} />
            <Input placeholder="Region" className="w-32" value={filters.region} onChange={(e) => setFilters((c) => ({ ...c, region: e.target.value }))} />
            <Input placeholder="Product" className="w-32" value={filters.product} onChange={(e) => setFilters((c) => ({ ...c, product: e.target.value }))} />
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("filter", async () => undefined, "Filters applied.")}>Apply</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cc?.kpis.map((kpi) => <CrmMetricCard key={kpi.key} label={kpi.label} value={kpiValue(kpi)} description="" />)}
          </div>
        </CardContent>
      </Card>

      {/* EXE-002 insights */}
      <Card>
        <CardHeader>
          <CardTitle>AI business insights</CardTitle>
          <CardDescription>Pipeline gaps, forecast risk, churn, underperformance, campaign inefficiency, and partner inactivity — with recommended actions (EXE-002).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {insights?.insights.length ? insights.insights.map((ins) => (
            <div key={ins.key} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={ins.severity}>{ins.severity}</StatusPill>
                <span className="font-medium">{ins.message}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Recommended: {ins.recommendedAction}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Assign to {ins.suggestedOwnerRole}:</span>
                <InsightAssign owners={owners} disabled={busy !== null} onAssign={(assignedTo) => void run(`as-${ins.key}`, () => apiRequest("/executive/insights/assign", { method: "POST", accessToken, body: { insightKey: ins.key, title: ins.recommendedAction, description: ins.message, assignedTo } }), "Action assigned to leader.")} />
              </div>
            </div>
          )) : <p className="text-muted-foreground">No insights — business signals are healthy.</p>}
        </CardContent>
      </Card>

      {/* EXE-003 risk register */}
      <Card>
        <CardHeader>
          <CardTitle>Strategic risk register</CardTitle>
          <CardDescription>{risks?.openCount ?? 0} open risk(s). Risks from opportunities, customers, support, renewals, or AI alerts (EXE-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <Input placeholder="Risk title" value={risk.title} onChange={(e) => setRisk((c) => ({ ...c, title: e.target.value }))} disabled={busy !== null} />
            <select className={selectClassName} value={risk.source} onChange={(e) => setRisk((c) => ({ ...c, source: e.target.value }))} disabled={busy !== null} aria-label="Risk source">
              {["opportunity", "customer", "support", "renewal", "ai_alert", "manual"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={selectClassName} value={risk.severity} onChange={(e) => setRisk((c) => ({ ...c, severity: e.target.value }))} disabled={busy !== null} aria-label="Risk severity">
              {strategicRiskSeverities.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={selectClassName} value={risk.ownerId} onChange={(e) => setRisk((c) => ({ ...c, ownerId: e.target.value }))} disabled={busy !== null} aria-label="Risk owner">
              <option value="">Owner (required)…</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
            </select>
            <Input placeholder="Mitigation" value={risk.mitigation} onChange={(e) => setRisk((c) => ({ ...c, mitigation: e.target.value }))} disabled={busy !== null} />
            <Input type="date" aria-label="Due date" value={risk.dueDate} onChange={(e) => setRisk((c) => ({ ...c, dueDate: e.target.value }))} disabled={busy !== null} />
          </div>
          <Button type="button" disabled={busy !== null || !risk.title || !risk.ownerId} onClick={() => void run("risk", async () => { await apiRequest("/executive/risks", { method: "POST", accessToken, body: { title: risk.title, source: risk.source, severity: risk.severity, ownerId: risk.ownerId, mitigation: risk.mitigation || null, dueDate: risk.dueDate || null } }); setRisk({ title: "", source: "manual", ownerId: "", severity: "medium", impact: "", mitigation: "", dueDate: "" }); }, "Strategic risk registered.")}>Register risk</Button>

          {risks?.risks.length ? risks.risks.map((r) => (
            <div key={r.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={r.severity}>{r.severity}</StatusPill>
                <span className="font-medium">{r.title}</span>
                <Badge variant="muted">{r.source}</Badge>
                <StatusPill size="sm" value={r.status}>{r.status}</StatusPill>
                {r.dueDate ? <span className="text-xs text-muted-foreground">due {r.dueDate}</span> : null}
                <select className={selectClassName} value={r.status} onChange={(e) => void run(`rs-${r.id}`, () => apiRequest(`/executive/risks/${r.id}`, { method: "PATCH", accessToken, body: { status: e.target.value } }), "Risk status updated.")} disabled={busy !== null} aria-label="Update risk status">
                  {riskStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {r.mitigation ? <p className="mt-1 text-xs text-muted-foreground">Mitigation: {r.mitigation}</p> : null}
            </div>
          )) : <p className="text-muted-foreground">No strategic risks registered.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function InsightAssign({ owners, disabled, onAssign }: { owners: CrmLookupUserSummary[]; disabled: boolean; onAssign: (id: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <select className={selectClassName} value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} aria-label="Assign leader">
        <option value="">Leader…</option>
        {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={disabled || !value} onClick={() => onAssign(value)}>Assign</Button>
    </div>
  );
}
