import { useEffect, useState } from "react";
import type { AiQualityDashboardResponse, AiRiskLevel, AiUseCaseActionType, AiUseCasesResponse, AiUseCaseSummary } from "@crm/types";
import { aiRiskLevels, aiUseCaseActionTypes } from "@crm/types";
import { CrmHero, CrmMetricCard } from "@/components/crm/crm-shell";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";


export function AiGovernancePage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const canManage = hasAnyPermission(["ai.manage_ai", "ai.configure", "ai.approve"]);
  const [useCases, setUseCases] = useState<AiUseCaseSummary[]>([]);
  const [quality, setQuality] = useState<AiQualityDashboardResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", persona: "", objectType: "", dataUsed: "", actionType: "assist", riskLevel: "low", model: "", prompt: "", monitoringPlan: "" });
  const [taskTitle, setTaskTitle] = useState("");

  async function loadAll() {
    if (!accessToken) return;
    try {
      const [ucs, q] = await Promise.all([
        apiRequest<AiUseCasesResponse>("/ai-governance/use-cases", { accessToken }),
        apiRequest<AiQualityDashboardResponse>("/ai-governance/quality", { accessToken })
      ]);
      setUseCases(ucs.useCases);
      setQuality(q);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadAll();
     
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
      <CrmHero eyebrow="AI Governance" title="Govern every AI feature" summary="Use-case registry, human approval, explanations, audit trail, and quality monitoring." />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* AIG-005 */}
      {quality ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CrmMetricCard label="AI runs" value={String(quality.quality.totalRuns)} description="Governed AI actions executed." />
            <CrmMetricCard label="Override rate" value={`${quality.quality.overrideRate}%`} description={`${quality.quality.overrides} of ${quality.quality.reviewedRuns} reviewed rejected.`} />
            <CrmMetricCard label="Low-confidence" value={String(quality.quality.lowConfidenceCount)} description="Outputs below the confidence threshold." />
            <CrmMetricCard label="Business impact" value={String(quality.quality.businessImpactScore)} description="Helpfulness minus hallucination/override drag." />
          </section>
          <Card>
            <CardHeader>
              <CardTitle>AI quality</CardTitle>
              <CardDescription>Usage, feedback, hallucination reports, response time, and improvement tasks (AIG-005).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">{quality.quality.feedbackCount} feedback</Badge>
                <Badge variant="muted">{quality.quality.helpfulRate}% helpful</Badge>
                <Badge variant="muted" className={quality.quality.hallucinationReports > 0 ? "border-rose-200 bg-rose-100 text-rose-700" : ""}>{quality.quality.hallucinationReports} hallucination report(s)</Badge>
                <Badge variant="muted">avg {quality.quality.avgResponseMs ?? "—"}ms</Badge>
              </div>
              {quality.recentFeedback.length ? (
                <ul className="space-y-1">
                  {quality.recentFeedback.slice(0, 5).map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="muted" className={f.rating === "not_helpful" ? "border-rose-200 bg-rose-100 text-rose-700" : ""}>{f.rating}</Badge>
                      {f.isHallucination ? <Badge variant="muted" className="border-rose-200 bg-rose-100 text-rose-700">hallucination</Badge> : null}
                      {f.confidenceFlag === "low" ? <Badge variant="muted">low confidence</Badge> : null}
                      <span>{formatDateTime(f.createdAt)}{f.comment ? ` · ${f.comment}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {canManage ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
                  <Input placeholder="Turn an AI issue into an improvement task" className="w-80" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} disabled={busy !== null} />
                  <Button type="button" variant="outline" disabled={busy !== null || !taskTitle.trim()} onClick={() => void run("task", async () => { await apiRequest("/ai-governance/improvement-tasks", { method: "POST", accessToken, body: { title: taskTitle.trim(), source: "quality" } }); setTaskTitle(""); }, "Improvement task created.")}>Create task</Button>
                </div>
              ) : null}
              {quality.improvementTasks.length ? (
                <div className="flex flex-wrap gap-2">
                  {quality.improvementTasks.slice(0, 6).map((t) => <Badge key={t.id} variant="muted">{t.title} · {t.status}</Badge>)}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* AIG-001 */}
      <Card>
        <CardHeader>
          <CardTitle>AI use-case registry</CardTitle>
          <CardDescription>Every AI feature is registered, versioned, and risk-assessed; high-risk use cases require approval (AIG-001).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {canManage ? (
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="Use case name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="Persona" value={form.persona} onChange={(e) => setForm((c) => ({ ...c, persona: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="Object" value={form.objectType} onChange={(e) => setForm((c) => ({ ...c, objectType: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="Data used" value={form.dataUsed} onChange={(e) => setForm((c) => ({ ...c, dataUsed: e.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={form.actionType} onChange={(e) => setForm((c) => ({ ...c, actionType: e.target.value }))} disabled={busy !== null} aria-label="Action type">
                {aiUseCaseActionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className={selectClassName} value={form.riskLevel} onChange={(e) => setForm((c) => ({ ...c, riskLevel: e.target.value }))} disabled={busy !== null} aria-label="Risk level">
                {aiRiskLevels.map((r) => <option key={r} value={r}>{r} risk</option>)}
              </select>
              <Input placeholder="Model" value={form.model} onChange={(e) => setForm((c) => ({ ...c, model: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="Monitoring plan" value={form.monitoringPlan} onChange={(e) => setForm((c) => ({ ...c, monitoringPlan: e.target.value }))} disabled={busy !== null} />
              <textarea className={textareaClassName} rows={2} placeholder="Prompt" value={form.prompt} onChange={(e) => setForm((c) => ({ ...c, prompt: e.target.value }))} disabled={busy !== null} />
              <div className="md:col-span-2">
                <Button type="button" disabled={busy !== null || !form.name.trim()} onClick={() => void run("uc", async () => { await apiRequest("/ai-governance/use-cases", { method: "POST", accessToken, body: { name: form.name.trim(), persona: form.persona || null, objectType: form.objectType || null, dataUsed: form.dataUsed || null, actionType: form.actionType as AiUseCaseActionType, riskLevel: form.riskLevel as AiRiskLevel, model: form.model || null, prompt: form.prompt || null, monitoringPlan: form.monitoringPlan || null } }); setForm({ name: "", persona: "", objectType: "", dataUsed: "", actionType: "assist", riskLevel: "low", model: "", prompt: "", monitoringPlan: "" }); }, "AI use case registered.")}>Register use case</Button>
              </div>
            </div>
          ) : null}
          {useCases.length ? useCases.map((uc) => (
            <div key={uc.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{uc.name}</span>
                <StatusPill value={uc.riskLevel}>{uc.riskLevel} risk</StatusPill>
                <StatusPill size="sm" value={uc.approvalStatus}>{uc.approvalStatus}</StatusPill>
                <Badge variant="muted">v{uc.version}</Badge>
                {uc.persona ? <span className="text-xs text-muted-foreground">{uc.persona}</span> : null}
                {uc.model ? <span className="text-xs text-muted-foreground">{uc.model}</span> : null}
              </div>
              {canManage && uc.approvalStatus === "pending_approval" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={busy !== null} onClick={() => void run(`ap-${uc.id}`, () => apiRequest(`/ai-governance/use-cases/${uc.id}/decision`, { method: "POST", accessToken, body: { decision: "approve" } }), "Use case approved.")}>Approve</Button>
                  <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`rj-${uc.id}`, () => apiRequest(`/ai-governance/use-cases/${uc.id}/decision`, { method: "POST", accessToken, body: { decision: "reject" } }), "Use case rejected.")}>Reject</Button>
                </div>
              ) : null}
            </div>
          )) : <p className="text-muted-foreground">No AI use cases registered yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
