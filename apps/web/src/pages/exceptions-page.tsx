import { useEffect, useState } from "react";
import type { DuplicateWarningResponse, MarginAssessmentResponse, StakeholderEngagementResponse } from "@crm/types";
import { CrmHero } from "@/components/crm/crm-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function ExceptionsPage() {
  const { accessToken } = useAuth();
  const [leadId, setLeadId] = useState("");
  const [oppId, setOppId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dupes, setDupes] = useState<DuplicateWarningResponse | null>(null);
  const [margin, setMargin] = useState<MarginAssessmentResponse | null>(null);
  const [groups, setGroups] = useState<StakeholderEngagementResponse | null>(null);
  const [recycle, setRecycle] = useState({ action: "nurture", reason: "" });
  const [regress, setRegress] = useState({ toStageKey: "qualification", reason: "" });
  const [marginForm, setMarginForm] = useState({ listPrice: "10000", cost: "6000", discountPct: "20" });
  const [complaint, setComplaint] = useState({ subject: "", severity: "high" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) apiRequest<StakeholderEngagementResponse>("/exceptions/stakeholder-engagement", { accessToken }).then(setGroups).catch(() => undefined);
  }, [accessToken]);

  async function run(key: string, action: () => Promise<unknown>, ok: string) {
    if (!accessToken) return;
    setBusy(key); setMessage(null); setErrorMessage(null);
    try { await action(); setMessage(ok); }
    catch (error) { setErrorMessage(getErrorMessage(error)); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <CrmHero eyebrow="Edge Cases" title="Exception handling" summary="Duplicate leads, existing-customer routing, recycling, stage regression, complaints, conflicts, and margin risk." />
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader><CardTitle>Lead exceptions</CardTitle><CardDescription>EXC-001 duplicate detection, EXC-002 existing-customer routing, EXC-004 recycling.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Input placeholder="Lead ID" className="w-80" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !leadId} onClick={() => void run("dupes", async () => setDupes(await apiRequest<DuplicateWarningResponse>(`/exceptions/leads/${leadId.trim()}/duplicates`, { accessToken })), "Duplicate check done.")}>Check duplicates</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !leadId} onClick={() => void run("route", () => apiRequest(`/exceptions/leads/${leadId.trim()}/route-existing-customer`, { method: "POST", accessToken, body: {} }), "Routed if an existing customer matched.")}>Route existing customer</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !leadId} onClick={() => void run("exp", () => apiRequest(`/exceptions/leads/${leadId.trim()}/expansion-opportunity`, { method: "POST", accessToken, body: {} }), "Expansion opportunity created.")}>Create expansion</Button>
          </div>
          {dupes ? (
            <div className="rounded-[1rem] border border-amber-200 bg-amber-50 p-2">
              {dupes.duplicates.length ? dupes.duplicates.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="muted" className="border-amber-200 bg-amber-100 text-amber-700">duplicate: {d.reason}</Badge>
                  <span>{d.companyName} · {d.email}</span>
                  <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`link-${d.id}`, () => apiRequest(`/exceptions/leads/${leadId.trim()}/link-duplicate`, { method: "POST", accessToken, body: { existingLeadId: d.id, campaign: "current" } }), "Linked + campaign touch added to existing record.")}>Link + add touch</Button>
                </div>
              )) : <p className="text-xs text-muted-foreground">No duplicates found.</p>}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
            <select className={selectClassName} value={recycle.action} onChange={(e) => setRecycle((c) => ({ ...c, action: e.target.value }))} aria-label="Recycle action">
              {["extend", "nurture", "disqualify", "reassign"].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Input placeholder="Reason (required)" className="w-64" value={recycle.reason} onChange={(e) => setRecycle((c) => ({ ...c, reason: e.target.value }))} />
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !leadId || !recycle.reason} onClick={() => void run("recycle", () => apiRequest(`/exceptions/leads/${leadId.trim()}/recycle`, { method: "POST", accessToken, body: recycle }), "Lead recycled.")}>Recycle lead</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Opportunity exceptions</CardTitle><CardDescription>EXC-005 stage regression, EXC-007 complaint, EXC-009 margin risk.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Input placeholder="Opportunity ID" className="w-80" value={oppId} onChange={(e) => setOppId(e.target.value)} />
          <div className="flex flex-wrap items-end gap-2">
            <select className={selectClassName} value={regress.toStageKey} onChange={(e) => setRegress((c) => ({ ...c, toStageKey: e.target.value }))} aria-label="Regress to stage">
              {["discovery", "qualification", "proposal", "negotiation"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input placeholder="Reason (required)" className="w-56" value={regress.reason} onChange={(e) => setRegress((c) => ({ ...c, reason: e.target.value }))} />
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !oppId || !regress.reason} onClick={() => void run("regress", () => apiRequest(`/exceptions/opportunities/${oppId.trim()}/regress-stage`, { method: "POST", accessToken, body: regress }), "Stage regression processed (late-stage needs approval).")}>Regress stage</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Complaint subject" className="w-64" value={complaint.subject} onChange={(e) => setComplaint((c) => ({ ...c, subject: e.target.value }))} />
            <select className={selectClassName} value={complaint.severity} onChange={(e) => setComplaint((c) => ({ ...c, severity: e.target.value }))} aria-label="Severity">
              {["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !oppId || !complaint.subject} onClick={() => void run("complaint", () => apiRequest("/exceptions/complaints", { method: "POST", accessToken, body: { entityType: "opportunity", entityId: oppId.trim(), subject: complaint.subject, severity: complaint.severity } }), "Complaint logged as a ticket; opportunity risk raised.")}>Log complaint</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
            <Input type="number" placeholder="List price" className="w-28" value={marginForm.listPrice} onChange={(e) => setMarginForm((c) => ({ ...c, listPrice: e.target.value }))} />
            <Input type="number" placeholder="Cost" className="w-24" value={marginForm.cost} onChange={(e) => setMarginForm((c) => ({ ...c, cost: e.target.value }))} />
            <Input type="number" placeholder="Discount %" className="w-24" value={marginForm.discountPct} onChange={(e) => setMarginForm((c) => ({ ...c, discountPct: e.target.value }))} />
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !oppId} onClick={() => void run("margin", async () => setMargin(await apiRequest<MarginAssessmentResponse>(`/exceptions/opportunities/${oppId.trim()}/assess-margin`, { method: "POST", accessToken, body: { listPrice: Number(marginForm.listPrice), cost: Number(marginForm.cost), discountPct: Number(marginForm.discountPct) } })), "Margin assessed.")}>Assess margin</Button>
            {margin?.assessment.requiresSeniorApproval ? <Button type="button" size="sm" disabled={busy !== null} onClick={() => void run("approvem", () => apiRequest(`/exceptions/opportunities/${oppId.trim()}/approve-margin`, { method: "POST", accessToken, body: {} }), "Margin approved; deal can now close.")}>Approve margin</Button> : null}
          </div>
          {margin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className={margin.assessment.riskLevel === "high_risk" ? "border-rose-200 bg-rose-100 text-rose-700" : margin.assessment.riskLevel === "watch" ? "border-amber-200 bg-amber-100 text-amber-700" : "border-emerald-200 bg-emerald-100 text-emerald-700"}>margin {margin.assessment.marginPct}% · {margin.assessment.riskLevel}</Badge>
              <span className="text-xs text-muted-foreground">{margin.message}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account conflict (EXC-008)</CardTitle><CardDescription>Detect partner/direct selling conflicts and record the ownership decision.</CardDescription></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <Input placeholder="Account ID" className="w-80" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
            <Button type="button" size="sm" variant="outline" disabled={busy !== null || !accountId} onClick={() => void run("conflict", async () => { const r = await apiRequest<{ hasConflict: boolean; partnerRegistrations: unknown[] }>(`/exceptions/accounts/${accountId.trim()}/conflict`, { accessToken }); setMessage(r.hasConflict ? `Conflict: direct owner + ${r.partnerRegistrations.length} partner registration(s).` : "No conflict."); }, "Conflict checked.")}>Check conflict</Button>
            {["direct", "partner"].map((d) => <Button key={d} type="button" size="sm" variant="ghost" disabled={busy !== null || !accountId} onClick={() => void run(`res-${d}`, () => apiRequest(`/exceptions/accounts/${accountId.trim()}/conflict/resolve`, { method: "POST", accessToken, body: { decision: d } }), `Ownership awarded to ${d}.`)}>Award {d}</Button>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Multi-stakeholder accounts (EXC-003)</CardTitle><CardDescription>Organizations with multiple engaged stakeholders.</CardDescription></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {groups?.groups.length ? groups.groups.slice(0, 8).map((g) => (
            <div key={g.organization} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{g.organization}</span>
              <Badge variant="muted">{g.stakeholderCount} stakeholders</Badge>
              <Badge variant="muted">engagement {g.totalEngagement}</Badge>
              <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run(`alert-${g.organization}`, () => apiRequest(`/exceptions/stakeholder-engagement/${encodeURIComponent(g.organization)}/alert`, { method: "POST", accessToken, body: {} }), "Owner alerted.")}>Alert owner</Button>
            </div>
          )) : <p className="text-muted-foreground">No multi-stakeholder organizations detected.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
