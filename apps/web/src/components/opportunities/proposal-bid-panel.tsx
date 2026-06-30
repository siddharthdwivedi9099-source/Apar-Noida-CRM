import { useEffect, useState, type FormEvent } from "react";
import type { ProposalOptionsResponse, ProposalWorkspace, ProposalWorkspaceResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface ProposalBidPanelProps {
  opportunityId: string;
  accessToken: string | null;
  canManage: boolean;
}

export function ProposalBidPanel({ opportunityId, accessToken, canManage }: ProposalBidPanelProps) {
  const [view, setView] = useState<ProposalWorkspace | null>(null);
  const [options, setOptions] = useState<ProposalOptionsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [request, setRequest] = useState({ statusKey: "", templateKey: "", scope: "", dueDate: "", contributorIds: [] as string[] });
  const [compliance, setCompliance] = useState({ requirement: "", owner: "", complianceStatus: "pending", responseStatus: "pending" });
  const [version, setVersion] = useState({ label: "", notes: "" });
  const [approver, setApprover] = useState({ versionId: "", approverUserId: "" });
  const [submission, setSubmission] = useState({ submittedAt: "", mode: "", recipient: "", documents: "", acknowledgement: "", remarks: "" });

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [proposal, opts] = await Promise.all([
        apiRequest<ProposalWorkspaceResponse>(`/proposals/${opportunityId}`, { method: "GET", accessToken }),
        apiRequest<ProposalOptionsResponse>("/proposals/options", { method: "GET", accessToken })
      ]);
      setView(proposal.proposal);
      setOptions(opts);
      setRequest((current) => ({
        statusKey: proposal.proposal.status?.key ?? current.statusKey,
        templateKey: proposal.proposal.template?.key ?? current.templateKey,
        scope: proposal.proposal.scope ?? current.scope,
        dueDate: proposal.proposal.dueDate ?? current.dueDate,
        contributorIds: proposal.proposal.contributors.map((contributor) => contributor.id)
      }));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    apiRequest(`/proposals/${opportunityId}${path}`, { method, accessToken, ...(body ? { body } : {}) });

  function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("request", () => call("", "PUT", {
      statusKey: request.statusKey || null,
      templateKey: request.templateKey || null,
      scope: request.scope || null,
      dueDate: request.dueDate || null,
      contributorIds: request.contributorIds
    }), "Proposal request saved.");
  }

  function handleCompliance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("compliance", async () => {
      await call("/compliance", "POST", compliance);
      setCompliance({ requirement: "", owner: "", complianceStatus: "pending", responseStatus: "pending" });
    }, "Compliance item added.");
  }

  function handleVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("version", async () => {
      await call("/versions", "POST", version);
      setVersion({ label: "", notes: "" });
    }, "Version added.");
  }

  function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("submission", () => call("/submission", "POST", submission), "Submission recorded.");
  }

  if (!view || !options) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* PB-001 */}
      <Card>
        <CardHeader>
          <CardTitle>Proposal request</CardTitle>
          <CardDescription>Track document work from this opportunity (PB-001). Status: {view.status?.label ?? "—"}.</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form className="space-y-2" onSubmit={handleRequest}>
              <div className="grid gap-2 md:grid-cols-2">
                <select className={selectClassName} value={request.statusKey} onChange={(event) => setRequest((c) => ({ ...c, statusKey: event.target.value }))} disabled={busy !== null}>
                  <option value="">Status…</option>
                  {options.statuses.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
                </select>
                <select className={selectClassName} value={request.templateKey} onChange={(event) => setRequest((c) => ({ ...c, templateKey: event.target.value }))} disabled={busy !== null}>
                  <option value="">Template…</option>
                  {options.templates.map((template) => <option key={template.key} value={template.key}>{template.label}</option>)}
                </select>
                <Input type="date" aria-label="Due date" value={request.dueDate} onChange={(event) => setRequest((c) => ({ ...c, dueDate: event.target.value }))} disabled={busy !== null} />
              </div>
              <textarea className={textareaClassName} rows={2} placeholder="Scope" value={request.scope} onChange={(event) => setRequest((c) => ({ ...c, scope: event.target.value }))} disabled={busy !== null} />
              <div className="flex flex-wrap gap-2">
                {options.owners.slice(0, 20).map((owner) => (
                  <label key={owner.id} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={request.contributorIds.includes(owner.id)} onChange={() => setRequest((c) => ({ ...c, contributorIds: c.contributorIds.includes(owner.id) ? c.contributorIds.filter((id) => id !== owner.id) : [...c.contributorIds, owner.id] }))} disabled={busy !== null} />
                    {owner.displayName}
                  </label>
                ))}
              </div>
              <Button type="submit" disabled={busy !== null}>Save request</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* PB-002 */}
      <Card>
        <CardHeader>
          <CardTitle>RFP compliance matrix</CardTitle>
          <CardDescription>
            {view.complianceSummary.respondedCount}/{view.complianceSummary.total} responded · {view.complianceSummary.missingResponseCount} missing · {view.complianceSummary.gapCount} gaps (PB-002). AI extraction is a governed placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.complianceItems.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
              <span>{item.requirement} {item.owner ? <span className="text-xs text-muted-foreground">· {item.owner}</span> : null}</span>
              <span className="flex items-center gap-2">
                <Badge variant={item.responseStatus === "complete" ? "muted" : "default"}>{item.responseStatus}</Badge>
                <Badge variant={item.complianceStatus === "compliant" ? "muted" : "default"}>{item.complianceStatus}</Badge>
                {canManage ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`rm-${item.id}`, () => call(`/compliance/${item.id}`, "DELETE"), "Removed.")}>Remove</Button> : null}
              </span>
            </div>
          ))}
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2 rounded-[1rem] border border-border/60 p-3" onSubmit={handleCompliance}>
              <Input placeholder="Requirement" value={compliance.requirement} onChange={(event) => setCompliance((c) => ({ ...c, requirement: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Owner" value={compliance.owner} onChange={(event) => setCompliance((c) => ({ ...c, owner: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={compliance.responseStatus} onChange={(event) => setCompliance((c) => ({ ...c, responseStatus: event.target.value }))} disabled={busy !== null}>
                {options.responseStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <select className={selectClassName} value={compliance.complianceStatus} onChange={(event) => setCompliance((c) => ({ ...c, complianceStatus: event.target.value }))} disabled={busy !== null}>
                {options.complianceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Button type="submit" disabled={busy !== null || !compliance.requirement.trim()}>Add requirement</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* PB-003 */}
      <Card>
        <CardHeader>
          <CardTitle>Version control</CardTitle>
          <CardDescription>
            {view.versionSummary.count} versions · {view.versionSummary.finalLocked ? "final locked" : "no locked final"}. Approval {view.approvalStatus ?? "not requested"} (PB-003).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {view.versions.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
              <span>{entry.label} {entry.isFinal ? <Badge variant="muted">final</Badge> : null} {entry.locked ? <Badge variant="muted">locked</Badge> : null}</span>
              {canManage && view.approvalStatus === "approved" && !entry.locked ? (
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(`lock-${entry.id}`, () => call(`/versions/${entry.id}/lock`, "POST"), "Final version locked.")}>Lock final</Button>
              ) : null}
            </div>
          ))}
          {canManage ? (
            <>
              <form className="flex flex-wrap items-end gap-2 rounded-[1rem] border border-border/60 p-3" onSubmit={handleVersion}>
                <Input placeholder="Version label" value={version.label} onChange={(event) => setVersion((c) => ({ ...c, label: event.target.value }))} disabled={busy !== null} />
                <Input placeholder="Notes" value={version.notes} onChange={(event) => setVersion((c) => ({ ...c, notes: event.target.value }))} disabled={busy !== null} />
                <Button type="submit" disabled={busy !== null || !version.label.trim()}>Add version</Button>
              </form>
              <div className="flex flex-wrap items-end gap-2">
                <select className={selectClassName} value={approver.versionId} onChange={(event) => setApprover((c) => ({ ...c, versionId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Version to approve…</option>
                  {view.versions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                </select>
                <select className={selectClassName} value={approver.approverUserId} onChange={(event) => setApprover((c) => ({ ...c, approverUserId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Approver…</option>
                  {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
                </select>
                <Button type="button" disabled={busy !== null || !approver.versionId || !approver.approverUserId} onClick={() => void run("submit", () => call("/versions/submit", "POST", { versionId: approver.versionId, approverUserId: approver.approverUserId }), "Submitted for approval.")}>Submit for approval</Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* PB-005 */}
      <Card>
        <CardHeader>
          <CardTitle>Submission tracking</CardTitle>
          <CardDescription>Record submission proof; advances stage to Proposal and creates a follow-up (PB-005).</CardDescription>
        </CardHeader>
        <CardContent>
          {view.submission ? <p className="mb-2 text-xs text-muted-foreground">Submitted {view.submission.submittedAt} via {view.submission.mode}.</p> : null}
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleSubmission}>
              <Input type="date" aria-label="Submitted at" value={submission.submittedAt} onChange={(event) => setSubmission((c) => ({ ...c, submittedAt: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Mode (email/portal/courier)" value={submission.mode} onChange={(event) => setSubmission((c) => ({ ...c, mode: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Recipient / portal" value={submission.recipient} onChange={(event) => setSubmission((c) => ({ ...c, recipient: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Documents submitted" value={submission.documents} onChange={(event) => setSubmission((c) => ({ ...c, documents: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Acknowledgement" value={submission.acknowledgement} onChange={(event) => setSubmission((c) => ({ ...c, acknowledgement: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Remarks" value={submission.remarks} onChange={(event) => setSubmission((c) => ({ ...c, remarks: event.target.value }))} disabled={busy !== null} />
              <div className="md:col-span-2"><Button type="submit" disabled={busy !== null || !submission.submittedAt || !submission.mode.trim()}>Record submission</Button></div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
