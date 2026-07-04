import { useEffect, useState, type FormEvent } from "react";
import type {
  ConvertLeadRequestBody,
  LeadResearchConfidence,
  LeadStrategicValue,
  SalesWorkspaceLeadSummary,
  SalesWorkspaceOptionsResponse,
  UpdateLeadWorkspaceRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface LeadSdrPanelsProps {
  lead: SalesWorkspaceLeadSummary;
  options: SalesWorkspaceOptionsResponse;
  canUpdate: boolean;
  canConvert: boolean;
  onPatch: (payload: UpdateLeadWorkspaceRequestBody) => Promise<void>;
  onMarkNoShow: () => Promise<void>;
  onConvert: (payload: ConvertLeadRequestBody) => Promise<void>;
}

interface ResearchDraft {
  companyProfile: string;
  industry: string;
  size: string;
  leadership: string;
  locations: string;
  likelyNeeds: string;
  recentSignals: string;
  talkingPoints: string;
  sources: string;
  confidence: "" | LeadResearchConfidence;
}

interface IcpDraft {
  industry: string;
  segment: string;
  size: string;
  geography: string;
  useCase: string;
  budget: string;
  strategicValue: "" | LeadStrategicValue;
}

interface ConvertDraft {
  opportunityName: string;
  stageKey: string;
  amount: string;
  expectedCloseDate: string;
  nextStep: string;
}

function getResearchDraft(lead: SalesWorkspaceLeadSummary): ResearchDraft {
  const r = lead.workspace.research;
  return {
    companyProfile: r.companyProfile ?? "",
    industry: r.industry ?? "",
    size: r.size ?? "",
    leadership: r.leadership ?? "",
    locations: r.locations ?? "",
    likelyNeeds: r.likelyNeeds ?? "",
    recentSignals: r.recentSignals ?? "",
    talkingPoints: r.talkingPoints ?? "",
    sources: r.sources.join(", "),
    confidence: r.confidence ?? ""
  };
}

function getIcpDraft(lead: SalesWorkspaceLeadSummary): IcpDraft {
  const a = lead.workspace.icpFit.attributes;
  return {
    industry: a.industry ?? "",
    segment: a.segment ?? "",
    size: a.size ?? "",
    geography: a.geography ?? "",
    useCase: a.useCase ?? "",
    budget: a.budget ?? "",
    strategicValue: a.strategicValue ?? ""
  };
}

function getDiscoveryDraft(lead: SalesWorkspaceLeadSummary): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const item of lead.workspace.discovery.items) {
    draft[item.key] = item.value;
  }
  return draft;
}

function getConvertDraft(lead: SalesWorkspaceLeadSummary, options: SalesWorkspaceOptionsResponse): ConvertDraft {
  return {
    opportunityName: `${lead.companyName} — ${lead.fullName}`.trim(),
    stageKey: options.opportunityStages[0]?.key ?? "",
    amount: "",
    expectedCloseDate: "",
    nextStep: lead.workspace.qualificationNotes ?? ""
  };
}

function getFitBadgeVariant(band: SalesWorkspaceLeadSummary["workspace"]["icpFit"]["band"]) {
  return band === "high" ? "success" : "muted";
}

