import { useEffect, useState, type FormEvent } from "react";
import type { SupportKbRecommendationsResponse, SupportTicketOptionsResponse, TicketIntakeAssistResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SupportL1PanelProps {
  ticketId: string;
  options: SupportTicketOptionsResponse;
  accessToken: string | null;
  canManage: boolean;
  onReload: () => void;
}

export function SupportL1Panel({ ticketId, options, accessToken, canManage, onReload }: SupportL1PanelProps) {
  const [assist, setAssist] = useState<TicketIntakeAssistResponse | null>(null);
  const [kb, setKb] = useState<SupportKbRecommendationsResponse["recommendations"]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [escalate, setEscalate] = useState({ reason: "", troubleshooting: "", impact: "", l2OwnerId: "", notifyCustomer: false });
  const [close, setClose] = useState({ resolutionSummary: "", rootCauseCategoryKey: "", requestCustomerConfirmation: true });

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [assistResponse, kbResponse] = await Promise.all([
        apiRequest<TicketIntakeAssistResponse>(`/support/tickets/${ticketId}/intake-assist`, { method: "GET", accessToken }),
        apiRequest<SupportKbRecommendationsResponse>(`/support/tickets/${ticketId}/kb-recommendations`, { method: "GET", accessToken })
      ]);
      setAssist(assistResponse);
      setKb(kbResponse.recommendations);
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
      onReload();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function handleEscalate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("escalate", () => apiRequest(`/support/tickets/${ticketId}/escalate`, { method: "POST", accessToken, body: { reason: escalate.reason.trim(), troubleshooting: escalate.troubleshooting || null, impact: escalate.impact || null, l2OwnerId: escalate.l2OwnerId || null, notifyCustomer: escalate.notifyCustomer } }), "Ticket escalated to L2.");
  }

  function handleClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("close", () => apiRequest(`/support/tickets/${ticketId}/close`, { method: "POST", accessToken, body: { resolutionSummary: close.resolutionSummary.trim(), rootCauseCategoryKey: close.rootCauseCategoryKey || null, requestCustomerConfirmation: close.requestCustomerConfirmation } }), "Ticket closed. CSAT survey triggered.");
  }

  if (!assist) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* L1-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Intake assist</CardTitle>
          <CardDescription>Suggested category <Badge variant="muted">{assist.classification.categoryKey ?? "—"}</Badge> · urgency <Badge variant="muted">{assist.classification.urgency}</Badge>. AI classification is a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {assist.duplicates.length > 0 ? (
            <div className="rounded-[1rem] bg-amber-50 p-2 text-sm dark:bg-amber-950/30">
              <p className="font-medium text-amber-700 dark:text-amber-400">Possible duplicates ({assist.duplicates.length})</p>
              {assist.duplicates.map((dup) => <p key={dup.ticketId} className="text-xs text-muted-foreground">{dup.subject} · {dup.status?.label}</p>)}
            </div>
          ) : <p className="text-sm text-muted-foreground">No duplicates detected.</p>}
          {canManage ? <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("ack", () => apiRequest(`/support/tickets/${ticketId}/acknowledge`, { method: "POST", accessToken, body: {} }), "Acknowledgement sent.")}>Send acknowledgement</Button> : null}
        </CardContent>
      </Card>

      {/* L1-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge base</CardTitle>
          <CardDescription>Recommended articles for this ticket (L1-003). AI recommendation is a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {kb.length === 0 ? <p className="text-sm text-muted-foreground">No matching articles.</p> : kb.map((rec) => (
            <div key={rec.articleId} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
              <span>{rec.title} {rec.category ? <span className="text-xs text-muted-foreground">· {rec.category.label}</span> : null} <Badge variant="muted">match {rec.score}</Badge></span>
              {canManage ? (
                <span className="flex gap-2">
                  <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(`kb-y-${rec.articleId}`, () => apiRequest(`/support/tickets/${ticketId}/kb-usage`, { method: "POST", accessToken, body: { articleId: rec.articleId, helpful: true } }), "Article used (helpful).")}>Use · helpful</Button>
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`kb-n-${rec.articleId}`, () => apiRequest(`/support/tickets/${ticketId}/kb-usage`, { method: "POST", accessToken, body: { articleId: rec.articleId, helpful: false } }), "Feedback logged.")}>Not helpful</Button>
                </span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {canManage ? (
        <>
          {/* L1-004 */}
          <Card>
            <CardHeader><CardTitle>Escalate to L2</CardTitle><CardDescription>Requires reason, troubleshooting, impact; assigns an L2 owner (L1-004).</CardDescription></CardHeader>
            <CardContent>
              <form className="space-y-2" onSubmit={handleEscalate}>
                <textarea className={textareaClassName} rows={2} placeholder="Escalation reason" value={escalate.reason} onChange={(event) => setEscalate((c) => ({ ...c, reason: event.target.value }))} disabled={busy !== null} />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Troubleshooting done" value={escalate.troubleshooting} onChange={(event) => setEscalate((c) => ({ ...c, troubleshooting: event.target.value }))} disabled={busy !== null} />
                  <Input placeholder="Impact" value={escalate.impact} onChange={(event) => setEscalate((c) => ({ ...c, impact: event.target.value }))} disabled={busy !== null} />
                  <select className={selectClassName} value={escalate.l2OwnerId} onChange={(event) => setEscalate((c) => ({ ...c, l2OwnerId: event.target.value }))} disabled={busy !== null}>
                    <option value="">Assign L2 owner…</option>
                    {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={escalate.notifyCustomer} onChange={(event) => setEscalate((c) => ({ ...c, notifyCustomer: event.target.checked }))} disabled={busy !== null} /> Notify customer</label>
                </div>
                <Button type="submit" disabled={busy !== null || !escalate.reason.trim()}>Escalate</Button>
              </form>
            </CardContent>
          </Card>

          {/* L1-005 */}
          <Card>
            <CardHeader><CardTitle>Close ticket</CardTitle><CardDescription>Resolution summary mandatory; captures root cause; triggers CSAT (L1-005).</CardDescription></CardHeader>
            <CardContent>
              <form className="space-y-2" onSubmit={handleClose}>
                <textarea className={textareaClassName} rows={2} placeholder="Resolution summary" value={close.resolutionSummary} onChange={(event) => setClose((c) => ({ ...c, resolutionSummary: event.target.value }))} disabled={busy !== null} />
                <div className="grid gap-2 md:grid-cols-2">
                  <select className={selectClassName} value={close.rootCauseCategoryKey} onChange={(event) => setClose((c) => ({ ...c, rootCauseCategoryKey: event.target.value }))} disabled={busy !== null}>
                    <option value="">Root cause…</option>
                    {options.rootCauses.map((rc) => <option key={rc.key} value={rc.key}>{rc.label}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={close.requestCustomerConfirmation} onChange={(event) => setClose((c) => ({ ...c, requestCustomerConfirmation: event.target.checked }))} disabled={busy !== null} /> Request customer confirmation</label>
                </div>
                <Button type="submit" disabled={busy !== null || !close.resolutionSummary.trim()}>Close ticket</Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
