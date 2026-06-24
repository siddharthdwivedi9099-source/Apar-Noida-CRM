import { useEffect, useState } from "react";
import type {
  DashboardCatalogResponse,
  DashboardDataResponse,
  DashboardDrilldownResponse,
  DashboardSavedViewListResponse,
  DashboardSummary,
  DashboardWidgetData
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 rounded-xl border border-border bg-white/80 px-3 text-sm";

function Bars({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {data.map((entry, index) => (
        <li key={index} className="text-xs">
          <div className="flex items-center justify-between"><span>{entry.label}</span><span className="font-medium">{entry.value}</span></div>
          <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(entry.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Widget({ widget, dashboardKey, onDrilldown }: { widget: DashboardWidgetData; dashboardKey: string; onDrilldown: (w: DashboardWidgetData) => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{widget.label}</CardTitle>
          {widget.drilldown ? <Button size="sm" variant="outline" onClick={() => onDrilldown(widget)}>Drill down</Button> : null}
        </div>
        <CardDescription className="text-xs">{widget.metricKey}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {widget.kind === "scalar" ? (
          <div>
            <p className="text-3xl font-semibold">{widget.value === null ? "—" : widget.value.toLocaleString()}{widget.unit === "%" ? "%" : ""}</p>
            {widget.unit && widget.unit !== "%" ? <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{widget.unit}</p> : null}
          </div>
        ) : null}
        {widget.type === "kanban" ? (
          <div className="flex flex-wrap gap-2">
            {widget.breakdown.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : widget.breakdown.map((column, index) => (
              <div key={index} className="min-w-[88px] rounded-[0.75rem] border border-border/60 bg-background/75 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{column.label}</p>
                <p className="text-xl font-semibold">{column.value}</p>
              </div>
            ))}
          </div>
        ) : null}
        {widget.type !== "kanban" && (widget.kind === "breakdown" || widget.kind === "funnel") ? <Bars data={widget.breakdown} /> : null}
        {widget.kind === "series" ? <Bars data={widget.series} /> : null}
        {widget.kind === "table" ? (
          widget.rows.length === 0 ? <p className="text-muted-foreground">No records.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground">{Object.keys(widget.rows[0]).filter((k) => k !== "id").map((k) => (<th key={k} className="py-1 pr-3">{k}</th>))}</tr></thead>
                <tbody>
                  {widget.rows.slice(0, 8).map((row, ri) => (
                    <tr key={ri} className="border-t border-border/50">{Object.keys(widget.rows[0]).filter((k) => k !== "id").map((k) => (<td key={k} className="py-1 pr-3">{String((row as Record<string, unknown>)[k] ?? "—")}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
        {widget.note ? <p className="mt-2 text-xs text-muted-foreground">{widget.note}</p> : null}
      </CardContent>
    </Card>
  );
}

// Per-user, per-browser preferred default dashboard (configurable on each login).
function defaultDashboardStorageKey(userId: string | undefined) {
  return `crm:default-dashboard:${userId ?? "anon"}`;
}

function resolveDashboardSelection(dashboards: DashboardSummary[], currentKey: string | null, savedDefault: string | null) {
  const currentIsPermitted = currentKey
    ? dashboards.some((dashboard) => dashboard.key === currentKey && dashboard.permitted)
    : false;

  if (currentIsPermitted) {
    return currentKey;
  }

  const savedIsPermitted = savedDefault
    ? dashboards.some((dashboard) => dashboard.key === savedDefault && dashboard.permitted)
    : false;

  if (savedIsPermitted) {
    return savedDefault;
  }

  return dashboards.find((dashboard) => dashboard.permitted)?.key ?? null;
}

export function AnalyticsDashboardsPage() {
  const { accessToken, user } = useAuth();
  const [catalog, setCatalog] = useState<DashboardCatalogResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [defaultKey, setDefaultKey] = useState<string | null>(null);
  const [data, setData] = useState<DashboardDataResponse | null>(null);
  const [views, setViews] = useState<DashboardSavedViewListResponse["views"]>([]);
  const [drilldown, setDrilldown] = useState<DashboardDrilldownResponse | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewName, setViewName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadCatalog() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiRequest<DashboardCatalogResponse>("/dashboards", { method: "GET", accessToken });
      setCatalog(res);
      const savedDefault = typeof window !== "undefined" ? window.localStorage.getItem(defaultDashboardStorageKey(user?.id)) : null;
      setDefaultKey(savedDefault);
      setSelectedKey((currentKey) => resolveDashboardSelection(res.dashboards, currentKey, savedDefault));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDashboard(key: string) {
    if (!accessToken) {
      return;
    }
    setErrorMessage(null);
    setDrilldown(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const [dataRes, viewsRes] = await Promise.all([
        apiRequest<DashboardDataResponse>(`/dashboards/${key}${suffix}`, { method: "GET", accessToken }),
        apiRequest<DashboardSavedViewListResponse>(`/dashboards/${key}/views`, { method: "GET", accessToken }).catch(() => ({ views: [] }))
      ]);
      setData(dataRes);
      setViews(viewsRes.views);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    setCatalog(null);
    setSelectedKey(null);
    setData(null);
    setViews([]);
    setDrilldown(null);
    void loadCatalog();
  }, [accessToken, user?.id]);

  useEffect(() => {
    if (selectedKey) {
      void loadDashboard(selectedKey);
      return;
    }
    setData(null);
    setViews([]);
    setDrilldown(null);
  }, [selectedKey]);

  async function openDrilldown(widget: DashboardWidgetData) {
    if (!accessToken || !selectedKey) {
      return;
    }
    try {
      const res = await apiRequest<DashboardDrilldownResponse>(`/dashboards/${selectedKey}/widgets/${widget.key}/drilldown`, { method: "GET", accessToken });
      setDrilldown(res);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function saveView() {
    if (!accessToken || !selectedKey || !viewName.trim()) {
      return;
    }
    try {
      await apiRequest(`/dashboards/${selectedKey}/views`, { method: "POST", accessToken, body: { name: viewName.trim(), config: { from, to } } });
      setViewName("");
      await loadDashboard(selectedKey);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function applyView(config: Record<string, unknown>) {
    setFrom(typeof config.from === "string" ? config.from : "");
    setTo(typeof config.to === "string" ? config.to : "");
  }

  async function exportDashboard() {
    if (!accessToken || !selectedKey) {
      return;
    }
    try {
      const res = await apiRequest<{ rows: unknown[] }>(`/dashboards/${selectedKey}/export`, { method: "GET", accessToken });
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedKey}-dashboard.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading dashboards" description="Role-based analytics dashboards are loading." />;
  }

  if (!catalog) {
    return <CrmEmptyState title="Dashboards could not be loaded." description={errorMessage ?? "The dashboard catalog could not be loaded."} action={<Button variant="outline" onClick={() => void loadCatalog()}>Retry</Button>} />;
  }

  const permitted = catalog.dashboards.filter((d) => d.permitted);

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Analytics"
        title="Role-based dashboards with real CRM metrics, filters, drill-down, and saved views."
        summary="Eighteen role-based dashboards compose configurable widgets — metrics, charts, funnels, and tables — from live CRM data. Visibility is permission-based, results respect date filters, and views can be saved and exported."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader><CardTitle>Dashboards</CardTitle><CardDescription>{permitted.length} relevant to your role.</CardDescription></CardHeader>
          <CardContent className="space-y-1">
            {permitted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dashboards are available for your role.</p>
            ) : (
              permitted.map((dashboard: DashboardSummary) => (
                <button key={dashboard.key} type="button" onClick={() => setSelectedKey(dashboard.key)} className={`w-full rounded-[0.85rem] border p-2.5 text-left text-sm ${selectedKey === dashboard.key ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{dashboard.key === defaultKey ? "★ " : ""}{dashboard.name}</span>
                    <Badge variant="muted">{dashboard.widgetCount}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{dashboard.category}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From</span><input type="date" className={inputClassName} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">To</span><input type="date" className={inputClassName} value={to} onChange={(e) => setTo(e.target.value)} /></label>
              <Button size="sm" onClick={() => selectedKey && void loadDashboard(selectedKey)}>Apply</Button>
              <Button size="sm" variant="outline" onClick={() => { setFrom(""); setTo(""); }}>Clear</Button>
              <Button size="sm" variant="outline" onClick={() => void exportDashboard()}>Export</Button>
              <Button
                size="sm"
                variant={selectedKey && selectedKey === defaultKey ? "default" : "outline"}
                disabled={!selectedKey}
                onClick={() => {
                  if (!selectedKey) return;
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(defaultDashboardStorageKey(user?.id), selectedKey);
                  }
                  setDefaultKey(selectedKey);
                }}
              >
                {selectedKey && selectedKey === defaultKey ? "★ Default" : "Set as default"}
              </Button>
              <div className="ml-auto flex items-end gap-2">
                <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Save view</span><input className={inputClassName} placeholder="View name" value={viewName} onChange={(e) => setViewName(e.target.value)} /></label>
                <Button size="sm" variant="outline" onClick={() => void saveView()}>Save</Button>
              </div>
            </CardContent>
          </Card>

          {views.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved views:</span>
              {views.map((view) => (<Button key={view.id} size="sm" variant="outline" onClick={() => applyView(view.config)}>{view.name}{view.isShared ? " (shared)" : ""}</Button>))}
            </div>
          ) : null}

          {data ? (
            <section className="grid gap-4 md:grid-cols-2">
              {data.widgets.map((widget) => (<Widget key={widget.key} widget={widget} dashboardKey={data.key} onDrilldown={openDrilldown} />))}
            </section>
          ) : (
            <CrmEmptyState title="Select a dashboard" description="Choose a dashboard from the list to view its widgets." />
          )}

          {drilldown ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between"><CardTitle>Drill-down: {drilldown.widgetKey}</CardTitle><Button size="sm" variant="outline" onClick={() => setDrilldown(null)}>Close</Button></div>
                <CardDescription>{drilldown.total} record(s).</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {drilldown.rows.length === 0 ? <p className="text-sm text-muted-foreground">No records.</p> : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted-foreground">{Object.keys(drilldown.rows[0]).filter((k) => k !== "id").map((k) => (<th key={k} className="py-1 pr-3">{k}</th>))}</tr></thead>
                    <tbody>
                      {drilldown.rows.slice(0, 50).map((row, ri) => (
                        <tr key={ri} className="border-t border-border/50">{Object.keys(drilldown.rows[0]).filter((k) => k !== "id").map((k) => (<td key={k} className="py-1 pr-3">{String((row as Record<string, unknown>)[k] ?? "—")}</td>))}</tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
