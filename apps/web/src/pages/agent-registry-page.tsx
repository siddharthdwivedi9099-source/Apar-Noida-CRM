import { useEffect, useState } from "react";
import type { AiAgent, AiAgentListResponse, AiAgentResponse } from "@crm/types";
import { aiAgentDataScopes, aiAgentStatuses } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function AgentRegistryPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [selected, setSelected] = useState<AiAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canConfigure = hasAnyPermission(["ai.edit", "ai.configure", "ai.manage_ai"]);

  async function loadAgents() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiRequest<AiAgentListResponse>("/ai/agents", { method: "GET", accessToken });
      setAgents(response.agents);
      setSelected((current) => (current ? response.agents.find((agent) => agent.id === current.id) ?? null : null));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAgents();
  }, [accessToken]);

  async function patchSelected(body: Partial<Record<string, unknown>>) {
    if (!accessToken || !selected) {
      return;
    }
    setErrorMessage(null);
    try {
      const response = await apiRequest<AiAgentResponse>(`/ai/agents/${selected.id}`, { method: "PATCH", accessToken, body });
      setSelected(response.agent);
      await loadAgents();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading agent registry" description="Governed AI agents, their tools, roles, and escalation rules are loading for this tenant." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="AI governance"
        title="The Agent Registry defines every governed AI agent with allowed tools, roles, data scope, approval, and escalation rules."
        summary="Sixteen baseline agents are provisioned per tenant. Each agent declares its purpose, the tools and roles it may use, its data-access scope, whether human approval is required, and its escalation rules. Agents are configured here, never run autonomously without governance."
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Agents" value={String(agents.length)} description="Registered agents for this tenant." />
            <CrmMetricCard label="Active" value={String(agents.filter((a) => a.status === "active").length)} description="Agents currently active." />
            <CrmMetricCard label="Approval-gated" value={String(agents.filter((a) => a.requiresHumanApproval).length)} description="Agents requiring human approval." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void loadAgents()}>Refresh</Button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle>Agents</CardTitle><CardDescription>Select an agent to view its configuration.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <button type="button" onClick={() => setSelected(agent)} className={`w-full rounded-[1rem] border p-3 text-left ${selected?.id === agent.id ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{agent.name}</span>
                      <Badge variant={agent.status === "active" ? "default" : "muted"}>{agent.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{agent.module} • scope {agent.dataAccessScope}</p>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
              <CardDescription>{selected.purpose}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selected.status === "active" ? "default" : "muted"}>{selected.status}</Badge>
                <Badge variant="muted">{selected.module}</Badge>
                <Badge variant="muted">scope: {selected.dataAccessScope}</Badge>
                {selected.requiresHumanApproval ? <Badge variant="muted">Human approval</Badge> : null}
                {selected.loggingEnabled ? <Badge variant="muted">Logging on</Badge> : <Badge variant="muted">Logging off</Badge>}
                {selected.isSystem ? <Badge variant="muted">System</Badge> : <Badge variant="muted">Custom</Badge>}
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agent key</dt><dd className="font-medium">{selected.agentKey}</dd></div>
                <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated</dt><dd className="font-medium">{formatDateTime(selected.updatedAt)}</dd></div>
              </dl>

              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Allowed tools</p>
                <div className="mt-1 flex flex-wrap gap-2">{selected.allowedTools.map((tool) => (<Badge key={tool} variant="muted">{tool}</Badge>))}</div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Allowed roles</p>
                <div className="mt-1 flex flex-wrap gap-2">{selected.allowedRoles.map((role) => (<Badge key={role} variant="muted">{role}</Badge>))}</div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Escalation rules</p>
                <ul className="mt-1 space-y-1">
                  {selected.escalationRules.length === 0 ? <li className="text-muted-foreground">None configured.</li> : selected.escalationRules.map((rule, index) => (
                    <li key={index} className="rounded-[0.75rem] border border-border/60 bg-background/75 px-3 py-2 text-xs">
                      On <strong>{rule.trigger}</strong> → {rule.action} → escalate to <strong>{rule.escalateTo}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              {canConfigure ? (
                <div className="flex flex-wrap items-end gap-3 border-t border-border/50 pt-4">
                  <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</span>
                    <select className={selectClassName} value={selected.status} onChange={(e) => void patchSelected({ status: e.target.value })}>
                      {aiAgentStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}
                    </select>
                  </label>
                  <label className="space-y-1"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Data scope</span>
                    <select className={selectClassName} value={selected.dataAccessScope} onChange={(e) => void patchSelected({ dataAccessScope: e.target.value })}>
                      {aiAgentDataScopes.map((scope) => (<option key={scope} value={scope}>{scope}</option>))}
                    </select>
                  </label>
                  <Button variant="outline" size="sm" onClick={() => void patchSelected({ requiresHumanApproval: !selected.requiresHumanApproval })}>{selected.requiresHumanApproval ? "Disable approval" : "Require approval"}</Button>
                  <Button variant="outline" size="sm" onClick={() => void patchSelected({ loggingEnabled: !selected.loggingEnabled })}>{selected.loggingEnabled ? "Disable logging" : "Enable logging"}</Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Your role cannot configure agents.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <CrmEmptyState title="Select an agent" description="Choose an agent from the list to view its tools, roles, data scope, and escalation rules." />
        )}
      </section>
    </div>
  );
}
