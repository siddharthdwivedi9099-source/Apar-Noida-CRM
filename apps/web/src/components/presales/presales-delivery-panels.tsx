import { useState, type FormEvent } from "react";
import type { PresalesRequestDetail, PresalesRequestOptionsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface PresalesDeliveryPanelsProps {
  detail: PresalesRequestDetail;
  options: PresalesRequestOptionsResponse;
  accessToken: string | null;
  canEdit: boolean;
  onReload: () => void;
}

export function PresalesDeliveryPanels({ detail, options, accessToken, canEdit, onReload }: PresalesDeliveryPanelsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [triageNote, setTriageNote] = useState("");
  const [demo, setDemo] = useState({
    painPoints: detail.demoWorkspace?.painPoints ?? "",
    useCases: detail.demoWorkspace?.useCases ?? "",
    audience: detail.demoWorkspace?.audience ?? "",
    modules: detail.demoWorkspace?.modules ?? "",
    competitors: detail.demoWorkspace?.competitors ?? "",
    objections: detail.demoWorkspace?.objections ?? "",
    expectedOutcome: detail.demoWorkspace?.expectedOutcome ?? ""
  });
  const [checklist, setChecklist] = useState<string[]>(detail.demoWorkspace?.checklist ?? []);
  const [feedback, setFeedback] = useState({ attendees: "", modulesShown: "", questions: "", objections: "", positiveSignals: "", gaps: "", nextSteps: "", opportunityStageKey: "" });
  const [reviewerId, setReviewerId] = useState("");
  const [poc, setPoc] = useState({
    objective: detail.poc?.objective ?? "",
    scope: detail.poc?.scope ?? "",
    successCriteria: detail.poc?.successCriteria ?? "",
    timeline: detail.poc?.timeline ?? "",
    responsibilities: detail.poc?.responsibilities ?? "",
    demoData: detail.poc?.demoData ?? ""
  });
  const [signOff, setSignOff] = useState({ outcome: "success" as "success" | "fail", customerFeedback: "", probability: "" });

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      onReload();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const post = (path: string, body: Record<string, unknown>) => apiRequest(`/presales/${detail.id}${path}`, { method: "POST", accessToken, body });

  function toggleChecklist(key: string) {
    setChecklist((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function handleDemoSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("demo", () => post("/demo-workspace", { ...demo, checklist }), "Demo workspace saved.");
  }

  function handleFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("feedback", () => post("/demo-feedback", { ...feedback, opportunityStageKey: feedback.opportunityStageKey || null }), "Demo feedback captured.");
  }

  function handlePocSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("poc", () => post("/poc", poc), "POC plan saved.");
  }

  if (!canEdit) {
    return null;
  }

  const gapRequirements = detail.requirements.filter((requirement) => requirement.complianceStatus === "gap");

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* PS-001 triage */}
      <Card>
        <CardHeader>
          <CardTitle>Request triage</CardTitle>
          <CardDescription>Accept, reject, or request more information (PS-001).{detail.triageStatus ? ` Current: ${detail.triageStatus}.` : ""}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Note (optional)" value={triageNote} onChange={(event) => setTriageNote(event.target.value)} disabled={busy !== null} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy !== null} onClick={() => void run("triage-accept", () => post("/triage", { action: "accepted", note: triageNote || null }), "Request accepted.")}>Accept</Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("triage-info", () => post("/triage", { action: "info_requested", note: triageNote || null }), "More info requested.")}>Request info</Button>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("triage-reject", () => post("/triage", { action: "rejected", note: triageNote || null }), "Request rejected.")}>Reject</Button>
          </div>
        </CardContent>
      </Card>

      {/* PS-002 demo workspace */}
      <Card>
        <CardHeader>
          <CardTitle>Demo workspace</CardTitle>
          <CardDescription>Tailor the demo (PS-002). AI demo-flow suggestions are a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-2" onSubmit={handleDemoSave}>
            {([["painPoints", "Pain points"], ["useCases", "Use cases"], ["audience", "Audience"], ["modules", "Modules"], ["competitors", "Competitors"], ["objections", "Objections"], ["expectedOutcome", "Expected outcome"]] as const).map(([field, label]) => (
              <textarea key={field} className={textareaClassName} rows={2} placeholder={label} value={demo[field]} onChange={(event) => setDemo((c) => ({ ...c, [field]: event.target.value }))} disabled={busy !== null} />
            ))}
            <div className="flex flex-wrap gap-2">
              {options.demoChecklistItems.map((item) => (
                <label key={item.key} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={checklist.includes(item.key)} onChange={() => toggleChecklist(item.key)} disabled={busy !== null} />
                  {item.label}
                </label>
              ))}
            </div>
            <Button type="submit" disabled={busy !== null}>Save demo workspace</Button>
          </form>
        </CardContent>
      </Card>

      {/* PS-003 demo feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Demo feedback</CardTitle>
          <CardDescription>Capture customer response (PS-003). AI sentiment is a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.demoFeedback?.capturedAt ? <p className="mb-2 text-xs text-muted-foreground">Last captured by {detail.demoFeedback.capturedBy?.displayName ?? "presales"}.</p> : null}
          <form className="space-y-2" onSubmit={handleFeedback}>
            {([["attendees", "Attendees"], ["modulesShown", "Modules shown"], ["questions", "Questions"], ["objections", "Objections"], ["positiveSignals", "Positive signals"], ["gaps", "Gaps"], ["nextSteps", "Next steps"]] as const).map(([field, label]) => (
              <textarea key={field} className={textareaClassName} rows={2} placeholder={label} value={feedback[field]} onChange={(event) => setFeedback((c) => ({ ...c, [field]: event.target.value }))} disabled={busy !== null} />
            ))}
            <Input placeholder="Opportunity stage key (optional)" value={feedback.opportunityStageKey} onChange={(event) => setFeedback((c) => ({ ...c, opportunityStageKey: event.target.value }))} disabled={busy !== null} />
            <Button type="submit" disabled={busy !== null}>Capture feedback</Button>
          </form>
        </CardContent>
      </Card>

      {/* PS-004 fitment */}
      <Card>
        <CardHeader>
          <CardTitle>Solution fitment</CardTitle>
          <CardDescription>Gaps can become tasks/change requests; request sales/architect review (PS-004).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gapRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gap requirements to action.</p>
          ) : (
            gapRequirements.map((requirement) => (
              <div key={requirement.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] bg-background/75 p-2 text-sm">
                <span>{requirement.label} <Badge variant="default">gap</Badge></span>
                <span className="flex gap-2">
                  <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run(`gap-${requirement.id}`, () => post("/fitment/gap-task", { requirementId: requirement.id }), "Gap task created.")}>To task</Button>
                  <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`cr-${requirement.id}`, () => post("/fitment/gap-task", { requirementId: requirement.id, asChangeRequest: true }), "Change request created.")}>To change request</Button>
                </span>
              </div>
            ))
          )}
          <div className="flex flex-wrap items-end gap-2">
            <select className={selectClassName} value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} disabled={busy !== null}>
              <option value="">Reviewer…</option>
              {options.owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.displayName}</option>
              ))}
            </select>
            <Button type="button" disabled={busy !== null || !reviewerId} onClick={() => void run("review", () => post("/fitment/review", { reviewerId }), "Review requested.")}>Request review</Button>
          </div>
        </CardContent>
      </Card>

      {/* PS-005 POC */}
      <Card>
        <CardHeader>
          <CardTitle>POC management</CardTitle>
          <CardDescription>Plan, assign, and sign off proof-of-concept activities (PS-005).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="space-y-2" onSubmit={handlePocSave}>
            {([["objective", "Objective"], ["scope", "Scope"], ["successCriteria", "Success criteria"], ["timeline", "Timeline"], ["responsibilities", "Responsibilities"], ["demoData", "Demo data"]] as const).map(([field, label]) => (
              <textarea key={field} className={textareaClassName} rows={2} placeholder={label} value={poc[field]} onChange={(event) => setPoc((c) => ({ ...c, [field]: event.target.value }))} disabled={busy !== null} />
            ))}
            <Button type="submit" disabled={busy !== null}>Save POC plan</Button>
          </form>
          <div className="rounded-[1rem] border border-border/60 p-3">
            <p className="text-sm font-semibold">Sign-off {detail.poc?.signOff ? <Badge variant="muted">{detail.poc.signOff.outcome}</Badge> : null}</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <select className={selectClassName} value={signOff.outcome} onChange={(event) => setSignOff((c) => ({ ...c, outcome: event.target.value as "success" | "fail" }))} disabled={busy !== null}>
                <option value="success">Success</option>
                <option value="fail">Fail</option>
              </select>
              <Input placeholder="Customer feedback" value={signOff.customerFeedback} onChange={(event) => setSignOff((c) => ({ ...c, customerFeedback: event.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="New probability %" value={signOff.probability} onChange={(event) => setSignOff((c) => ({ ...c, probability: event.target.value }))} disabled={busy !== null} />
              <Button type="button" disabled={busy !== null} onClick={() => void run("signoff", () => post("/poc/sign-off", { outcome: signOff.outcome, customerFeedback: signOff.customerFeedback || null, probability: signOff.probability ? Number(signOff.probability) : null }), "POC signed off.")}>Sign off</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