export function LeadSdrPanels({ lead, options, canUpdate, canConvert, onPatch, onMarkNoShow, onConvert }: LeadSdrPanelsProps) {
  const [research, setResearch] = useState<ResearchDraft>(getResearchDraft(lead));
  const [icp, setIcp] = useState<IcpDraft>(getIcpDraft(lead));
  const [discovery, setDiscovery] = useState<Record<string, string>>(getDiscoveryDraft(lead));
  const [objectionTypeKey, setObjectionTypeKey] = useState<string>(options.objectionTypes[0]?.key ?? "");
  const [objectionNote, setObjectionNote] = useState("");
  const [convert, setConvert] = useState<ConvertDraft>(getConvertDraft(lead, options));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setResearch(getResearchDraft(lead));
    setIcp(getIcpDraft(lead));
    setDiscovery(getDiscoveryDraft(lead));
    setObjectionTypeKey(options.objectionTypes[0]?.key ?? "");
    setObjectionNote("");
    setConvert(getConvertDraft(lead, options));
    setMessage(null);
    setErrorMessage(null);
  }, [lead, options]);

  async function run(key: string, action: () => Promise<void>, successMessage: string) {
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function saveResearch() {
    void run(
      "research",
      () =>
        onPatch({
          research: {
            companyProfile: research.companyProfile.trim() || null,
            industry: research.industry.trim() || null,
            size: research.size.trim() || null,
            leadership: research.leadership.trim() || null,
            locations: research.locations.trim() || null,
            likelyNeeds: research.likelyNeeds.trim() || null,
            recentSignals: research.recentSignals.trim() || null,
            talkingPoints: research.talkingPoints.trim() || null,
            sources: research.sources
              .split(",")
              .map((value) => value.trim())
              .filter((value) => value.length > 0),
            confidence: research.confidence || null
          }
        }),
      "Account research saved."
    );
  }

  function saveIcp() {
    void run(
      "icp",
      () =>
        onPatch({
          icpAttributes: {
            industry: icp.industry.trim() || null,
            segment: icp.segment.trim() || null,
            size: icp.size.trim() || null,
            geography: icp.geography.trim() || null,
            useCase: icp.useCase.trim() || null,
            budget: icp.budget.trim() || null,
            strategicValue: icp.strategicValue || null
          }
        }),
      "ICP attributes saved."
    );
  }

  function saveDiscovery() {
    void run("discovery", () => onPatch({ discovery }), "Discovery saved.");
  }

  function addObjection() {
    if (!objectionTypeKey) {
      return;
    }
    void run(
      "objection",
      async () => {
        await onPatch({ addObjection: { typeKey: objectionTypeKey, note: objectionNote.trim() || null } });
        setObjectionNote("");
      },
      "Objection captured."
    );
  }

  function removeObjection(id: string) {
    void run("objection", () => onPatch({ removeObjectionId: id }), "Objection removed.");
  }

  function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(
      "convert",
      () =>
        onConvert({
          opportunityName: convert.opportunityName.trim() || null,
          stageKey: convert.stageKey,
          amount: Number(convert.amount),
          expectedCloseDate: convert.expectedCloseDate ? new Date(convert.expectedCloseDate).toISOString() : "",
          nextStep: convert.nextStep.trim()
        }),
      "Lead converted to opportunity."
    );
  }

  const icpFit = lead.workspace.icpFit;
  const discoveryView = lead.workspace.discovery;

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Account research</CardTitle>
          <CardDescription>
            Capture company profile, signals, and talking points before outreach. AI generation connects with the AI
            Gateway; saved insights, sources, and confidence are live now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {research.confidence ? <Badge variant="muted">Confidence: {research.confidence}</Badge> : null}
            {lead.workspace.research.savedAt ? (
              <Badge variant="muted">Saved {formatDateTime(lead.workspace.research.savedAt)}</Badge>
            ) : null}
          </div>
          {(
            [
              ["companyProfile", "Company profile"],
              ["industry", "Industry"],
              ["size", "Size"],
              ["leadership", "Leadership"],
              ["locations", "Locations"],
              ["likelyNeeds", "Likely needs"],
              ["recentSignals", "Recent signals"],
              ["talkingPoints", "Talking points"]
            ] as [keyof ResearchDraft, string][]
          ).map(([key, label]) => (
            <label key={key} className="space-y-1">
              <span className="text-sm font-medium">{label}</span>
              <textarea
                className={textareaClassName}
                rows={2}
                value={research[key] as string}
                onChange={(event) => setResearch((current) => ({ ...current, [key]: event.target.value }))}
                disabled={!canUpdate || busy !== null}
              />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm font-medium">Sources (comma-separated)</span>
            <Input
              value={research.sources}
              onChange={(event) => setResearch((current) => ({ ...current, sources: event.target.value }))}
              placeholder="https://…, LinkedIn, 10-K"
              disabled={!canUpdate || busy !== null}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Confidence</span>
            <select
              className={selectClassName}
              value={research.confidence}
              onChange={(event) =>
                setResearch((current) => ({ ...current, confidence: event.target.value as ResearchDraft["confidence"] }))
              }
              disabled={!canUpdate || busy !== null}
            >
              <option value="">Not set</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          {canUpdate ? (
            <Button type="button" onClick={saveResearch} disabled={busy !== null}>
              {busy === "research" ? "Saving…" : "Save research"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ICP fit</CardTitle>
          <CardDescription>
            Fit is scored from the captured profile against the tenant&apos;s configurable ICP criteria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getFitBadgeVariant(icpFit.band)}>{icpFit.band.toUpperCase()} fit</Badge>
            <Badge variant="muted">Score {icpFit.score}</Badge>
          </div>
          <div className="rounded-[1rem] bg-background/75 p-3 text-xs leading-6 text-muted-foreground">
            {icpFit.explanation.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between gap-2">
                <span>{entry.label}</span>
                <span>{entry.satisfied ? `+${entry.contribution}` : "—"}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["industry", "Industry"],
                ["segment", "Segment"],
                ["size", "Size"],
                ["geography", "Geography"],
                ["useCase", "Use case"],
                ["budget", "Budget"]
              ] as [keyof IcpDraft, string][]
            ).map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-sm font-medium">{label}</span>
                <Input
                  value={icp[key] as string}
                  onChange={(event) => setIcp((current) => ({ ...current, [key]: event.target.value }))}
                  disabled={!canUpdate || busy !== null}
                />
              </label>
            ))}
            <label className="space-y-1">
              <span className="text-sm font-medium">Strategic value</span>
              <select
                className={selectClassName}
                value={icp.strategicValue}
                onChange={(event) =>
                  setIcp((current) => ({ ...current, strategicValue: event.target.value as IcpDraft["strategicValue"] }))
                }
                disabled={!canUpdate || busy !== null}
              >
                <option value="">Not set</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
          </div>
          {canUpdate ? (
            <Button type="button" onClick={saveIcp} disabled={busy !== null}>
              {busy === "icp" ? "Saving…" : "Save ICP"}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discovery call</CardTitle>
          <CardDescription>
            Configurable discovery fields. Required (<span className="text-rose-600">*</span>) fields must be captured
            before conversion ({discoveryView.completionCount}/{discoveryView.total} captured).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.discoveryFields.length === 0 ? (
            <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              No discovery fields configured for this tenant.
            </div>
          ) : (
            <>
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
                    disabled={!canUpdate || busy !== null}
                  />
                </label>
              ))}
              {canUpdate ? (
                <Button type="button" onClick={saveDiscovery} disabled={busy !== null}>
                  {busy === "discovery" ? "Saving…" : "Save discovery"}
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objections</CardTitle>
          <CardDescription>Capture objections to strengthen future conversations and surface trends.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lead.workspace.objections.length === 0 ? (
            <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              No objections captured yet.
            </div>
          ) : (
            lead.workspace.objections.map((objection) => (
              <div key={objection.id} className="rounded-[1rem] bg-background/75 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="muted">{objection.typeLabel ?? objection.typeKey}</Badge>
                  {canUpdate ? (
                    <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => removeObjection(objection.id)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                {objection.note ? <p className="mt-2 text-sm leading-6">{objection.note}</p> : null}
              </div>
            ))
          )}
          {canUpdate ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="text-sm font-medium">Type</span>
                <select
                  className={selectClassName}
                  value={objectionTypeKey}
                  onChange={(event) => setObjectionTypeKey(event.target.value)}
                  disabled={busy !== null}
                >
                  {options.objectionTypes.map((type) => (
                    <option key={type.key} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 space-y-1">
                <span className="text-sm font-medium">Note</span>
                <Input
                  value={objectionNote}
                  onChange={(event) => setObjectionNote(event.target.value)}
                  placeholder="Context (optional)"
                  disabled={busy !== null}
                />
              </label>
              <Button type="button" variant="outline" onClick={addObjection} disabled={busy !== null || !objectionTypeKey}>
                Add
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advance lead</CardTitle>
          <CardDescription>
            Mark a missed meeting as a no-show ({lead.workspace.noShowCount} so far) or convert the lead into an
            opportunity once discovery + qualification are complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canUpdate ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void run("noShow", onMarkNoShow, "Marked as no-show.")}
              disabled={busy !== null}
            >
              {busy === "noShow" ? "Saving…" : "Mark no-show"}
            </Button>
          ) : null}

          {canConvert ? (
            <form className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4" onSubmit={handleConvert}>
              <p className="text-sm font-semibold">Convert to opportunity</p>
              <label className="space-y-1">
                <span className="text-sm font-medium">Opportunity name</span>
                <Input
                  value={convert.opportunityName}
                  onChange={(event) => setConvert((current) => ({ ...current, opportunityName: event.target.value }))}
                  disabled={busy !== null}
                />
              </label>
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
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
