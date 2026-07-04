import { useEffect, useState } from "react";
import type {
  BackupStatusResponse,
  EnvironmentDeploymentsResponse,
  EnvironmentsResponse,
  IntegrationMonitoringResponse,
  IntegrationRunsResponse
} from "@crm/types";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const healthClass: Record<string, string> = {
  healthy: "border-emerald-200 bg-emerald-100 text-emerald-700",
  degraded: "border-amber-200 bg-amber-100 text-amber-700",
  down: "border-rose-200 bg-rose-100 text-rose-700"
};

export function AdminSystemPage() {
  const { accessToken } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationMonitoringResponse | null>(null);
  const [environments, setEnvironments] = useState<EnvironmentsResponse | null>(null);
  const [backups, setBackups] = useState<BackupStatusResponse | null>(null);
  const [runsByConn, setRunsByConn] = useState<Record<string, IntegrationRunsResponse["runs"]>>({});
  const [deploysByEnv, setDeploysByEnv] = useState<Record<string, EnvironmentDeploymentsResponse["deployments"]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [conn, setConn] = useState({ name: "", provider: "" });
  const [envForm, setEnvForm] = useState({ label: "", kind: "dev" });
  const [policy, setPolicy] = useState({ scheduleCron: "0 2 * * *", rpoMinutes: "1440", rtoMinutes: "240" });

  async function loadAll() {
    if (!accessToken) return;
    try {
      const [ints, envs, bks] = await Promise.all([
        apiRequest<IntegrationMonitoringResponse>("/system/integrations", { accessToken }),
        apiRequest<EnvironmentsResponse>("/system/environments", { accessToken }),
        apiRequest<BackupStatusResponse>("/system/backups", { accessToken })
      ]);
      setIntegrations(ints);
      setEnvironments(envs);
      setBackups(bks);
      if (bks.policy) setPolicy({ scheduleCron: bks.policy.scheduleCron, rpoMinutes: String(bks.policy.rpoMinutes), rtoMinutes: String(bks.policy.rtoMinutes) });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadRuns(connectionId: string) {
    if (!accessToken) return;
    const result = await apiRequest<IntegrationRunsResponse>(`/system/integrations/${connectionId}/runs`, { accessToken });
    setRunsByConn((c) => ({ ...c, [connectionId]: result.runs }));
  }
  async function loadDeploys(environmentId: string) {
    if (!accessToken) return;
    const result = await apiRequest<EnvironmentDeploymentsResponse>(`/system/environments/${environmentId}/deployments`, { accessToken });
    setDeploysByEnv((c) => ({ ...c, [environmentId]: result.deployments }));
  }

  return (
    <div className="space-y-6">
      <AdminNav />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* SYS-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Integration monitoring</CardTitle>
          <CardDescription>API status, failures, retries, latency, last sync, and errors. Failed runs raise alerts (SYS-001).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Connection name" className="w-52" value={conn.name} onChange={(e) => setConn((c) => ({ ...c, name: e.target.value }))} disabled={busy !== null} />
            <Input placeholder="Provider" className="w-40" value={conn.provider} onChange={(e) => setConn((c) => ({ ...c, provider: e.target.value }))} disabled={busy !== null} />
            <Button type="button" variant="outline" disabled={busy !== null || !conn.name || !conn.provider} onClick={() => void run("conn", async () => { await apiRequest("/system/integrations", { method: "POST", accessToken, body: conn }); setConn({ name: "", provider: "" }); }, "Connection added.")}>Add connection</Button>
          </div>
          {integrations?.connections.length ? integrations.connections.map((c) => (
            <div key={c.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.provider}</span>
                <Badge variant="muted" className={healthClass[c.health.health]}>{c.health.health}</Badge>
                <span className="text-xs text-muted-foreground">{c.health.successRate}% ok · {c.health.avgLatencyMs ?? "—"}ms · {c.health.unresolvedFailures} open failure(s) · last {c.health.lastSyncAtMs ? formatDateTime(new Date(c.health.lastSyncAtMs).toISOString()) : "—"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`ok-${c.id}`, () => apiRequest(`/system/integrations/${c.id}/runs`, { method: "POST", accessToken, body: { status: "success", latencyMs: 120, recordsProcessed: 50 } }), "Sync recorded.")}>Record success</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`fail-${c.id}`, () => apiRequest(`/system/integrations/${c.id}/runs`, { method: "POST", accessToken, body: { status: "failed", errorMessage: "Sync failed (timeout)" } }), "Failure recorded + alert raised.")}>Record failure</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void loadRuns(c.id)}>View logs</Button>
              </div>
              {runsByConn[c.id]?.length ? (
                <ul className="mt-2 space-y-1">
                  {runsByConn[c.id].slice(0, 6).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="muted" className={r.status === "failed" ? "border-rose-200 bg-rose-100 text-rose-700" : ""}>{r.status}</Badge>
                      {r.isRetry ? <Badge variant="muted">retry</Badge> : null}
                      <span>{formatDateTime(r.startedAt)} · {r.latencyMs ?? "—"}ms{r.errorMessage ? ` · ${r.errorMessage}` : ""}</span>
                      {r.status === "failed" && !r.resolved ? (
                        <>
                          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`retry-${r.id}`, async () => { await apiRequest(`/system/integrations/${c.id}/runs/${r.id}/retry`, { method: "POST", accessToken, body: {} }); await loadRuns(c.id); }, "Retried.")}>Retry</Button>
                          <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`res-${r.id}`, async () => { await apiRequest(`/system/integrations/${c.id}/runs/${r.id}/resolve`, { method: "POST", accessToken, body: {} }); await loadRuns(c.id); }, "Marked resolved.")}>Resolve</Button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )) : <p className="text-muted-foreground">No integration connections yet.</p>}
        </CardContent>
      </Card>

      {/* SYS-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Environment management</CardTitle>
          <CardDescription>Labeled dev/test/staging/production; production deployments require approval; rollback plans are documented (SYS-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Environment label" className="w-52" value={envForm.label} onChange={(e) => setEnvForm((c) => ({ ...c, label: e.target.value }))} disabled={busy !== null} />
            <select className={selectClassName} value={envForm.kind} onChange={(e) => setEnvForm((c) => ({ ...c, kind: e.target.value }))} disabled={busy !== null} aria-label="Environment kind">
              <option value="dev">dev</option><option value="test">test</option><option value="staging">staging</option><option value="production">production</option>
            </select>
            <Button type="button" variant="outline" disabled={busy !== null || !envForm.label} onClick={() => void run("env", async () => { await apiRequest("/system/environments", { method: "POST", accessToken, body: envForm }); setEnvForm({ label: "", kind: "dev" }); }, "Environment created.")}>Add environment</Button>
          </div>
          {environments?.environments.length ? environments.environments.map((env) => (
            <div key={env.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{env.label}</span>
                <Badge variant="muted">{env.kind}</Badge>
                {env.requiresApproval ? <Badge variant="muted" className="border-amber-200 bg-amber-100 text-amber-700">approval required</Badge> : null}
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`deploy-${env.id}`, async () => { await apiRequest(`/system/environments/${env.id}/deployments`, { method: "POST", accessToken, body: { rollbackPlan: "Restore previous published configuration version." } }); await loadDeploys(env.id); }, "Deployment created.")}>New deployment</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void loadDeploys(env.id)}>View deployments</Button>
              </div>
              {deploysByEnv[env.id]?.length ? (
                <ul className="mt-2 space-y-1">
                  {deploysByEnv[env.id].slice(0, 5).map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="muted">{d.status}</Badge>
                      <span>{formatDateTime(d.createdAt)}{d.rollbackPlan ? " · rollback documented" : ""}</span>
                      {["approve", "reject", "deploy", "rollback"].map((decision) => (
                        <Button key={decision} type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`d-${d.id}-${decision}`, async () => { await apiRequest(`/system/environments/${env.id}/deployments/${d.id}/decision`, { method: "POST", accessToken, body: { decision } }); await loadDeploys(env.id); }, `Deployment ${decision}.`)}>{decision}</Button>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )) : <p className="text-muted-foreground">No environments yet.</p>}
        </CardContent>
      </Card>

      {/* SYS-004 */}
      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; recovery</CardTitle>
          <CardDescription>Configurable schedule, RPO/RTO visibility, restore testing, and backup-failure alerts (SYS-004).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {backups ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className={backups.status.rpoBreached ? "border-rose-200 bg-rose-100 text-rose-700" : "border-emerald-200 bg-emerald-100 text-emerald-700"}>{backups.status.rpoBreached ? "RPO breached" : "Within RPO"}</Badge>
              <span className="text-xs text-muted-foreground">RPO {backups.status.rpoMinutes}m · RTO {backups.status.rtoMinutes}m · last backup {backups.status.lastBackupAtMs ? formatDateTime(new Date(backups.status.lastBackupAtMs).toISOString()) : "—"} · {backups.status.failureCount} failure(s)</span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Cron" className="w-32" value={policy.scheduleCron} onChange={(e) => setPolicy((c) => ({ ...c, scheduleCron: e.target.value }))} disabled={busy !== null} />
            <Input type="number" placeholder="RPO min" className="w-24" value={policy.rpoMinutes} onChange={(e) => setPolicy((c) => ({ ...c, rpoMinutes: e.target.value }))} disabled={busy !== null} />
            <Input type="number" placeholder="RTO min" className="w-24" value={policy.rtoMinutes} onChange={(e) => setPolicy((c) => ({ ...c, rtoMinutes: e.target.value }))} disabled={busy !== null} />
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("policy", () => apiRequest("/system/backups/policy", { method: "PUT", accessToken, body: { scheduleCron: policy.scheduleCron, rpoMinutes: Number(policy.rpoMinutes), rtoMinutes: Number(policy.rtoMinutes) } }), "Backup policy saved.")}>Save policy</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("bk-ok", () => apiRequest("/system/backups/runs", { method: "POST", accessToken, body: { runType: "backup", status: "success", sizeBytes: 1048576 } }), "Backup recorded.")}>Record backup success</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("bk-rt", () => apiRequest("/system/backups/runs", { method: "POST", accessToken, body: { runType: "restore_test", status: "success" } }), "Restore test logged.")}>Log restore test</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("bk-fail", () => apiRequest("/system/backups/runs", { method: "POST", accessToken, body: { runType: "backup", status: "failed", errorMessage: "Snapshot failed" } }), "Failure recorded + alert raised.")}>Record backup failure</Button>
          </div>
          {backups?.runs.length ? (
            <ul className="space-y-1">
              {backups.runs.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="muted" className={r.status === "failed" ? "border-rose-200 bg-rose-100 text-rose-700" : ""}>{r.runType} · {r.status}</Badge>
                  <span>{formatDateTime(r.startedAt)}{r.errorMessage ? ` · ${r.errorMessage}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
