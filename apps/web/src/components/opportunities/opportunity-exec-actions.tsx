import { useEffect, useState, type FormEvent } from "react";
import type { OpportunityDetail, OpportunityOptionsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface OpportunityExecActionsProps {
  detail: OpportunityDetail;
  options: OpportunityOptionsResponse;
  accessToken: string | null;
  canEdit: boolean;
  onReload: () => Promise<void> | void;
}

export function OpportunityExecActions({ detail, options, accessToken, canEdit, onReload }: OpportunityExecActionsProps) {
  const ws = detail.execWorkspace;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rejectReason, setRejectReason] = useState("");
  const [discovery, setDiscovery] = useState<Record<string, string>>({});
  const [roleByContact, setRoleByContact] = useState<Record<string, string>>({});
  const [negotiation, setNegotiation] = useState({
    commercialAsks: "",
    legalAsks: "",
    procurementBlockers: "",
    competitorOffers: "",
    finalPrice: "",
    nextAction: ""
  });
  const [demo, setDemo] = useState({ useCase: "", presalesOwnerId: "" });
  const [proposal, setProposal] = useState({ templateKey: "", scope: "", executiveSummary: "", requireApproval: false, approverUserId: "" });
  const [discount, setDiscount] = useState({ percent: "", justification: "", approverUserId: "" });
  const [closeWon, setCloseWon] = useState({
    finalValue: "",
    contractStatus: "",
    poStatus: "",
    billingTerms: "",
    startDate: "",
    implementationScope: "",
    onboardingOwnerId: "",
    handoverNote: ""
  });
  const [closeLost, setCloseLost] = useState({ lossReasonKey: options.lossReasons[0]?.key ?? "", competitor: "", revisitDate: "" });
  const [reactivate, setReactivate] = useState({ reason: "", approverUserId: "" });

  useEffect(() => {
    setDiscovery(Object.fromEntries(ws.discovery.items.map((item) => [item.key, item.value])));
    setRoleByContact(Object.fromEntries(detail.stakeholders.map((stakeholder) => [stakeholder.id, stakeholder.roleKey ?? ""])));
    setNegotiation({
      commercialAsks: ws.negotiation.commercialAsks ?? "",
      legalAsks: ws.negotiation.legalAsks ?? "",
      procurementBlockers: ws.negotiation.procurementBlockers ?? "",
      competitorOffers: ws.negotiation.competitorOffers ?? "",
      finalPrice: ws.negotiation.finalPrice != null ? String(ws.negotiation.finalPrice) : "",
      nextAction: ws.negotiation.nextAction ?? ""
    });
    setCloseLost((current) => ({ ...current, lossReasonKey: options.lossReasons[0]?.key ?? current.lossReasonKey }));
    setMessage(null);
    setErrorMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) {
      return;
    }
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await onReload();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const call = (path: string, method: "POST" | "PATCH", body: Record<string, unknown>) =>
    apiRequest(`/opportunities/${detail.id}${path}`, { method, accessToken, body });

  function handleNegotiation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      "negotiation",
      () =>
        call("/negotiation", "PATCH", {
          commercialAsks: negotiation.commercialAsks || null,
          legalAsks: negotiation.legalAsks || null,
          procurementBlockers: negotiation.procurementBlockers || null,
          competitorOffers: negotiation.competitorOffers || null,
          finalPrice: negotiation.finalPrice ? Number(negotiation.finalPrice) : null,
          nextAction: negotiation.nextAction || null
        }),
      "Negotiation updated."
    );
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Ownership & SLA</CardTitle>
          <CardDescription>
            Acceptance: <Badge variant={ws.acceptance.status === "accepted" ? "success" : "muted"}>{ws.acceptance.status}</Badge>
            {ws.acceptance.slaStartedAt ? " • sales SLA started" : ""}
          </CardDescription>
        </CardHeader>
        {canEdit ? (
          <CardContent className="space-y-3">
            <Button type="button" disabled={busy !== null || ws.acceptance.status === "accepted"} onClick={() => void run("accept", () => call("/accept", "POST", {}), "Opportunity accepted.")}>
              Accept opportunity
            </Button>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-sm font-medium">Reject reason</span>
                <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Why is this being returned?" disabled={busy !== null} />
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || rejectReason.trim().length === 0}
                onClick={() => void run("reject", () => call("/reject", "POST", { reason: rejectReason.trim() }), "Opportunity returned to queue.")}
              >
                Reject
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discovery</CardTitle>
          <CardDescription>
            {ws.discovery.completionCount}/{ws.discovery.total} captured · required complete: {ws.discovery.requiredComplete ? "yes" : "no"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.discoveryFields.map((field) => (
            <label key={field.key} className="space-y-1">
              <span className="text-sm font-medium">
                {field.label}
                {field.required ? <span className="text-rose-600"> *</span> : null}
              </span>
              <textarea
                className={textareaClassName}
                rows={2}
                value={discovery[field.key] ?? ""}
                onChange={(event) => setDiscovery((current) => ({ ...current, [field.key]: event.target.value }))}
                disabled={!canEdit || busy !== null}
              />
            </label>
          ))}
          {canEdit ? (
            <Button type="button" onClick={() => void run("discovery", () => call("/discovery", "PATCH", { discovery }), "Discovery saved.")} disabled={busy !== null}>
              Save discovery
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stakeholder mapping</CardTitle>
          <CardDescription>
            Committee {ws.buyingCommittee.covered}/{ws.buyingCommittee.total} ({ws.buyingCommittee.score}%)
            {ws.buyingCommittee.missingRoles.length > 0 ? ` • Missing: ${ws.buyingCommittee.missingRoles.map((role) => role.label).join(", ")}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.stakeholders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add stakeholders to the opportunity to map the buying committee.</p>
          ) : (
            <>
              {detail.stakeholders.map((stakeholder) => (
                <div key={stakeholder.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[8rem] text-sm font-medium">{stakeholder.fullName}</span>
                  <select
                    className={selectClassName}
                    value={roleByContact[stakeholder.id] ?? ""}
                    onChange={(event) => setRoleByContact((current) => ({ ...current, [stakeholder.id]: event.target.value }))}
                    disabled={!canEdit || busy !== null}
                  >
                    <option value="">No role</option>
                    {options.stakeholderRoles.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      "roles",
                      () =>
                        call("/stakeholder-profiles", "PATCH", {
                          profiles: detail.stakeholders.map((stakeholder) => ({
                            contactId: stakeholder.id,
                            roleKey: roleByContact[stakeholder.id] || null
                          }))
                        }),
                      "Stakeholder roles saved."
                    )
                  }
                >
                  Save stakeholder roles
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Negotiation</CardTitle>
            <CardDescription>Track commercial, legal, and procurement asks (AE-008).</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleNegotiation}>
              {(
                [
                  ["commercialAsks", "Commercial asks"],
                  ["legalAsks", "Legal asks"],
                  ["procurementBlockers", "Procurement blockers"],
                  ["competitorOffers", "Competitor offers"],
                  ["nextAction", "Next action"]
                ] as [keyof typeof negotiation, string][]
              ).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-sm font-medium">{label}</span>
                  <Input value={negotiation[key]} onChange={(event) => setNegotiation((current) => ({ ...current, [key]: event.target.value }))} disabled={busy !== null} />
                </label>
              ))}
              <label className="space-y-1">
                <span className="text-sm font-medium">Final price</span>
                <Input type="number" min={0} value={negotiation.finalPrice} onChange={(event) => setNegotiation((current) => ({ ...current, finalPrice: event.target.value }))} disabled={busy !== null} />
              </label>
              <Button type="submit" disabled={busy !== null}>
                Save negotiation
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Presales demo</CardTitle>
            <CardDescription>
              {ws.demo ? `Status: ${ws.demo.status}` : "Request a relevant demo from presales (AE-005)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ws.demo ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 space-y-1">
                  <span className="text-sm font-medium">Demo feedback</span>
                  <Input id="demo-feedback" placeholder="Feedback updates the opportunity" disabled={busy !== null} />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => {
                    const value = (document.getElementById("demo-feedback") as HTMLInputElement | null)?.value ?? "";
                    void run("demoFeedback", () => call("/demo", "PATCH", { status: "delivered", feedback: value || null }), "Demo feedback saved.");
                  }}
                >
                  Mark delivered
                </Button>
              </div>
            ) : (
              <>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Use case</span>
                  <textarea className={textareaClassName} rows={2} value={demo.useCase} onChange={(event) => setDemo((current) => ({ ...current, useCase: event.target.value }))} disabled={busy !== null} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Presales owner</span>
                  <select className={selectClassName} value={demo.presalesOwnerId} onChange={(event) => setDemo((current) => ({ ...current, presalesOwnerId: event.target.value }))} disabled={busy !== null}>
                    <option value="">Select owner…</option>
                    {options.owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  disabled={busy !== null || demo.useCase.trim().length === 0 || demo.presalesOwnerId.length === 0}
                  onClick={() => void run("demo", () => call("/demo", "POST", { useCase: demo.useCase.trim(), presalesOwnerId: demo.presalesOwnerId }), "Demo requested.")}
                >
                  Request demo
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Proposal & discount</CardTitle>
            <CardDescription>
              Proposal: {ws.proposal ? ws.proposal.status : "none"} · Discount: {ws.discount.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
              <p className="text-sm font-semibold">Proposal</p>
              <select className={selectClassName} value={proposal.templateKey} onChange={(event) => setProposal((current) => ({ ...current, templateKey: event.target.value }))} disabled={busy !== null}>
                <option value="">Template…</option>
                {options.proposalTemplates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.label}
                  </option>
                ))}
              </select>
              <textarea className={textareaClassName} rows={2} placeholder="Executive summary" value={proposal.executiveSummary} onChange={(event) => setProposal((current) => ({ ...current, executiveSummary: event.target.value }))} disabled={busy !== null} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={proposal.requireApproval} onChange={(event) => setProposal((current) => ({ ...current, requireApproval: event.target.checked }))} disabled={busy !== null} />
                Require approval (discount / non-standard terms)
              </label>
              {proposal.requireApproval ? (
                <select className={selectClassName} value={proposal.approverUserId} onChange={(event) => setProposal((current) => ({ ...current, approverUserId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Approver…</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              ) : null}
              <Button
                type="button"
                disabled={busy !== null || (proposal.requireApproval && proposal.approverUserId.length === 0)}
                onClick={() =>
                  void run(
                    "proposal",
                    () =>
                      call("/proposal", "POST", {
                        templateKey: proposal.templateKey || null,
                        executiveSummary: proposal.executiveSummary || null,
                        requireApproval: proposal.requireApproval,
                        approverUserId: proposal.requireApproval ? proposal.approverUserId || null : null
                      }),
                    "Proposal saved."
                  )
                }
              >
                Save proposal
              </Button>
            </div>

            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
              <p className="text-sm font-semibold">Discount request</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Input type="number" min={0} max={100} placeholder="Discount %" value={discount.percent} onChange={(event) => setDiscount((current) => ({ ...current, percent: event.target.value }))} disabled={busy !== null} />
                <select className={selectClassName} value={discount.approverUserId} onChange={(event) => setDiscount((current) => ({ ...current, approverUserId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Approver…</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <Input placeholder="Justification" value={discount.justification} onChange={(event) => setDiscount((current) => ({ ...current, justification: event.target.value }))} disabled={busy !== null} />
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || discount.justification.trim().length === 0 || discount.approverUserId.length === 0 || discount.percent.length === 0}
                onClick={() => void run("discount", () => call("/discount", "POST", { percent: Number(discount.percent), justification: discount.justification.trim(), approverUserId: discount.approverUserId }), "Discount requested.")}
              >
                Request discount
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Close</CardTitle>
            <CardDescription>Close won (starts onboarding) or lost with a structured reason.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
              <p className="text-sm font-semibold">Close won</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Input type="number" min={0} placeholder="Final value" value={closeWon.finalValue} onChange={(event) => setCloseWon((current) => ({ ...current, finalValue: event.target.value }))} disabled={busy !== null} />
                <Input placeholder="Contract status" value={closeWon.contractStatus} onChange={(event) => setCloseWon((current) => ({ ...current, contractStatus: event.target.value }))} disabled={busy !== null} />
                <Input placeholder="PO / payment status" value={closeWon.poStatus} onChange={(event) => setCloseWon((current) => ({ ...current, poStatus: event.target.value }))} disabled={busy !== null} />
                <Input placeholder="Billing terms" value={closeWon.billingTerms} onChange={(event) => setCloseWon((current) => ({ ...current, billingTerms: event.target.value }))} disabled={busy !== null} />
                <Input type="date" value={closeWon.startDate} onChange={(event) => setCloseWon((current) => ({ ...current, startDate: event.target.value }))} disabled={busy !== null} />
                <select className={selectClassName} value={closeWon.onboardingOwnerId} onChange={(event) => setCloseWon((current) => ({ ...current, onboardingOwnerId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Onboarding owner (CSM)…</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <Input placeholder="Implementation scope" value={closeWon.implementationScope} onChange={(event) => setCloseWon((current) => ({ ...current, implementationScope: event.target.value }))} disabled={busy !== null} />
              <Input placeholder="Handover note" value={closeWon.handoverNote} onChange={(event) => setCloseWon((current) => ({ ...current, handoverNote: event.target.value }))} disabled={busy !== null} />
              <Button
                type="button"
                disabled={
                  busy !== null ||
                  !closeWon.finalValue ||
                  !closeWon.contractStatus ||
                  !closeWon.poStatus ||
                  !closeWon.billingTerms ||
                  !closeWon.startDate ||
                  !closeWon.implementationScope ||
                  !closeWon.onboardingOwnerId ||
                  !closeWon.handoverNote
                }
                onClick={() =>
                  void run(
                    "closeWon",
                    () =>
                      call("/close-won", "POST", {
                        finalValue: Number(closeWon.finalValue),
                        contractStatus: closeWon.contractStatus,
                        poStatus: closeWon.poStatus,
                        billingTerms: closeWon.billingTerms,
                        startDate: closeWon.startDate,
                        implementationScope: closeWon.implementationScope,
                        onboardingOwnerId: closeWon.onboardingOwnerId,
                        handoverNote: closeWon.handoverNote
                      }),
                    "Closed won — onboarding started."
                  )
                }
              >
                Close won
              </Button>
            </div>

            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
              <p className="text-sm font-semibold">Close lost</p>
              <div className="grid gap-2 md:grid-cols-2">
                <select className={selectClassName} value={closeLost.lossReasonKey} onChange={(event) => setCloseLost((current) => ({ ...current, lossReasonKey: event.target.value }))} disabled={busy !== null}>
                  {options.lossReasons.map((reason) => (
                    <option key={reason.key} value={reason.key}>
                      {reason.label}
                    </option>
                  ))}
                </select>
                <Input placeholder="Competitor" value={closeLost.competitor} onChange={(event) => setCloseLost((current) => ({ ...current, competitor: event.target.value }))} disabled={busy !== null} />
                <Input type="date" value={closeLost.revisitDate} onChange={(event) => setCloseLost((current) => ({ ...current, revisitDate: event.target.value }))} disabled={busy !== null} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null || closeLost.lossReasonKey.length === 0}
                onClick={() =>
                  void run("closeLost", () => call("/close-lost", "POST", { lossReasonKey: closeLost.lossReasonKey, competitor: closeLost.competitor || null, revisitDate: closeLost.revisitDate || null }), "Closed lost.")
                }
              >
                Close lost
              </Button>
            </div>

            {ws.closeLost ? (
              <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
                <p className="text-sm font-semibold">Reactivate (requires approval)</p>
                <Input placeholder="Reason" value={reactivate.reason} onChange={(event) => setReactivate((current) => ({ ...current, reason: event.target.value }))} disabled={busy !== null} />
                <select className={selectClassName} value={reactivate.approverUserId} onChange={(event) => setReactivate((current) => ({ ...current, approverUserId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Approver…</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null || reactivate.reason.trim().length === 0 || reactivate.approverUserId.length === 0}
                  onClick={() => void run("reactivate", () => call("/reactivate", "POST", { reason: reactivate.reason.trim(), approverUserId: reactivate.approverUserId }), "Reactivation requested.")}
                >
                  Request reactivation
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
