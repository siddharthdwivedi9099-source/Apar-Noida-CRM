import { useEffect, useState, type FormEvent } from "react";
import type { CrmLookupUserSummary, CsOnboardingProjectResponse, CsOnboardingProjectView, GoLiveItemStatus, HandoverField } from "@crm/types";
import { handoverFields, goLiveItemStatuses } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface CsOnboardingPanelProps {
  planId: string | null;
  owners: CrmLookupUserSummary[];
  accessToken: string | null;
  canEdit: boolean;
  onReload?: () => void;
}

const fieldLabels: Record<HandoverField, string> = {
  contract: "Contract",
  scope: "Scope",
  products: "Products",
  commitments: "Commitments",
  stakeholders: "Stakeholders",
  timeline: "Timeline",
  risks: "Risks",
  specialTerms: "Special terms",
  integrations: "Integrations",
  successCriteria: "Success criteria"
};

export function CsOnboardingPanel({ planId, owners, accessToken, canEdit, onReload }: CsOnboardingPanelProps) {
  const [project, setProject] = useState<CsOnboardingProjectView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handover, setHandover] = useState<Partial<Record<HandoverField, string>>>({});
  const [kickoff, setKickoff] = useState({ scheduledAt: "", attendees: "", decisions: "" });
  const [completion, setCompletion] = useState({ goLiveDate: "", usersTrained: "", adoptionBaseline: "", ongoingCsmId: "", initialHealthScore: "", customerSignOff: false });

  async function load() {
    if (!accessToken || !planId) {
      setProject(null);
      return;
    }
    try {
      const response = await apiRequest<CsOnboardingProjectResponse>(`/customer-success/onboarding/${planId}`, { method: "GET", accessToken });
      const p = response.project;
      setProject(p);
      const next: Partial<Record<HandoverField, string>> = {};
      for (const field of handoverFields) {
        next[field] = (p.handover.fields[field] as string | null) ?? "";
      }
      setHandover(next);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, planId]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken || !planId) return;
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      await load();
      onReload?.();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const put = (path: string, body: Record<string, unknown>) => apiRequest(`/customer-success/onboarding/${planId}${path}`, { method: "PUT", accessToken, body });
  const post = (path: string, body: Record<string, unknown>) => apiRequest(`/customer-success/onboarding/${planId}${path}`, { method: "POST", accessToken, body });

  function handleHandover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(handoverFields.map((field) => [field, handover[field]?.trim() || null]));
    void run("handover", () => put("/handover", { fields }), "Handover saved.");
  }
  function handleKickoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("kickoff", () => post("/kickoff", {
      scheduledAt: kickoff.scheduledAt || null,
      attendees: kickoff.attendees ? kickoff.attendees.split(",").map((a) => a.trim()).filter(Boolean) : [],
      decisions: kickoff.decisions || null,
      successCriteriaConfirmed: true,
      markCompleted: true
    }), "Kickoff recorded.");
  }
  function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("complete", () => post("/complete", {
      goLiveDate: completion.goLiveDate || null,
      usersTrained: completion.usersTrained ? Number(completion.usersTrained) : null,
      adoptionBaseline: completion.adoptionBaseline ? Number(completion.adoptionBaseline) : null,
      ongoingCsmId: completion.ongoingCsmId,
      initialHealthScore: Number(completion.initialHealthScore),
      customerSignOff: completion.customerSignOff
    }), "Onboarding completed — account handed to the ongoing CSM.");
  }

  if (!planId) {
    return null;
  }
  if (!project) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding project — {project.name}</CardTitle>
        <CardDescription>
          {project.implementationType ? `${project.implementationType.replace(/_/g, " ")} • ` : ""}
          Handover {project.handover.validation.complete ? "complete" : `${project.handover.validation.missingMandatory.length} mandatory field(s) missing`}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {message ? <p className="text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-rose-600">{errorMessage}</p> : null}

        {/* CSMO-001 */}
        <section className="space-y-2">
          <p className="font-medium">Sales-to-CS handover</p>
          {!project.canStart ? <Badge variant="muted" className="border-amber-200 bg-amber-100 text-amber-700">Onboarding cannot start until mandatory fields are complete</Badge> : null}
          {canEdit ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleHandover}>
              {handoverFields.map((field) => (
                <textarea
                  key={field}
                  className={textareaClassName}
                  rows={2}
                  placeholder={fieldLabels[field]}
                  value={handover[field] ?? ""}
                  onChange={(e) => setHandover((c) => ({ ...c, [field]: e.target.value }))}
                  disabled={busy !== null}
                />
              ))}
              <div className="md:col-span-2"><Button type="submit" disabled={busy !== null}>Save handover</Button></div>
            </form>
          ) : null}
        </section>

        {/* CSMO-003 */}
        <section className="space-y-2 border-t border-border/50 pt-4">
          <p className="font-medium">Kickoff {project.kickoff.completedAt ? "(completed)" : ""}</p>
          <div className="rounded-[1rem] bg-background/75 p-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Suggested agenda</p>
            <ul className="mt-1 space-y-0.5">{project.kickoff.agenda.map((item) => <li key={item} className="text-xs text-muted-foreground">• {item}</li>)}</ul>
          </div>
          {canEdit ? (
            <form className="grid gap-2 md:grid-cols-3" onSubmit={handleKickoff}>
              <Input type="date" aria-label="Kickoff date" value={kickoff.scheduledAt} onChange={(e) => setKickoff((c) => ({ ...c, scheduledAt: e.target.value }))} disabled={busy !== null || !project.canStart} />
              <Input placeholder="Attendees (comma separated)" value={kickoff.attendees} onChange={(e) => setKickoff((c) => ({ ...c, attendees: e.target.value }))} disabled={busy !== null || !project.canStart} />
              <Input placeholder="Decisions" value={kickoff.decisions} onChange={(e) => setKickoff((c) => ({ ...c, decisions: e.target.value }))} disabled={busy !== null || !project.canStart} />
              <div className="md:col-span-3"><Button type="submit" disabled={busy !== null || !project.canStart}>Record kickoff &amp; confirm success criteria</Button></div>
            </form>
          ) : null}
        </section>

        {/* CSMO-004 */}
        <section className="space-y-2 border-t border-border/50 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Go-live readiness</p>
            <Badge variant="muted">{project.goLive.readiness.score}% ready</Badge>
            {project.goLive.readiness.criticalPending.length > 0 ? <Badge variant="muted" className="border-rose-200 bg-rose-100 text-rose-700">{project.goLive.readiness.criticalPending.length} critical pending</Badge> : null}
            {project.goLive.completedAt ? <Badge variant="success">Go-live complete</Badge> : null}
          </div>
          <ul className="space-y-1">
            {project.goLive.items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[12rem]">{item.label}{item.critical ? " *" : ""}</span>
                {canEdit ? (
                  <select
                    className={selectClassName}
                    value={item.status}
                    aria-label={`${item.label} status`}
                    onChange={(e) => void run(`gl-${item.key}`, () => put("/go-live-checklist", { items: { [item.key]: e.target.value as GoLiveItemStatus } }), "Checklist updated.")}
                    disabled={busy !== null}
                  >
                    {goLiveItemStatuses.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                  </select>
                ) : <Badge variant="muted">{item.status}</Badge>}
              </li>
            ))}
          </ul>
          {canEdit && !project.goLive.completedAt ? (
            <GoLiveCompleteForm disabled={busy !== null || !project.goLive.readiness.canComplete} onSubmit={(date) => void run("golive", () => post("/go-live", { goLiveDate: date }), "Go-live completed.")} />
          ) : null}
        </section>

        {/* CSMO-005 */}
        <section className="space-y-2 border-t border-border/50 pt-4">
          <p className="font-medium">Onboarding completion {project.completion ? "(done)" : ""}</p>
          {project.completion ? (
            <p className="text-xs text-muted-foreground">
              Went live {project.completion.goLiveDate ?? "—"} • {project.completion.usersTrained ?? "—"} trained • health {project.completion.initialHealthScore ?? "—"} • ongoing CSM {project.completion.ongoingCsm?.displayName ?? "—"}
            </p>
          ) : canEdit ? (
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleComplete}>
              <Input type="date" aria-label="Go-live date" value={completion.goLiveDate} onChange={(e) => setCompletion((c) => ({ ...c, goLiveDate: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={0} placeholder="Users trained" value={completion.usersTrained} onChange={(e) => setCompletion((c) => ({ ...c, usersTrained: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={0} max={100} placeholder="Adoption baseline" value={completion.adoptionBaseline} onChange={(e) => setCompletion((c) => ({ ...c, adoptionBaseline: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={0} max={100} placeholder="Initial health score" value={completion.initialHealthScore} onChange={(e) => setCompletion((c) => ({ ...c, initialHealthScore: e.target.value }))} disabled={busy !== null} required />
              <select className={selectClassName} value={completion.ongoingCsmId} onChange={(e) => setCompletion((c) => ({ ...c, ongoingCsmId: e.target.value }))} disabled={busy !== null} required aria-label="Ongoing CSM">
                <option value="">Ongoing CSM…</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.displayName}</option>)}
              </select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={completion.customerSignOff} onChange={(e) => setCompletion((c) => ({ ...c, customerSignOff: e.target.checked }))} disabled={busy !== null} /> Customer sign-off</label>
              <div className="md:col-span-2"><Button type="submit" disabled={busy !== null || !completion.ongoingCsmId || !completion.initialHealthScore}>Complete onboarding</Button></div>
            </form>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

function GoLiveCompleteForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (date: string) => void }) {
  const [date, setDate] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (date) onSubmit(date);
      }}
    >
      <Input type="date" aria-label="Go-live date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
      <Button type="submit" variant="outline" disabled={disabled || !date} title={disabled ? "Resolve critical checklist items first" : undefined}>Complete go-live</Button>
    </form>
  );
}
