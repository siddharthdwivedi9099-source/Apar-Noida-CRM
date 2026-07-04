import { useState, type FormEvent } from "react";
import type { CrmLookupUserSummary, CsRenewalStrategyResponse, RiskSeverity, StrategicRiskType, SuccessPlanSection } from "@crm/types";
import { riskSeverities, strategicRiskTypes, successPlanSections } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface CsEnterprisePanelProps {
  csAccountId: string | null;
  owners: CrmLookupUserSummary[];
  accessToken: string | null;
  canEdit: boolean;
  onReload?: () => void;
}

const sectionLabels: Record<SuccessPlanSection, string> = {
  objectives: "Objectives",
  stakeholders: "Stakeholders",
  successMetrics: "Success metrics",
  adoptionRoadmap: "Adoption roadmap",
  milestones: "Milestones",
  risks: "Risks",
  renewalDate: "Renewal date",
  expansionOpportunities: "Expansion opportunities"
};

export function CsEnterprisePanel({ csAccountId, owners, accessToken, canEdit, onReload }: CsEnterprisePanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<CsRenewalStrategyResponse["prediction"] | null>(null);

  const [plan, setPlan] = useState<Record<string, string>>({});
  const [qbr, setQbr] = useState({ title: "", qbrType: "qbr", scheduledDate: "" });
  const [risk, setRisk] = useState({ riskType: "low_adoption", severity: "medium", ownerId: "", mitigationPlan: "" });
  const [renewal, setRenewal] = useState({ renewalDate: "", commercialTerms: "", salesOwnerId: "", healthScore: "", usageScore: "", valueDelivered: "" });
  const [advocacy, setAdvocacy] = useState({ healthScore: "", nps: "", adoptionScore: "", executiveRelationship: "", requestType: "reference_call" });

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken || !csAccountId) return;
    setBusy(key);
    setMessage(null);
    setErrorMessage(null);
    try {
      await action();
      onReload?.();
      setMessage(successMessage);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const acc = (path: string) => `/customer-success/accounts/${csAccountId}/enterprise${path}`;

  function handlePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sections = Object.fromEntries(successPlanSections.map((s) => [s, plan[s]?.trim() || null]));
    void run("plan", () => apiRequest(acc("/success-plan"), { method: "PUT", accessToken, body: { sections, reviewWithCustomer: false } }), "Success plan saved.");
  }
  function handleRenewal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("renewal", async () => {
      const response = await apiRequest<CsRenewalStrategyResponse>(acc("/renewal-strategy"), {
        method: "POST",
        accessToken,
        body: {
          renewalDate: renewal.renewalDate,
          commercialTerms: renewal.commercialTerms || null,
          salesOwnerId: renewal.salesOwnerId || null,
          factors: { healthScore: renewal.healthScore ? Number(renewal.healthScore) : null, usageScore: renewal.usageScore ? Number(renewal.usageScore) : null, valueDelivered: renewal.valueDelivered ? Number(renewal.valueDelivered) : null }
        }
      });
      setPrediction(response.prediction);
    }, "Renewal strategy saved.");
  }

  if (!csAccountId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enterprise customer success</CardTitle>
        <CardDescription>Strategic success plan, executive reviews, risk management, renewal strategy, and advocacy. AI suggestions are governed placeholders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {message ? <p className="text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-rose-600">{errorMessage}</p> : null}

        {/* CSME-001 */}
        {canEdit ? (
          <form className="space-y-2" onSubmit={handlePlan}>
            <p className="font-medium">Success plan</p>
            <div className="grid gap-2 md:grid-cols-2">
              {successPlanSections.map((s) => (
                <textarea key={s} className={textareaClassName} rows={2} placeholder={sectionLabels[s]} value={plan[s] ?? ""} onChange={(e) => setPlan((c) => ({ ...c, [s]: e.target.value }))} disabled={busy !== null} />
              ))}
            </div>
            <Button type="submit" disabled={busy !== null}>Save success plan</Button>
          </form>
        ) : null}

        {/* CSME-002 */}
        {canEdit ? (
          <section className="space-y-2 border-t border-border/50 pt-4">
            <p className="font-medium">Executive business review</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Review title" className="w-52" value={qbr.title} onChange={(e) => setQbr((c) => ({ ...c, title: e.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={qbr.qbrType} onChange={(e) => setQbr((c) => ({ ...c, qbrType: e.target.value }))} disabled={busy !== null} aria-label="Review type">
                <option value="qbr">QBR</option><option value="ebr">EBR</option>
              </select>
              <Input type="date" aria-label="Review date" value={qbr.scheduledDate} onChange={(e) => setQbr((c) => ({ ...c, scheduledDate: e.target.value }))} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !qbr.title || !qbr.scheduledDate} onClick={() => void run("qbr", () => apiRequest(acc("/qbrs"), { method: "POST", accessToken, body: { title: qbr.title, qbrType: qbr.qbrType, scheduledDate: qbr.scheduledDate } }), "Review scheduled.")}>Schedule review</Button>
            </div>
          </section>
        ) : null}

        {/* CSME-003 */}
        {canEdit ? (
          <section className="space-y-2 border-t border-border/50 pt-4">
            <p className="font-medium">Strategic risk</p>
            <div className="grid gap-2 md:grid-cols-2">
              <select className={selectClassName} value={risk.riskType} onChange={(e) => setRisk((c) => ({ ...c, riskType: e.target.value }))} disabled={busy !== null} aria-label="Risk type">
                {strategicRiskTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
              <select className={selectClassName} value={risk.severity} onChange={(e) => setRisk((c) => ({ ...c, severity: e.target.value }))} disabled={busy !== null} aria-label="Risk severity">
                {riskSeverities.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className={selectClassName} value={risk.ownerId} onChange={(e) => setRisk((c) => ({ ...c, ownerId: e.target.value }))} disabled={busy !== null} aria-label="Risk owner">
                <option value="">Risk owner (required)…</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
              </select>
              <Input placeholder="Mitigation plan (required)" value={risk.mitigationPlan} onChange={(e) => setRisk((c) => ({ ...c, mitigationPlan: e.target.value }))} disabled={busy !== null} />
            </div>
            <Button type="button" variant="outline" disabled={busy !== null || !risk.ownerId || !risk.mitigationPlan} onClick={() => void run("risk", () => apiRequest(acc("/risks"), { method: "POST", accessToken, body: { riskType: risk.riskType as StrategicRiskType, severity: risk.severity as RiskSeverity, ownerId: risk.ownerId, mitigationPlan: risk.mitigationPlan } }), "Strategic risk recorded (leadership notified when high/critical).")}>Record risk</Button>
          </section>
        ) : null}

        {/* CSME-004 */}
        {canEdit ? (
          <form className="space-y-2 border-t border-border/50 pt-4" onSubmit={handleRenewal}>
            <p className="font-medium">Renewal strategy {prediction ? <Badge variant="muted">{prediction.probability}% · {prediction.band}</Badge> : null}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input type="date" aria-label="Renewal date" value={renewal.renewalDate} onChange={(e) => setRenewal((c) => ({ ...c, renewalDate: e.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={renewal.salesOwnerId} onChange={(e) => setRenewal((c) => ({ ...c, salesOwnerId: e.target.value }))} disabled={busy !== null} aria-label="Sales owner">
                <option value="">Sales collaborator…</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
              </select>
              <Input type="number" min={0} max={100} placeholder="Health" className="w-24" value={renewal.healthScore} onChange={(e) => setRenewal((c) => ({ ...c, healthScore: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={0} max={100} placeholder="Usage" className="w-24" value={renewal.usageScore} onChange={(e) => setRenewal((c) => ({ ...c, usageScore: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={0} max={100} placeholder="Value" className="w-24" value={renewal.valueDelivered} onChange={(e) => setRenewal((c) => ({ ...c, valueDelivered: e.target.value }))} disabled={busy !== null} />
              <Button type="submit" disabled={busy !== null || !renewal.renewalDate}>Plan renewal</Button>
            </div>
          </form>
        ) : null}

        {/* CSME-005 */}
        {canEdit ? (
          <section className="space-y-2 border-t border-border/50 pt-4">
            <p className="font-medium">Advocacy</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input type="number" min={0} max={100} placeholder="Health" className="w-24" value={advocacy.healthScore} onChange={(e) => setAdvocacy((c) => ({ ...c, healthScore: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={-100} max={100} placeholder="NPS" className="w-24" value={advocacy.nps} onChange={(e) => setAdvocacy((c) => ({ ...c, nps: e.target.value }))} disabled={busy !== null} />
              <Input type="number" min={0} max={100} placeholder="Adoption" className="w-24" value={advocacy.adoptionScore} onChange={(e) => setAdvocacy((c) => ({ ...c, adoptionScore: e.target.value }))} disabled={busy !== null} />
              <Input placeholder="Request type" className="w-40" value={advocacy.requestType} onChange={(e) => setAdvocacy((c) => ({ ...c, requestType: e.target.value }))} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !advocacy.requestType} onClick={() => void run("advocacy", () => apiRequest(acc("/advocacy/request"), { method: "POST", accessToken, body: { requestType: advocacy.requestType, factors: { healthScore: advocacy.healthScore ? Number(advocacy.healthScore) : null, nps: advocacy.nps ? Number(advocacy.nps) : null, adoptionScore: advocacy.adoptionScore ? Number(advocacy.adoptionScore) : null } } }), "Advocacy request created (consent pending).")}>Create advocacy request</Button>
            </div>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
