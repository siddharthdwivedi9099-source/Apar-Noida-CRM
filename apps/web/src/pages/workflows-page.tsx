import { useEffect, useMemo, useState } from "react";
import type {
  CreateWorkflowRequestBody,
  WorkflowActionType,
  WorkflowCatalogResponse,
  WorkflowCondition,
  WorkflowConditionOperator,
  WorkflowDetail,
  WorkflowListResponse,
  WorkflowResponse,
  WorkflowRunListResponse,
  WorkflowRunResponse,
  WorkflowSummary,
  WorkflowTriggerType
} from "@crm/types";
import { workflowConditionOperators } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { ListToolbar } from "@/components/crm/list-toolbar";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";
const textareaClassName = "flex min-h-[80px] w-full rounded-xl border border-border bg-white/80 px-3 py-2 font-mono text-xs";

const statusVariant = (status: string) => (status === "succeeded" ? "default" : status === "failed" ? "muted" : "muted");

export function WorkflowsPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [catalog, setCatalog] = useState<WorkflowCatalogResponse | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selected, setSelected] = useState<WorkflowDetail | null>(null);
  const [runs, setRuns] = useState<WorkflowRunListResponse["runs"]>([]);
  const [lastRun, setLastRun] = useState<WorkflowRunResponse["run"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-side search / filter / sort over the loaded workflow list.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "runs" | "updated">("updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const workflowStatuses = useMemo(() => Array.from(new Set(workflows.map((workflow) => workflow.status))), [workflows]);

  const visibleWorkflows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = workflows.filter((workflow) => {
      if (statusFilter && workflow.status !== statusFilter) return false;
      if (triggerFilter && workflow.triggerType !== triggerFilter) return false;
      if (term) {
        const haystack = `${workflow.name} ${workflow.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "runs") return (a.runCount - b.runCount) * direction;
      if (sortBy === "updated") return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [workflows, search, statusFilter, triggerFilter, sortBy, sortOrder]);

  const [form, setForm] = useState({ name: "", triggerType: "record_created", conditionField: "", conditionOperator: "exists", conditionValue: "" });
  const [actionForm, setActionForm] = useState({ actionType: "create_task", config: "{}" });
  const [runContext, setRunContext] = useState("{}");

  const canCreate = hasAnyPermission(["workflows.create", "workflows.configure", "workflows.manage_workflow"]);
  const canEdit = hasAnyPermission(["workflows.edit", "workflows.configure", "workflows.manage_workflow"]);
  const canRun = hasAnyPermission(["workflows.manage_workflow", "workflows.configure", "workflows.edit"]);

  async function loadAll() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [catalogRes, listRes] = await Promise.all([
        apiRequest<WorkflowCatalogResponse>("/workflows/catalog", { method: "GET", accessToken }),
        apiRequest<WorkflowListResponse>("/workflows?pageSize=100", { method: "GET", accessToken })
      ]);
      setCatalog(catalogRes);
      setWorkflows(listRes.workflows);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function openWorkflow(id: string) {
    if (!accessToken) {
      return;
    }
    try {
      const [detail, runsRes] = await Promise.all([
        apiRequest<WorkflowResponse>(`/workflows/${id}`, { method: "GET", accessToken }),
        apiRequest<WorkflowRunListResponse>(`/workflows/${id}/runs`, { method: "GET", accessToken }).catch(() => ({ runs: [] }))
      ]);
      setSelected(detail.workflow);
      setRuns(runsRes.runs);
      setLastRun(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadAll();
  }, [accessToken]);

  async function createWorkflow(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setErrorMessage(null);
    try {
      const conditions: WorkflowCondition[] = form.conditionField.trim()
        ? [{ field: form.conditionField.trim(), operator: form.conditionOperator as WorkflowConditionOperator, value: form.conditionValue }]
        : [];
      const body: CreateWorkflowRequestBody = { name: form.name, triggerType: form.triggerType as WorkflowTriggerType, conditions };
      const res = await apiRequest<WorkflowResponse>("/workflows", { method: "POST", accessToken, body });
      setForm({ name: "", triggerType: "record_created", conditionField: "", conditionOperator: "exists", conditionValue: "" });
      await loadAll();
      setSelected(res.workflow);
      setRuns([]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function patchWorkflow(body: Record<string, unknown>) {
    if (!accessToken || !selected) {
      return;
    }
    try {
      const res = await apiRequest<WorkflowResponse>(`/workflows/${selected.id}`, { method: "PATCH", accessToken, body });
      setSelected(res.workflow);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function addAction(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !selected) {
      return;
    }
    setErrorMessage(null);
    try {
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(actionForm.config || "{}");
      } catch {
        setErrorMessage("Action config must be valid JSON.");
        return;
      }
      await apiRequest(`/workflows/${selected.id}/actions`, { method: "POST", accessToken, body: { actionType: actionForm.actionType as WorkflowActionType, actionConfig: config } });
      setActionForm({ actionType: "create_task", config: "{}" });
      await openWorkflow(selected.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function runWorkflow() {
    if (!accessToken || !selected) {
      return;
    }
    setErrorMessage(null);
    try {
      let context: Record<string, unknown> = {};
      try {
        context = JSON.parse(runContext || "{}");
      } catch {
        setErrorMessage("Run context must be valid JSON.");
        return;
      }
      const res = await apiRequest<WorkflowRunResponse>(`/workflows/${selected.id}/run`, { method: "POST", accessToken, body: { context } });
      setLastRun(res.run);
      await openWorkflow(selected.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading workflows" description="The workflow automation engine is loading triggers, actions, and workflows." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Automation"
        title="Configurable workflow automation with triggers, conditions, actions, and run logs."
        summary="Build workflows from triggers and governed actions. Actions respect permissions, AI actions run through the AI Gateway, and every run is logged — including failures — for full traceability."
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {canCreate && catalog ? (
            <Card>
              <CardHeader><CardTitle>New workflow</CardTitle><CardDescription>Pick a trigger and an optional condition.</CardDescription></CardHeader>
              <CardContent>
                <form className="space-y-2" onSubmit={createWorkflow}>
                  <input className={inputClassName} placeholder="Workflow name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
                  <select className={selectClassName} value={form.triggerType} onChange={(e) => setForm((c) => ({ ...c, triggerType: e.target.value }))}>
                    {catalog.triggers.map((trigger) => (<option key={trigger.type} value={trigger.type}>{trigger.label}</option>))}
                  </select>
                  <div className="flex gap-2">
                    <input className={inputClassName} placeholder="Condition field" value={form.conditionField} onChange={(e) => setForm((c) => ({ ...c, conditionField: e.target.value }))} />
                    <select className={selectClassName} value={form.conditionOperator} onChange={(e) => setForm((c) => ({ ...c, conditionOperator: e.target.value }))}>
                      {workflowConditionOperators.map((op) => (<option key={op} value={op}>{op}</option>))}
                    </select>
                  </div>
                  <input className={inputClassName} placeholder="Condition value (optional)" value={form.conditionValue} onChange={(e) => setForm((c) => ({ ...c, conditionValue: e.target.value }))} />
                  <Button type="submit" size="sm">Create workflow</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Workflows</CardTitle><CardDescription>{workflows.length} configured.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <ListToolbar
                search={search}
                onSearch={setSearch}
                searchPlaceholder="Search name or description..."
                filters={[
                  { label: "statuses", value: statusFilter, onChange: setStatusFilter, options: workflowStatuses.map((s) => ({ value: s, label: s })) },
                  { label: "triggers", value: triggerFilter, onChange: setTriggerFilter, options: (catalog?.triggers ?? []).map((t) => ({ value: t.type, label: t.label })) }
                ]}
                sortBy={sortBy}
                onSortBy={(value) => setSortBy(value as typeof sortBy)}
                sortOptions={[
                  { value: "updated", label: "Recently updated" },
                  { value: "name", label: "Name" },
                  { value: "runs", label: "Run count" }
                ]}
                sortOrder={sortOrder}
                onSortOrder={setSortOrder}
                resultCount={visibleWorkflows.length}
                totalCount={workflows.length}
                noun="workflows"
                onReset={() => {
                  setSearch("");
                  setStatusFilter("");
                  setTriggerFilter("");
                  setSortBy("updated");
                  setSortOrder("desc");
                }}
              />
              {visibleWorkflows.length === 0 ? <p className="text-sm text-muted-foreground">{workflows.length === 0 ? "No workflows yet." : "No workflows match the current filters."}</p> : (
                <ul className="space-y-2">
                  {visibleWorkflows.map((workflow) => (
                    <li key={workflow.id}>
                      <button type="button" onClick={() => void openWorkflow(workflow.id)} className={`w-full rounded-[1rem] border p-3 text-left ${selected?.id === workflow.id ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"}`}>
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{workflow.name}</span><Badge variant={workflow.status === "active" ? "default" : "muted"}>{workflow.status}</Badge></div>
                        <p className="mt-1 text-xs text-muted-foreground">{workflow.triggerType} • {workflow.actionCount} actions • {workflow.runCount} runs</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {selected ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{selected.name}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selected.status === "active" ? "default" : "muted"}>{selected.status}</Badge>
                    {canEdit && selected.status !== "active" ? <Button size="sm" variant="outline" onClick={() => void patchWorkflow({ status: "active", isEnabled: true })}>Activate</Button> : null}
                    {canEdit && selected.status === "active" ? <Button size="sm" variant="outline" onClick={() => void patchWorkflow({ status: "inactive", isEnabled: false })}>Deactivate</Button> : null}
                  </div>
                </div>
                <CardDescription>Trigger: {selected.triggerType} • {selected.conditions.length} condition(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selected.conditions.length > 0 ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conditions</p>
                    <ul className="mt-1 space-y-1">{selected.conditions.map((c, i) => (<li key={i} className="text-xs">{c.field} <strong>{c.operator}</strong> {String(c.value ?? "")}</li>))}</ul>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Actions</p>
                  {selected.actions.length === 0 ? <p className="text-xs text-muted-foreground">No actions yet.</p> : (
                    <ol className="mt-1 space-y-1">
                      {selected.actions.map((action) => (
                        <li key={action.id} className="rounded-[0.75rem] border border-border/60 bg-background/75 px-3 py-2 text-xs">
                          <span className="font-medium">{action.sequence}. {action.actionType}</span>{action.requiresPermission ? <Badge className="ml-2" variant="muted">{action.requiresPermission}</Badge> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {canEdit && catalog ? (
                  <form className="flex flex-wrap items-end gap-2" onSubmit={addAction}>
                    <select className={selectClassName} value={actionForm.actionType} onChange={(e) => setActionForm((c) => ({ ...c, actionType: e.target.value }))}>
                      {catalog.actions.map((action) => (<option key={action.type} value={action.type}>{action.label}{action.isAi ? " (AI)" : ""}</option>))}
                    </select>
                    <input className={inputClassName} style={{ maxWidth: "240px" }} value={actionForm.config} onChange={(e) => setActionForm((c) => ({ ...c, config: e.target.value }))} placeholder='{"templateKey":"generic_assistant"}' />
                    <Button type="submit" size="sm" variant="outline">Add action</Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>

            {canRun ? (
              <Card>
                <CardHeader><CardTitle>Run workflow</CardTitle><CardDescription>Provide a trigger context (JSON) and execute.</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  <textarea className={textareaClassName} value={runContext} onChange={(e) => setRunContext(e.target.value)} />
                  <Button size="sm" onClick={() => void runWorkflow()} disabled={selected.status !== "active"}>Run now</Button>
                  {selected.status !== "active" ? <p className="text-xs text-muted-foreground">Activate the workflow to run it.</p> : null}
                </CardContent>
              </Card>
            ) : null}

            {lastRun ? (
              <Card>
                <CardHeader><CardTitle>Run result</CardTitle><CardDescription>{lastRun.actionsSucceeded} succeeded • {lastRun.actionsFailed} failed</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Badge variant={statusVariant(lastRun.status)}>{lastRun.status}</Badge>
                  <ul className="space-y-1">
                    {lastRun.logs.map((logEntry) => (
                      <li key={logEntry.id} className="rounded-[0.75rem] border border-border/60 bg-background/75 px-3 py-2 text-xs">
                        <Badge variant={statusVariant(logEntry.status)}>{logEntry.status}</Badge> <span className="ml-1">{logEntry.actionType ?? "conditions"}</span> — {logEntry.message}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader><CardTitle>Run logs</CardTitle><CardDescription>Recent executions.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {runs.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet.</p> : (
                  <ul className="space-y-1">
                    {runs.slice(0, 15).map((run) => (
                      <li key={run.id} className="flex flex-wrap items-center gap-2 rounded-[0.75rem] border border-border/60 bg-background/75 px-3 py-2 text-xs">
                        <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                        <span>{run.actionsSucceeded}✓ / {run.actionsFailed}✗</span>
                        <span className="text-muted-foreground">{formatDateTime(run.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <CrmEmptyState title="Select a workflow" description="Choose a workflow to configure its conditions and actions, run it, and review run logs." />
        )}
      </section>
    </div>
  );
}
