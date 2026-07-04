import { useEffect, useState, type FormEvent } from "react";
import type {
  BdAccountStakeholderInput,
  BdEngagementSignals,
  BdTargetAccountDetail,
  BdTargetAccountOptionsResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface BusinessDevelopmentActionsProps {
  detail: BdTargetAccountDetail;
  options: BdTargetAccountOptionsResponse;
  accessToken: string | null;
  canUpdate: boolean;
  onReload: () => Promise<void> | void;
}

const SIGNAL_FIELDS: [keyof BdEngagementSignals, string][] = [
  ["opens", "Opens"],
  ["clicks", "Clicks"],
  ["websiteVisits", "Website visits"],
  ["eventAttendance", "Event attendance"],
  ["replies", "Replies"],
  ["meetings", "Meetings"],
  ["stakeholderEngagement", "Stakeholder engagement"]
];

export function BusinessDevelopmentActions({ detail, options, accessToken, canUpdate, onReload }: BusinessDevelopmentActionsProps) {
  const [signals, setSignals] = useState<Record<string, string>>({});
  const [roleByStakeholder, setRoleByStakeholder] = useState<Record<string, string>>({});
  const [convert, setConvert] = useState({
    stageKey: options.opportunityStages[0]?.key ?? "",
    amount: "",
    expectedCloseDate: "",
    nextStep: ""
  });
  const [handoff, setHandoff] = useState({
    salesOwnerId: "",
    recommendedApproach: "",
    painPoints: "",
    requireApproval: false,
    approverUserId: ""
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextSignals: Record<string, string> = {};
    for (const [key] of SIGNAL_FIELDS) {
      nextSignals[key] = String(detail.engagement.signals[key] ?? 0);
    }
    setSignals(nextSignals);
    setRoleByStakeholder(
      Object.fromEntries(detail.stakeholders.map((stakeholder) => [stakeholder.id, stakeholder.buyerRole?.key ?? ""]))
    );
    setConvert((current) => ({ ...current, stageKey: options.opportunityStages[0]?.key ?? current.stageKey }));
    setMessage(null);
    setErrorMessage(null);
  }, [detail, options]);

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

  function patch(body: Record<string, unknown>, key: string, successMessage: string) {
    void run(
      key,
      () => apiRequest(`/business-development/${detail.id}`, { method: "PATCH", accessToken, body }),
      successMessage
    );
  }

  function saveSignals() {
    const engagementSignals: Record<string, number> = {};
    for (const [key] of SIGNAL_FIELDS) {
      engagementSignals[key] = Number(signals[key]) || 0;
    }
    patch({ engagementSignals }, "signals", "Engagement updated.");
  }

  function saveBuyerRoles() {
    const stakeholders: BdAccountStakeholderInput[] = detail.stakeholders.map((stakeholder) => ({
      contactId: stakeholder.contact?.id ?? null,
      name: stakeholder.name,
      title: stakeholder.title,
      influenceLevel: stakeholder.influenceLevel,
      relationshipStrength: stakeholder.relationshipStrength,
      isExecutive: stakeholder.isExecutive,
      buyerRoleKey: roleByStakeholder[stakeholder.id] || null,
      lastEngagementAt: stakeholder.lastEngagementAt,
      engagementNotes: stakeholder.engagementNotes
    }));
    patch({ stakeholders }, "roles", "Buyer roles updated.");
  }

  function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      "convert",
      () =>
        apiRequest(`/business-development/${detail.id}/convert`, {
          method: "POST",
          accessToken,
          body: {
            stageKey: convert.stageKey,
            amount: Number(convert.amount),
            expectedCloseDate: convert.expectedCloseDate,
            nextStep: convert.nextStep.trim()
          }
        }),
      "Converted to opportunity."
    );
  }

  function handleHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      "handoff",
      () =>
        apiRequest(`/business-development/${detail.id}/handoff`, {
          method: "POST",
          accessToken,
          body: {
            salesOwnerId: handoff.salesOwnerId,
            recommendedApproach: handoff.recommendedApproach.trim(),
            painPoints: handoff.painPoints.trim() || null,
            requireApproval: handoff.requireApproval,
            approverUserId: handoff.requireApproval ? handoff.approverUserId || null : null
          }
        }),
      "Strategic handoff submitted."
    );
  }

  const engagement = detail.engagement;
  const committee = detail.buyingCommittee;
  const sequence = detail.sequence;

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Account engagement</CardTitle>
          <CardDescription>
            Score {engagement.score} ·{" "}
            <Badge variant={engagement.band === "hot" ? "success" : "muted"}>{engagement.band}</Badge>{" "}
            {engagement.buyingSignal ? <Badge>Buying signal</Badge> : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {SIGNAL_FIELDS.map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-sm font-medium">{label}</span>
                <Input
                  type="number"
                  min={0}
                  value={signals[key] ?? "0"}
                  onChange={(event) => setSignals((current) => ({ ...current, [key]: event.target.value }))}
                  disabled={!canUpdate || busy !== null}
                />
              </label>
            ))}
          </div>
          {canUpdate ? (
            <Button type="button" onClick={saveSignals} disabled={busy !== null}>
              {busy === "signals" ? "Saving…" : "Save engagement"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buying committee</CardTitle>
          <CardDescription>
            Coverage {committee.covered}/{committee.total} ({committee.score}%)
            {committee.missingRoles.length > 0 ? ` • Missing: ${committee.missingRoles.map((role) => role.label).join(", ")}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.stakeholders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Map stakeholders first to assign buying-committee roles.</p>
          ) : (
            <>
              {detail.stakeholders.map((stakeholder) => (
                <div key={stakeholder.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[8rem] text-sm font-medium">{stakeholder.name}</span>
                  <select
                    className={selectClassName}
                    value={roleByStakeholder[stakeholder.id] ?? ""}
                    onChange={(event) =>
                      setRoleByStakeholder((current) => ({ ...current, [stakeholder.id]: event.target.value }))
                    }
                    disabled={!canUpdate || busy !== null}
                  >
                    <option value="">No role</option>
                    {options.buyerRoles.map((role) => (
                      <option key={role.key} value={role.key}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {canUpdate ? (
                <Button type="button" variant="outline" onClick={saveBuyerRoles} disabled={busy !== null}>
                  {busy === "roles" ? "Saving…" : "Save buyer roles"}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbound sequence</CardTitle>
          <CardDescription>
            {sequence.configured
              ? `${sequence.completedCount}/${sequence.totalCount} steps${sequence.paused ? " • paused" : ""}`
              : "No sequence configured for this account context."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sequence.steps.map((step) => (
            <div key={step.key} className="flex items-center justify-between gap-2 rounded-[1rem] bg-background/75 px-3 py-2 text-sm">
              <span>
                {step.label} <Badge variant="muted">{step.channel}</Badge>
              </span>
              <Badge variant={step.status === "completed" ? "success" : "muted"}>{step.status}</Badge>
            </div>
          ))}
          {sequence.nextDueAt ? (
            <p className="text-xs text-muted-foreground">Next due {formatDateTime(sequence.nextDueAt)}</p>
          ) : null}
          {canUpdate && sequence.configured ? (
            <div className="flex flex-wrap gap-2">
              {sequence.currentStep ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => patch({ sequence: { completeStepKey: sequence.currentStep?.key } }, "seq", "Sequence advanced.")}
                >
                  Complete “{sequence.currentStep.label}”
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => patch({ sequence: { logReply: true } }, "seq", "Reply logged — sequence paused.")}
              >
                Log reply
              </Button>
              {sequence.paused ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => patch({ sequence: { paused: false } }, "seq", "Sequence resumed.")}
                >
                  Resume
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canUpdate ? (
        <Card>
          <CardHeader>
            <CardTitle>Advance account</CardTitle>
            <CardDescription>Convert an engaged account to an opportunity or hand it to enterprise sales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4" onSubmit={handleConvert}>
              <p className="text-sm font-semibold">Convert to opportunity</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Stage</span>
                  <select
                    className={selectClassName}
                    value={convert.stageKey}
                    onChange={(event) => setConvert((current) => ({ ...current, stageKey: event.target.value }))}
                    disabled={busy !== null}
                  >
                    {options.opportunityStages.map((stage) => (
                      <option key={stage.id} value={stage.key}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Estimated value</span>
                  <Input
                    type="number"
                    min={0}
                    value={convert.amount}
                    onChange={(event) => setConvert((current) => ({ ...current, amount: event.target.value }))}
                    disabled={busy !== null}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Expected close date</span>
                  <Input
                    type="date"
                    value={convert.expectedCloseDate}
                    onChange={(event) => setConvert((current) => ({ ...current, expectedCloseDate: event.target.value }))}
                    disabled={busy !== null}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Next step</span>
                  <Input
                    value={convert.nextStep}
                    onChange={(event) => setConvert((current) => ({ ...current, nextStep: event.target.value }))}
                    disabled={busy !== null}
                  />
                </label>
              </div>
              <Button
                type="submit"
                disabled={
                  busy !== null ||
                  convert.stageKey.length === 0 ||
                  convert.expectedCloseDate.length === 0 ||
                  convert.nextStep.trim().length === 0 ||
                  Number.isNaN(Number(convert.amount)) ||
                  Number(convert.amount) <= 0
                }
              >
                {busy === "convert" ? "Converting…" : "Convert to opportunity"}
              </Button>
            </form>

            <form className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4" onSubmit={handleHandoff}>
              <p className="text-sm font-semibold">Strategic handoff</p>
              <label className="space-y-1">
                <span className="text-sm font-medium">Sales owner</span>
                <select
                  className={selectClassName}
                  value={handoff.salesOwnerId}
                  onChange={(event) => setHandoff((current) => ({ ...current, salesOwnerId: event.target.value }))}
                  disabled={busy !== null}
                >
                  <option value="">Select owner…</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Recommended approach</span>
                <textarea
                  className={textareaClassName}
                  value={handoff.recommendedApproach}
                  onChange={(event) => setHandoff((current) => ({ ...current, recommendedApproach: event.target.value }))}
                  disabled={busy !== null}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Pain points</span>
                <textarea
                  className={textareaClassName}
                  value={handoff.painPoints}
                  onChange={(event) => setHandoff((current) => ({ ...current, painPoints: event.target.value }))}
                  disabled={busy !== null}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={handoff.requireApproval}
                  onChange={(event) => setHandoff((current) => ({ ...current, requireApproval: event.target.checked }))}
                  disabled={busy !== null}
                />
                Require manager approval
              </label>
              {handoff.requireApproval ? (
                <label className="space-y-1">
                  <span className="text-sm font-medium">Manager approver</span>
                  <select
                    className={selectClassName}
                    value={handoff.approverUserId}
                    onChange={(event) => setHandoff((current) => ({ ...current, approverUserId: event.target.value }))}
                    disabled={busy !== null}
                  >
                    <option value="">Select approver…</option>
                    {options.owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button
                type="submit"
                disabled={
                  busy !== null ||
                  handoff.salesOwnerId.length === 0 ||
                  handoff.recommendedApproach.trim().length === 0 ||
                  (handoff.requireApproval && handoff.approverUserId.length === 0)
                }
              >
                {busy === "handoff" ? "Submitting…" : "Hand off to sales"}
              </Button>
              {detail.handoff ? (
                <p className="text-xs text-muted-foreground">
                  Current handoff: {detail.handoff.status === "handed_off" ? "Handed off" : "Pending approval"}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
