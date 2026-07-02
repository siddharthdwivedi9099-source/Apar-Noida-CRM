import { useEffect, useState, type FormEvent } from "react";
import type {
  SupportEscalationOversightResponse,
  SupportTeamPerformanceResponse,
  SupportTicketOptionsResponse,
  SupportWorkloadResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SupportManagementPanelProps {
  accessToken: string | null;
  options: SupportTicketOptionsResponse;
  canManage: boolean;
  selectedId: string | null;
  onReload?: () => void;
}

function minutesLabel(value: number | null): string {
  if (value === null) {
    return "—";
  }
  if (value >= 120) {
    return `${Math.round((value / 60) * 10) / 10}h`;
  }
  return `${value}m`;
}

export function SupportManagementPanel({ accessToken, options, canManage, selectedId, onReload }: SupportManagementPanelProps) {
  const [performance, setPerformance] = useState<SupportTeamPerformanceResponse | null>(null);
  const [workload, setWorkload] = useState<SupportWorkloadResponse | null>(null);
  const [escalations, setEscalations] = useState<SupportEscalationOversightResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [reassignAgent, setReassignAgent] = useState("");
  const [breach, setBreach] = useState({ reasonKey: "", correctiveAction: "" });
  const [escalationOwner, setEscalationOwner] = useState("");
  const [csat, setCsat] = useState({ score: "5", comment: "" });

  // Prefer the team roll-up, but fall back to the widest scope the manager can actually
  // read (a manager with no team only has "mine"/"all"), so the panel never 403s.
  const scopes = options.availableScopes ?? [];
  const scope = scopes.includes("team") ? "team" : scopes.includes("all") ? "all" : "mine";

  async function load() {
    if (!accessToken || !canManage) {
      return;
    }
    try {
      const [perf, work, esc] = await Promise.all([
        apiRequest<SupportTeamPerformanceResponse>(`/support/management/performance?scope=${scope}`, { method: "GET", accessToken }),
        apiRequest<SupportWorkloadResponse>(`/support/management/workload?scope=${scope}`, { method: "GET", accessToken }),
        apiRequest<SupportEscalationOversightResponse>(`/support/management/escalations?scope=${scope}`, { method: "GET", accessToken })
      ]);
      setPerformance(perf);
      setWorkload(work);
      setEscalations(esc);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, canManage, selectedId]);

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
      onReload?.();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  if (!canManage) {
    return null;
  }

  const ticketPost = (path: string, body: Record<string, unknown>) =>
    apiRequest(`/support/tickets/${selectedId}${path}`, { method: "POST", accessToken, body });

  function handleBreach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    void run("breach", () => ticketPost("/breach-review", { reasonKey: breach.reasonKey, correctiveAction: breach.correctiveAction || null }), "Breach review recorded.");
  }
  function handleCsat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    void run("csat", () => ticketPost("/csat", { score: Number(csat.score), comment: csat.comment || null }), "CSAT response captured.");
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* SPM-001 */}
      {performance ? (
        <Card>
          <CardHeader>
            <CardTitle>Team performance</CardTitle>
            <CardDescription>Agent workload, SLA compliance, and CSAT for your team. AI performance insights stay a governed placeholder.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CrmMetricCard label="Assigned" value={String(performance.team.assigned)} description="Tickets assigned in scope." />
              <CrmMetricCard label="SLA compliance" value={`${performance.team.slaCompliancePct}%`} description={`${performance.team.slaBreaches} breach(es).`} />
              <CrmMetricCard label="Avg resolution" value={minutesLabel(performance.team.avgResolutionMinutes)} description="Mean time to resolve." />
              <CrmMetricCard label="CSAT" value={performance.csat.averageScore === null ? "—" : `${performance.csat.averageScore}/5`} description={`${performance.csat.responseCount} response(s).`} />
            </div>
            {performance.agents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3">Agent</th>
                      <th className="py-1 pr-3">Open</th>
                      <th className="py-1 pr-3">Resolved</th>
                      <th className="py-1 pr-3">SLA %</th>
                      <th className="py-1 pr-3">Avg resolve</th>
                      <th className="py-1 pr-3">Reopened</th>
                      <th className="py-1 pr-3">CSAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.agents.map((agent) => (
                      <tr key={agent.agent?.id ?? "unknown"} className="border-t border-border/50">
                        <td className="py-1 pr-3">{agent.agent?.displayName ?? "Unassigned"}</td>
                        <td className="py-1 pr-3">{agent.open}</td>
                        <td className="py-1 pr-3">{agent.resolved}</td>
                        <td className="py-1 pr-3">{agent.slaCompliancePct}%</td>
                        <td className="py-1 pr-3">{minutesLabel(agent.avgResolutionMinutes)}</td>
                        <td className="py-1 pr-3">{agent.reopened}</td>
                        <td className="py-1 pr-3">{agent.csatAverage === null ? "—" : `${agent.csatAverage}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No assigned tickets in scope yet.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* SPM-002 */}
      {workload ? (
        <Card>
          <CardHeader>
            <CardTitle>Workload balancing</CardTitle>
            <CardDescription>Open load per agent against capacity {workload.capacity}. {workload.unassignedOpen} unassigned open ticket(s).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workload.agents.length > 0 ? (
              <ul className="space-y-2">
                {workload.agents.map((agent) => (
                  <li key={agent.agent?.id ?? "unknown"} className="flex flex-wrap items-center gap-2 rounded-[1rem] border border-border/60 bg-background/75 p-2 text-sm">
                    <span className="font-medium">{agent.agent?.displayName ?? "Unassigned"}</span>
                    <Badge variant="muted">{agent.openCount} open</Badge>
                    <span className="text-xs text-muted-foreground">{agent.utilizationPct}% of capacity</span>
                    {agent.breachedCount > 0 ? <Badge variant="muted">{agent.breachedCount} breached</Badge> : null}
                    {agent.atRiskCount > 0 ? <Badge variant="muted">{agent.atRiskCount} at risk</Badge> : null}
                    {agent.overloaded ? <Badge variant="muted" className="border-rose-200 bg-rose-100 text-rose-700">Overloaded</Badge> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No open workload in scope.</p>
            )}
            {selectedId ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
                <select className={selectClassName} value={reassignAgent} onChange={(e) => setReassignAgent(e.target.value)} disabled={busy !== null} aria-label="Reassign selected ticket to">
                  <option value="">Reassign selected ticket to…</option>
                  {(options.owners ?? []).map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                </select>
                <Button type="button" variant="outline" disabled={busy !== null || !reassignAgent} onClick={() => void run("reassign", () => apiRequest("/support/management/reassign", { method: "POST", accessToken, body: { ticketIds: [selectedId], assigneeId: reassignAgent } }), "Ticket reassigned.")}>Reassign</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* SPM-004 */}
      {escalations ? (
        <Card>
          <CardHeader>
            <CardTitle>Escalation oversight</CardTitle>
            <CardDescription>{escalations.count} escalated ticket(s), oldest first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {escalations.entries.length > 0 ? (
              <ul className="space-y-2">
                {escalations.entries.slice(0, 8).map((entry) => (
                  <li key={entry.ticketId} className="rounded-[1rem] border border-border/60 bg-background/75 p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{entry.subject}</span>
                      {entry.priority ? <Badge variant="muted">{entry.priority.label}</Badge> : null}
                      {entry.ageHours !== null ? <span className="text-xs text-muted-foreground">{entry.ageHours}h old</span> : null}
                    </div>
                    {entry.reason ? <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No escalated tickets in scope.</p>
            )}
            {selectedId ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
                <select className={selectClassName} value={escalationOwner} onChange={(e) => setEscalationOwner(e.target.value)} disabled={busy !== null} aria-label="Reassign escalation owner">
                  <option value="">Reassign escalation owner…</option>
                  {(options.owners ?? []).map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                </select>
                <Button type="button" variant="outline" disabled={busy !== null || !escalationOwner} onClick={() => void run("esc-reassign", () => ticketPost("/escalation-review", { decision: "reassign", ownerId: escalationOwner }), "Escalation reassigned.")}>Reassign owner</Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("esc-return", () => ticketPost("/escalation-review", { decision: "return_to_l1", note: null }), "Escalation returned to L1.")}>Return to L1</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* SPM-003 + SPM-005 (per-ticket) */}
      {selectedId ? (
        <Card>
          <CardHeader>
            <CardTitle>Breach review &amp; CSAT</CardTitle>
            <CardDescription>Record why an SLA breach happened and capture the customer's CSAT response for the selected ticket.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <form className="space-y-2" onSubmit={handleBreach}>
              <p className="text-sm font-medium">SLA breach review</p>
              <select className={selectClassName} value={breach.reasonKey} onChange={(e) => setBreach((c) => ({ ...c, reasonKey: e.target.value }))} disabled={busy !== null}>
                <option value="">Breach reason…</option>
                {(options.breachReasons ?? []).map((reason) => <option key={reason.id} value={reason.key}>{reason.label}</option>)}
              </select>
              <textarea className={textareaClassName} rows={2} placeholder="Corrective action" value={breach.correctiveAction} onChange={(e) => setBreach((c) => ({ ...c, correctiveAction: e.target.value }))} disabled={busy !== null} />
              <Button type="submit" disabled={busy !== null || !breach.reasonKey}>Record breach review</Button>
            </form>
            <form className="space-y-2" onSubmit={handleCsat}>
              <p className="text-sm font-medium">CSAT response</p>
              <select className={selectClassName} value={csat.score} onChange={(e) => setCsat((c) => ({ ...c, score: e.target.value }))} disabled={busy !== null} aria-label="CSAT score">
                {[1, 2, 3, 4, 5].map((score) => <option key={score} value={String(score)}>{score} / 5</option>)}
              </select>
              <Input placeholder="Customer comment (optional)" value={csat.comment} onChange={(e) => setCsat((c) => ({ ...c, comment: e.target.value }))} disabled={busy !== null} />
              <Button type="submit" disabled={busy !== null}>Save CSAT</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
