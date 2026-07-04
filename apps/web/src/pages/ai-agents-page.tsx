import { useState } from "react";
import type { AiAgentKind, AiAgentRunResponse } from "@crm/types";
import { aiAgentKinds } from "@crm/types";
import { CrmHero } from "@/components/crm/crm-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

// Which agents run against a record id vs free-form input.
const ENTITY_HINT: Partial<Record<AiAgentKind, string>> = {
  lead_enrichment: "lead", lead_scoring: "lead", proposal_drafting: "opportunity", opportunity_risk: "opportunity",
  forecasting: "opportunity", support_triage: "ticket", customer_health: "customer_success_account"
};
const FREE_INPUT: Partial<Record<AiAgentKind, string>> = {
  email_drafting: "purpose", call_summary: "notes", knowledge_assistant: "query"
};

export function AiAgentsPage() {
  const { accessToken } = useAuth();
  const [agent, setAgent] = useState<AiAgentKind>("lead_scoring");
  const [entityId, setEntityId] = useState("");
  const [freeInput, setFreeInput] = useState("");
  const [result, setResult] = useState<AiAgentRunResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const entityHint = ENTITY_HINT[agent];
  const freeKey = FREE_INPUT[agent];

  async function run(key: string, action: () => Promise<unknown>, ok: string) {
    if (!accessToken) return;
    setBusy(key); setMessage(null); setErrorMessage(null);
    try { await action(); setMessage(ok); }
    catch (error) { setErrorMessage(getErrorMessage(error)); }
    finally { setBusy(null); }
  }

  async function runAgent() {
    if (!accessToken) return;
    const body: Record<string, unknown> = {};
    if (entityHint && entityId.trim()) { body.entityType = entityHint; body.entityId = entityId.trim(); }
    if (freeKey && freeInput.trim()) body.input = { [freeKey]: freeInput.trim() };
    await run("run", async () => { setResult(await apiRequest<AiAgentRunResponse>(`/ai-agents/${agent}/run`, { method: "POST", accessToken, body })); }, "Agent produced a suggestion.");
  }

  async function decide(decision: "accept" | "override" | "reject") {
    if (!accessToken || !result) return;
    await run(decision, () => apiRequest(`/ai-agents/runs/${result.run.id}/decision`, { method: "POST", accessToken, body: { decision, logActivity: true } }), `Suggestion ${decision}ed${decision === "accept" ? " (feedback stored)" : ""}.`);
  }

  return (
    <div className="space-y-6">
      <CrmHero eyebrow="AI Agents" title="Governed AI agents" summary="Enrichment, scoring, drafting, summaries, risk, forecast, triage, health, and knowledge — every result carries confidence, explanation, sources, and a human-in-the-loop." />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader><CardTitle>Run an agent</CardTitle><CardDescription>Pick an agent. Record-based agents need a record ID; drafting/summary/knowledge agents take free-form input.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <select className={selectClassName} value={agent} onChange={(e) => { setAgent(e.target.value as AiAgentKind); setResult(null); }} aria-label="Agent">
              {aiAgentKinds.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
            </select>
            {entityHint ? <Input placeholder={`${entityHint} ID (UUID)`} className="w-80" value={entityId} onChange={(e) => setEntityId(e.target.value)} /> : null}
            <Button type="button" disabled={busy !== null || (Boolean(entityHint) && !entityId.trim())} onClick={() => void runAgent()}>Run agent</Button>
          </div>
          {freeKey ? <textarea className={textareaClassName} rows={3} placeholder={freeKey === "notes" ? "Paste call notes…" : freeKey === "query" ? "Ask a question…" : "Email purpose…"} value={freeInput} onChange={(e) => setFreeInput(e.target.value)} disabled={busy !== null} /> : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Suggestion — {result.run.agentKind.replace(/_/g, " ")}</CardTitle>
            <CardDescription>
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge variant="muted" className={result.run.lowConfidence ? "border-amber-200 bg-amber-100 text-amber-700" : "border-emerald-200 bg-emerald-100 text-emerald-700"}>{result.run.confidence ?? "—"}% confidence{result.run.lowConfidence ? " · low" : ""}</Badge>
                {result.run.reviewRequired ? <Badge variant="muted" className="border-rose-200 bg-rose-100 text-rose-700">human review required</Badge> : null}
                <Badge variant="muted">{result.run.status}</Badge>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <pre className="overflow-x-auto rounded-[1rem] bg-background/75 p-3 text-xs">{JSON.stringify(result.run.output, null, 2)}</pre>
            {result.factors.length ? (
              <div className="flex flex-wrap gap-2">
                {result.factors.map((f, i) => <Badge key={i} variant="muted" className={f.impact === "negative" ? "border-rose-200 bg-rose-100 text-rose-700" : f.impact === "positive" ? "border-emerald-200 bg-emerald-100 text-emerald-700" : ""}>{f.label}</Badge>)}
              </div>
            ) : null}
            {result.run.sources.length ? <p className="text-xs text-muted-foreground">Sources: {result.run.sources.map((s) => s.label).join(", ")}</p> : null}
            <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
              <Button type="button" size="sm" disabled={busy !== null} onClick={() => void decide("accept")}>Accept</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void decide("override")}>Override</Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void decide("reject")}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
