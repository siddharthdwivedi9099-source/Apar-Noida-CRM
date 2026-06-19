import { useEffect, useMemo, useState } from "react";
import type {
  AiActionCatalogResponse,
  AiActionExecuteResponse,
  AiActionRun,
  AiActionRunListResponse,
  AiActionSummary
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

const inputClassName = "flex h-10 w-full rounded-xl border border-border bg-white/80 px-3 text-sm";

export function AiActionsPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [catalog, setCatalog] = useState<AiActionCatalogResponse | null>(null);
  const [runs, setRuns] = useState<AiActionRun[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AiActionSummary | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<AiActionRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canReview = hasAnyPermission(["ai.approve", "ai.manage_ai", "ai.configure"]);
  const canObserve = hasAnyPermission(["ai.view", "ai.view_dashboard", "ai.manage_ai", "ai.configure", "ai.approve"]);

  async function loadCatalog() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const catalogRes = await apiRequest<AiActionCatalogResponse>("/ai/actions", { method: "GET", accessToken });
      setCatalog(catalogRes);
      if (canObserve) {
        const runsRes = await apiRequest<AiActionRunListResponse>("/ai/actions/runs?pageSize=50", { method: "GET", accessToken }).catch(() => null);
        setRuns(runsRes?.runs ?? []);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, [accessToken]);

  const modules = catalog?.modules ?? [];
  const visibleActions = useMemo(() => (catalog?.actions ?? []).filter((action) => moduleFilter === "all" || action.module === moduleFilter), [catalog, moduleFilter]);

  async function runAction() {
    if (!accessToken || !selected) {
      return;
    }
    setErrorMessage(null);
    try {
      const res = await apiRequest<AiActionExecuteResponse>(`/ai/actions/${selected.key}/execute`, { method: "POST", accessToken, body: { variables: variableValues } });
      setRunResult(res.run);
      if (canObserve) {
        await loadCatalog();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function review(runId: string, decision: "approved" | "rejected") {
    if (!accessToken) {
      return;
    }
    try {
      const res = await apiRequest<{ run: AiActionRun }>(`/ai/actions/runs/${runId}/review`, { method: "POST", accessToken, body: { decision } });
      setRunResult(res.run);
      await loadCatalog();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading AI actions" description="The module AI action catalog is loading from the governed gateway." />;
  }

  if (!catalog) {
    return <CrmEmptyState title="AI actions could not be loaded." description={errorMessage ?? "The action catalog could not be loaded."} action={<Button variant="outline" onClick={() => void loadCatalog()}>Retry</Button>} />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="AI everywhere"
        title="Module AI actions run through the governed gateway and prompt registry."
        summary="Every CRM module exposes AI actions — summaries, explanations, drafts, and recommendations. Each action checks permissions, resolves its prompt from the managed registry (never hardcoded), executes through the AI Gateway, and is logged. Sensitive drafts require human review before use."
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Actions" value={String(catalog.actions.length)} description="Available AI actions." />
            <CrmMetricCard label="Modules" value={String(modules.length)} description="Modules with AI actions." />
            <CrmMetricCard label="Sensitive" value={String(catalog.actions.filter((a) => a.sensitive).length)} description="Actions requiring human review." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={moduleFilter === "all" ? "default" : "outline"} onClick={() => setModuleFilter("all")}>All</Button>
        {modules.map((module) => (
          <Button key={module} size="sm" variant={moduleFilter === module ? "default" : "outline"} onClick={() => setModuleFilter(module)}>{module}</Button>
        ))}
      </div>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Actions</CardTitle><CardDescription>Select an AI action to run.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2">
              {visibleActions.map((action) => (
                <li key={action.key}>
                  <button type="button" onClick={() => { setSelected(action); setVariableValues({}); setRunResult(null); }} className={`w-full rounded-[1rem] border p-3 text-left ${selected?.key === action.key ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"} ${action.permitted ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{action.label}</span>
                      <Badge variant="muted">{action.module}</Badge>
                      <Badge variant="muted">{action.category}</Badge>
                      {action.sensitive ? <Badge>Review</Badge> : null}
                      {!action.permitted ? <Badge variant="muted">No access</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <Card>
              <CardHeader><CardTitle>{selected.label}</CardTitle><CardDescription>{selected.module} • prompt template {selected.templateKey}{selected.sensitive ? " • requires human review" : ""}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {selected.permitted ? (
                  <>
                    {selected.variables.map((variable) => (
                      <label key={variable} className="space-y-1 block"><span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{variable}</span>
                        <input className={inputClassName} value={variableValues[variable] ?? ""} onChange={(e) => setVariableValues((c) => ({ ...c, [variable]: e.target.value }))} />
                      </label>
                    ))}
                    <Button onClick={() => void runAction()}>Run action</Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Your role cannot run this action.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <CrmEmptyState title="Select an action" description="Choose an AI action from the list to provide inputs and run it through the gateway." />
          )}

          {runResult ? (
            <Card>
              <CardHeader><CardTitle>Result</CardTitle><CardDescription>Governed placeholder output from the gateway.</CardDescription></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{runResult.status}</Badge>
                  <Badge variant="muted">{runResult.provider}</Badge>
                  <Badge variant="muted">{runResult.model}</Badge>
                  {runResult.requiresReview ? <Badge>Review: {runResult.reviewStatus}</Badge> : null}
                </div>
                <p className="whitespace-pre-wrap leading-6">{runResult.output}</p>
                <p className="text-xs text-muted-foreground">Resolved prompt: {runResult.resolvedPrompt}</p>
                {runResult.requiresReview && runResult.reviewStatus === "pending_review" && canReview ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void review(runResult.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => void review(runResult.id, "rejected")}>Reject</Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {canObserve && runs.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Recent runs</CardTitle><CardDescription>Logged AI action executions for this tenant.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <ul className="space-y-2">
                  {runs.slice(0, 15).map((run) => (
                    <li key={run.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{run.module}</Badge>
                        <span className="font-medium">{run.actionKey}</span>
                        <Badge variant="muted">{run.status}</Badge>
                        {run.requiresReview ? <Badge variant="muted">{run.reviewStatus}</Badge> : null}
                        <span className="text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
