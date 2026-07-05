import { useEffect, useState, type FormEvent } from "react";
import type { LegalOptionsResponse, LegalReview, LegalReviewResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface LegalReviewPanelProps {
  opportunityId: string;
  accessToken: string | null;
  canManage: boolean;
}

export function LegalReviewPanel({ opportunityId, accessToken, canManage }: LegalReviewPanelProps) {
  const [view, setView] = useState<LegalReview | null>(null);
  const [options, setOptions] = useState<LegalOptionsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [request, setRequest] = useState({ contractTypeKey: "", dueDate: "", redlines: "", riskLevel: "", legalOwnerId: "" });
  const [clause, setClause] = useState({ title: "", category: "", status: "standard", riskNote: "" });
  const [approver, setApprover] = useState<Record<string, string>>({});
  const [signedRef, setSignedRef] = useState("");

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [legal, opts] = await Promise.all([
        apiRequest<LegalReviewResponse>(`/legal/${opportunityId}`, { method: "GET", accessToken }),
        apiRequest<LegalOptionsResponse>("/legal/options", { method: "GET", accessToken })
      ]);
      setView(legal.legal);
      setOptions(opts);
      setRequest((current) => ({
        contractTypeKey: legal.legal.contractType?.key ?? current.contractTypeKey,
        dueDate: legal.legal.dueDate ?? current.dueDate,
        redlines: legal.legal.redlines ?? current.redlines,
        riskLevel: legal.legal.riskLevel ?? current.riskLevel,
        legalOwnerId: legal.legal.legalOwner?.id ?? current.legalOwnerId
      }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
     
  }, [accessToken, opportunityId]);

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

  const call = (path: string, method: "PUT" | "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) =>
    apiRequest(`/legal/${opportunityId}${path}`, { method, accessToken, ...(body ? { body } : {}) });

  function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("request", () => call("", "PUT", { contractTypeKey: request.contractTypeKey || null, dueDate: request.dueDate || null, redlines: request.redlines || null, riskLevel: request.riskLevel || null, legalOwnerId: request.legalOwnerId || null }), "Legal request saved.");
  }

  function handleClause(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("clause", async () => {
      await call("/clauses", "POST", clause);
      setClause({ title: "", category: "", status: "standard", riskNote: "" });
    }, "Clause added.");
  }

  if (!view || !options) {
    return null;
  }

  const canApprove = !view.clauseSummary.hasUnresolvedHighRisk;

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* LEG-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Legal review request</CardTitle>
          <CardDescription>
            {view.contractType?.label ?? "No contract type"} · SLA {view.slaStatus}{view.slaDueAt ? ` (due ${view.slaDueAt.slice(0, 10)})` : ""} · owner {view.legalOwner?.displayName ?? "unassigned"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleRequest}>
              <select className={selectClassName} value={request.contractTypeKey} onChange={(event) => setRequest((c) => ({ ...c, contractTypeKey: event.target.value }))} disabled={busy !== null}>
                <option value="">Contract type…</option>
                {options.contractTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
              </select>
              <Input type="date" aria-label="Due date" value={request.dueDate} onChange={(event) => setRequest((c) => ({ ...c, dueDate: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={request.riskLevel} onChange={(event) => setRequest((c) => ({ ...c, riskLevel: event.target.value }))} disabled={busy !== null}>
                <option value="">Risk level…</option>
                {options.riskLevels.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
              <select className={selectClassName} value={request.legalOwnerId} onChange={(event) => setRequest((c) => ({ ...c, legalOwnerId: event.target.value }))} disabled={busy !== null}>
                <option value="">Legal owner…</option>
                {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
              </select>
              <textarea className={`${textareaClassName} md:col-span-2`} rows={2} placeholder="Redlines / notes" value={request.redlines} onChange={(event) => setRequest((c) => ({ ...c, redlines: event.target.value }))} disabled={busy !== null} />
              <div className="md:col-span-2"><Button type="submit" disabled={busy !== null}>Save request</Button></div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* LEG-002 */}
      <Card>
        <CardHeader>
          <CardTitle>Clause deviation tracking</CardTitle>
          <CardDescription>
            {view.clauseSummary.total} clauses · {view.clauseSummary.highRisk} high-risk ({view.clauseSummary.unresolvedHighRisk} unresolved). High-risk clauses require leadership approval (LEG-002).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.clauses.map((entry) => (
            <div key={entry.id} className="rounded-[1rem] bg-background/75 p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{entry.title} {entry.category ? <span className="text-xs text-muted-foreground">· {entry.category}</span> : null}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={entry.status === "high_risk" && !entry.resolved ? "default" : "muted"}>{entry.status}</Badge>
                  {entry.approvalStatus ? <Badge variant="muted">appr {entry.approvalStatus}</Badge> : null}
                </span>
              </div>
              {canManage && entry.status === "high_risk" && !entry.resolved ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <select className={selectClassName} value={approver[entry.id] ?? ""} onChange={(event) => setApprover((c) => ({ ...c, [entry.id]: event.target.value }))} disabled={busy !== null}>
                    <option value="">Approver…</option>
                    {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                  </select>
                  <Button type="button" variant="outline" disabled={busy !== null || !approver[entry.id]} onClick={() => void run(`appr-${entry.id}`, () => call(`/clauses/${entry.id}/approval`, "POST", { approverUserId: approver[entry.id] }), "Sent for leadership approval.")}>Request approval</Button>
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`acc-${entry.id}`, () => call(`/clauses/${entry.id}`, "PATCH", { status: "accepted" }), "Clause accepted.")}>Accept</Button>
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`rej-${entry.id}`, () => call(`/clauses/${entry.id}`, "PATCH", { status: "rejected" }), "Clause rejected.")}>Reject</Button>
                </div>
              ) : null}
            </div>
          ))}
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2 rounded-[1rem] border border-border/60 p-3" onSubmit={handleClause}>
              <Input placeholder="Clause title" value={clause.title} onChange={(event) => setClause((c) => ({ ...c, title: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Category (e.g. liability)" value={clause.category} onChange={(event) => setClause((c) => ({ ...c, category: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={clause.status} onChange={(event) => setClause((c) => ({ ...c, status: event.target.value }))} disabled={busy !== null}>
                {options.clauseStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Input placeholder="Risk note" value={clause.riskNote} onChange={(event) => setClause((c) => ({ ...c, riskNote: event.target.value }))} disabled={busy !== null} />
              <div className="md:col-span-2"><Button type="submit" disabled={busy !== null || !clause.title.trim()}>Add clause</Button></div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* LEG-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Contract approval</CardTitle>
          <CardDescription>
            {view.contractApproved ? "Approved" : "Not approved"} · closure {view.closureReady ? "ready" : "not ready"}.
            {view.clauseSummary.hasUnresolvedHighRisk ? " Blocked: unresolved high-risk clauses." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.signedFileRef ? <p className="text-xs text-muted-foreground">Signed: {view.signedFileRef}</p> : null}
          {canManage ? (
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Signed file reference / URL" value={signedRef} onChange={(event) => setSignedRef(event.target.value)} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !signedRef.trim()} onClick={() => void run("signed", async () => { await call("/signed", "POST", { signedFileRef: signedRef.trim() }); setSignedRef(""); }, "Signed contract recorded.")}>Upload signed</Button>
              <Button type="button" disabled={busy !== null || !canApprove} onClick={() => void run("approve", () => call("/approve", "POST", {}), "Contract approved.")}>Approve contract</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
