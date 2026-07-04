import { useEffect, useState, type FormEvent } from "react";
import type { L2InvestigationResponse, L2InvestigationView, SupportTicketOptionsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SupportL2PanelProps {
  ticketId: string;
  options: SupportTicketOptionsResponse;
  accessToken: string | null;
  canManage: boolean;
}

export function SupportL2Panel({ ticketId, options, accessToken, canManage }: SupportL2PanelProps) {
  const [view, setView] = useState<L2InvestigationView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inv, setInv] = useState({ environment: "", configuration: "", logs: "", note: "" });
  const [bug, setBug] = useState({ stepsToReproduce: "", expectedResult: "", actualResult: "", severity: "medium", customerImpact: "", engineeringRef: "" });
  const [rca, setRca] = useState({ rootCause: "", impact: "", timeline: "", resolution: "", preventiveAction: "", ownerId: "", dueDate: "" });
  const [approverId, setApproverId] = useState("");

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const response = await apiRequest<L2InvestigationResponse>(`/support/tickets/${ticketId}/investigation`, { method: "GET", accessToken });
      const v = response.investigation;
      setView(v);
      setInv({ environment: v.environment ?? "", configuration: v.configuration ?? "", logs: v.logs ?? "", note: "" });
      if (v.rca) {
        setRca({ rootCause: v.rca.rootCause ?? "", impact: v.rca.impact ?? "", timeline: v.rca.timeline ?? "", resolution: v.rca.resolution ?? "", preventiveAction: v.rca.preventiveAction ?? "", ownerId: v.rca.owner?.id ?? "", dueDate: v.rca.dueDate ?? "" });
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, ticketId]);

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

  const put = (path: string, body: Record<string, unknown>) => apiRequest(`/support/tickets/${ticketId}${path}`, { method: "PUT", accessToken, body });
  const post = (path: string, body: Record<string, unknown>) => apiRequest(`/support/tickets/${ticketId}${path}`, { method: "POST", accessToken, body });

  function handleInvestigation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("inv", async () => { await put("/investigation", { environment: inv.environment || null, configuration: inv.configuration || null, logs: inv.logs || null, note: inv.note || null }); setInv((c) => ({ ...c, note: "" })); }, "Investigation saved.");
  }
  function handleBug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("bug", () => post("/bug-escalation", { stepsToReproduce: bug.stepsToReproduce.trim(), expectedResult: bug.expectedResult || null, actualResult: bug.actualResult || null, severity: bug.severity, customerImpact: bug.customerImpact || null, engineeringRef: bug.engineeringRef || null }), "Bug escalated to engineering.");
  }
  function handleRca(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("rca", () => put("/rca", { rootCause: rca.rootCause || null, impact: rca.impact || null, timeline: rca.timeline || null, resolution: rca.resolution || null, preventiveAction: rca.preventiveAction || null, ownerId: rca.ownerId || null, dueDate: rca.dueDate || null }), "RCA saved.");
  }

  if (!view) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* L2-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Technical investigation</CardTitle>
          <CardDescription>Environment, configuration, logs + prior tickets ({view.priorTickets.length}). AI similar-issue summary is a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.priorTickets.length > 0 ? (
            <div className="rounded-[1rem] bg-background/75 p-2 text-sm">
              <p className="font-medium">Prior tickets</p>
              {view.priorTickets.slice(0, 5).map((prior) => <p key={prior.ticketId} className="text-xs text-muted-foreground">{prior.subject} · {prior.status?.label}</p>)}
            </div>
          ) : null}
          {view.attachments.length > 0 ? <p className="text-xs text-muted-foreground">Attachments: {view.attachments.join(", ")}</p> : null}
          {view.notes.length > 0 ? <div className="space-y-1">{view.notes.slice(-4).map((note) => <p key={note.id} className="text-xs text-muted-foreground">• {note.note}</p>)}</div> : null}
          {canManage ? (
            <form className="space-y-2" onSubmit={handleInvestigation}>
              <textarea className={textareaClassName} rows={2} placeholder="Customer environment" value={inv.environment} onChange={(e) => setInv((c) => ({ ...c, environment: e.target.value }))} disabled={busy !== null} />
              <textarea className={textareaClassName} rows={2} placeholder="Configuration" value={inv.configuration} onChange={(e) => setInv((c) => ({ ...c, configuration: e.target.value }))} disabled={busy !== null} />
              <textarea className={textareaClassName} rows={2} placeholder="Logs" value={inv.logs} onChange={(e) => setInv((c) => ({ ...c, logs: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="Add investigation note" value={inv.note} onChange={(e) => setInv((c) => ({ ...c, note: e.target.value }))} disabled={busy !== null} />
              <Button type="submit" disabled={busy !== null}>Save investigation</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* L2-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Bug escalation to engineering</CardTitle>
          <CardDescription>{view.bugEscalation ? `Ref ${view.bugEscalation.engineeringRef ?? "—"} · status ${view.bugEscalation.syncStatus} · severity ${view.bugEscalation.severity}` : "No bug escalated yet."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {canManage ? (
            <>
              <form className="space-y-2" onSubmit={handleBug}>
                <textarea className={textareaClassName} rows={2} placeholder="Steps to reproduce" value={bug.stepsToReproduce} onChange={(e) => setBug((c) => ({ ...c, stepsToReproduce: e.target.value }))} disabled={busy !== null} />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Expected result" value={bug.expectedResult} onChange={(e) => setBug((c) => ({ ...c, expectedResult: e.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Actual result" value={bug.actualResult} onChange={(e) => setBug((c) => ({ ...c, actualResult: e.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Customer impact" value={bug.customerImpact} onChange={(e) => setBug((c) => ({ ...c, customerImpact: e.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Engineering reference (e.g. JIRA-123)" value={bug.engineeringRef} onChange={(e) => setBug((c) => ({ ...c, engineeringRef: e.target.value }))} disabled={busy !== null} />
                  <select className={selectClassName} value={bug.severity} onChange={(e) => setBug((c) => ({ ...c, severity: e.target.value }))} disabled={busy !== null}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
                <Button type="submit" disabled={busy !== null || !bug.stepsToReproduce.trim()}>Escalate bug</Button>
              </form>
              {view.bugEscalation ? (
                <div className="flex flex-wrap gap-2">
                  {["acknowledged", "in_progress", "fixed", "released", "wont_fix"].map((status) => (
                    <Button key={status} type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`bs-${status}`, () => post("/bug-status", { syncStatus: status, generateCustomerUpdate: true }), "Bug status updated + customer notified.")}>{status.replace(/_/g, " ")}</Button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* L2-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Root cause analysis</CardTitle>
          <CardDescription>
            {view.rcaRequired ? "RCA required (critical incident). " : ""}{view.rca ? `Share: ${view.rca.shareApprovalStatus ?? "not requested"}${view.rca.shareable ? " (shareable)" : ""}.` : "No RCA yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {canManage ? (
            <>
              <form className="space-y-2" onSubmit={handleRca}>
                <textarea className={textareaClassName} rows={2} placeholder="Root cause" value={rca.rootCause} onChange={(e) => setRca((c) => ({ ...c, rootCause: e.target.value }))} disabled={busy !== null} />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Impact" value={rca.impact} onChange={(e) => setRca((c) => ({ ...c, impact: e.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Timeline" value={rca.timeline} onChange={(e) => setRca((c) => ({ ...c, timeline: e.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Resolution" value={rca.resolution} onChange={(e) => setRca((c) => ({ ...c, resolution: e.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Preventive action" value={rca.preventiveAction} onChange={(e) => setRca((c) => ({ ...c, preventiveAction: e.target.value }))} disabled={busy !== null} />
                  <select className={selectClassName} value={rca.ownerId} onChange={(e) => setRca((c) => ({ ...c, ownerId: e.target.value }))} disabled={busy !== null}>
                    <option value="">RCA owner…</option>
                    {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                  </select>
                  <Input type="date" aria-label="RCA due date" value={rca.dueDate} onChange={(e) => setRca((c) => ({ ...c, dueDate: e.target.value }))} disabled={busy !== null} />
                </div>
                <Button type="submit" disabled={busy !== null}>Save RCA</Button>
              </form>
              <div className="flex flex-wrap items-end gap-2">
                <select className={selectClassName} value={approverId} onChange={(e) => setApproverId(e.target.value)} disabled={busy !== null}>
                  <option value="">Share approver…</option>
                  {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                </select>
                <Button type="button" variant="outline" disabled={busy !== null || !approverId} onClick={() => void run("rca-share", () => post("/rca/share", { approverUserId: approverId }), "RCA share approval requested.")}>Request share approval</Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* L2-004 */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge article</CardTitle>
          <CardDescription>Draft a knowledge article from this ticket's resolution; it links to the ticket and requires review before publishing (L2-004).</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("kb-draft", () => post("/kb-article", {}), "Draft knowledge article created from ticket.")}>Create draft article from ticket</Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
