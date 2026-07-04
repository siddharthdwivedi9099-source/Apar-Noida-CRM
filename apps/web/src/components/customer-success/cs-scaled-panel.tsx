import { useEffect, useState, type FormEvent } from "react";
import type { AdoptionCampaignsResponse, AdoptionCampaignSummary, CrmLookupUserSummary, CsExpansionSignalsResponse, CsHealthComputeResponse, HealthBand, HealthFactorKey } from "@crm/types";
import { healthBands } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface CsScaledPanelProps {
  csAccountId: string | null;
  owners: CrmLookupUserSummary[];
  accessToken: string | null;
  canEdit: boolean;
  onReload?: () => void;
}

const bandClass: Record<HealthBand, string> = {
  green: "border-emerald-200 bg-emerald-100 text-emerald-700",
  amber: "border-amber-200 bg-amber-100 text-amber-700",
  red: "border-rose-200 bg-rose-100 text-rose-700"
};

// A representative subset of the 10 governed health factors (0–100 sub-scores).
const factorInputs: { key: HealthFactorKey; label: string }[] = [
  { key: "usage", label: "Usage" },
  { key: "loginActivity", label: "Logins" },
  { key: "supportTickets", label: "Support" },
  { key: "csat", label: "CSAT" },
  { key: "trainingCompletion", label: "Training" },
  { key: "engagement", label: "Engagement" }
];

export function CsScaledPanel({ csAccountId, owners, accessToken, canEdit, onReload }: CsScaledPanelProps) {
  const [campaigns, setCampaigns] = useState<AdoptionCampaignSummary[]>([]);
  const [health, setHealth] = useState<CsHealthComputeResponse | null>(null);
  const [signals, setSignals] = useState<CsExpansionSignalsResponse["assessment"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [factors, setFactors] = useState<Record<string, string>>({});
  const [lowUsage, setLowUsage] = useState({ metricLabel: "Active users", current: "", threshold: "" });
  const [renewal, setRenewal] = useState({ renewalDate: "", salesOwnerId: "", financeOwnerId: "", customerContact: "" });
  const [expansion, setExpansion] = useState({ usageRatio: "", additionalDepartments: "", userGrowthRate: "", salesOwnerId: "", name: "" });
  const [campaign, setCampaign] = useState({ name: "", segmentKey: "", healthBand: "" });

  async function loadCampaigns() {
    if (!accessToken) return;
    try {
      const response = await apiRequest<AdoptionCampaignsResponse>("/customer-success/adoption-campaigns", { method: "GET", accessToken });
      setCampaigns(response.campaigns);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void loadCampaigns();
    setHealth(null);
    setSignals(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, csAccountId]);

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    if (!accessToken) return;
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

  const acc = (path: string) => `/customer-success/accounts/${csAccountId}${path}`;

  function handleHealth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csAccountId) return;
    const payload: Record<string, number> = {};
    for (const { key } of factorInputs) {
      if (factors[key] !== undefined && factors[key] !== "") payload[key] = Number(factors[key]);
    }
    void run("health", async () => {
      const response = await apiRequest<CsHealthComputeResponse>(acc("/health-score/compute"), { method: "POST", accessToken, body: { factors: payload } });
      setHealth(response);
    }, "Health score computed.");
  }
  function handleExpansionAssess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csAccountId) return;
    void run("assess", async () => {
      const response = await apiRequest<CsExpansionSignalsResponse>(acc("/expansion/assess"), {
        method: "POST",
        accessToken,
        body: { signals: { usageRatio: expansion.usageRatio ? Number(expansion.usageRatio) : null, additionalDepartments: expansion.additionalDepartments ? Number(expansion.additionalDepartments) : null, userGrowthRate: expansion.userGrowthRate ? Number(expansion.userGrowthRate) : null } }
      });
      setSignals(response.assessment);
    }, "Expansion signals assessed.");
  }

  if (!csAccountId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scaled customer success</CardTitle>
        <CardDescription>Automated health scoring, low-usage alerts, renewal playbooks, expansion signals, and adoption campaigns. AI recommendations are governed placeholders.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {message ? <p className="text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-rose-600">{errorMessage}</p> : null}

        {/* CSMS-001 */}
        <section className="space-y-2">
          <p className="font-medium">Health score</p>
          {canEdit ? (
            <form className="flex flex-wrap items-end gap-2" onSubmit={handleHealth}>
              {factorInputs.map(({ key, label }) => (
                <label key={key} className="text-xs text-muted-foreground">{label}
                  <Input type="number" min={0} max={100} className="w-20" value={factors[key] ?? ""} onChange={(e) => setFactors((c) => ({ ...c, [key]: e.target.value }))} disabled={busy !== null} />
                </label>
              ))}
              <Button type="submit" disabled={busy !== null}>Compute</Button>
            </form>
          ) : null}
          {health ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted" className={bandClass[health.band]}>{health.score} · {health.band}</Badge>
              {health.drivers.slice(0, 3).map((d) => <span key={d.factor} className="text-xs text-muted-foreground">{d.label} {d.subScore} ({d.impact})</span>)}
            </div>
          ) : null}
        </section>

        {/* CSMS-003 */}
        {canEdit ? (
          <section className="space-y-2 border-t border-border/50 pt-4">
            <p className="font-medium">Low-usage alert</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Metric" className="w-40" value={lowUsage.metricLabel} onChange={(e) => setLowUsage((c) => ({ ...c, metricLabel: e.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="Current" className="w-24" value={lowUsage.current} onChange={(e) => setLowUsage((c) => ({ ...c, current: e.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="Threshold" className="w-24" value={lowUsage.threshold} onChange={(e) => setLowUsage((c) => ({ ...c, threshold: e.target.value }))} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !lowUsage.current || !lowUsage.threshold} onClick={() => void run("lowusage", () => apiRequest(acc("/low-usage-check"), { method: "POST", accessToken, body: { metricLabel: lowUsage.metricLabel, current: Number(lowUsage.current), threshold: Number(lowUsage.threshold) } }), "Usage checked — a risk is opened if below threshold.")}>Check usage</Button>
            </div>
          </section>
        ) : null}

        {/* CSMS-004 */}
        {canEdit ? (
          <section className="space-y-2 border-t border-border/50 pt-4">
            <p className="font-medium">Renewal playbook</p>
            <div className="flex flex-wrap items-end gap-2">
              <Input type="date" aria-label="Renewal date" value={renewal.renewalDate} onChange={(e) => setRenewal((c) => ({ ...c, renewalDate: e.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={renewal.salesOwnerId} onChange={(e) => setRenewal((c) => ({ ...c, salesOwnerId: e.target.value }))} disabled={busy !== null} aria-label="Sales owner">
                <option value="">Sales owner…</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
              </select>
              <Input placeholder="Customer contact" className="w-40" value={renewal.customerContact} onChange={(e) => setRenewal((c) => ({ ...c, customerContact: e.target.value }))} disabled={busy !== null} />
              <Button type="button" variant="outline" disabled={busy !== null || !renewal.renewalDate} onClick={() => void run("renewal", () => apiRequest(acc("/renewal-playbook"), { method: "POST", accessToken, body: { renewalDate: renewal.renewalDate, salesOwnerId: renewal.salesOwnerId || null, financeOwnerId: renewal.financeOwnerId || null, customerContact: renewal.customerContact || null } }), "Renewal playbook started (renewal + tasks created).")}>Start playbook</Button>
            </div>
          </section>
        ) : null}

        {/* CSMS-005 */}
        <section className="space-y-2 border-t border-border/50 pt-4">
          <p className="font-medium">Expansion signals</p>
          {canEdit ? (
            <form className="flex flex-wrap items-end gap-2" onSubmit={handleExpansionAssess}>
              <Input type="number" step="0.1" placeholder="Usage ratio" className="w-28" value={expansion.usageRatio} onChange={(e) => setExpansion((c) => ({ ...c, usageRatio: e.target.value }))} disabled={busy !== null} />
              <Input type="number" placeholder="New depts" className="w-24" value={expansion.additionalDepartments} onChange={(e) => setExpansion((c) => ({ ...c, additionalDepartments: e.target.value }))} disabled={busy !== null} />
              <Input type="number" step="0.1" placeholder="Growth rate" className="w-28" value={expansion.userGrowthRate} onChange={(e) => setExpansion((c) => ({ ...c, userGrowthRate: e.target.value }))} disabled={busy !== null} />
              <Button type="submit" variant="outline" disabled={busy !== null}>Assess</Button>
            </form>
          ) : null}
          {signals ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {signals.signals.filter((s) => s.detected).map((s) => <Badge key={s.key} variant="muted">{s.label}: {s.detail}</Badge>)}
                {signals.detectedCount === 0 ? <span className="text-xs text-muted-foreground">No signals detected.</span> : null}
              </div>
              {canEdit && signals.recommended ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input placeholder="Opportunity name" className="w-52" value={expansion.name} onChange={(e) => setExpansion((c) => ({ ...c, name: e.target.value }))} disabled={busy !== null} />
                  <select className={selectClassName} value={expansion.salesOwnerId} onChange={(e) => setExpansion((c) => ({ ...c, salesOwnerId: e.target.value }))} disabled={busy !== null} aria-label="Expansion sales owner">
                    <option value="">Sales owner…</option>
                    {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
                  </select>
                  <Button type="button" disabled={busy !== null || !expansion.name} onClick={() => void run("expopp", () => apiRequest(acc("/expansion/opportunity"), { method: "POST", accessToken, body: { name: expansion.name, salesOwnerId: expansion.salesOwnerId || null, signals: { usageRatio: expansion.usageRatio ? Number(expansion.usageRatio) : null, additionalDepartments: expansion.additionalDepartments ? Number(expansion.additionalDepartments) : null, userGrowthRate: expansion.userGrowthRate ? Number(expansion.userGrowthRate) : null } } }), "Expansion opportunity created + sales owner notified.")}>Create opportunity</Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* CSMS-002 */}
        <section className="space-y-2 border-t border-border/50 pt-4">
          <p className="font-medium">Adoption campaigns ({campaigns.length})</p>
          {campaigns.length > 0 ? (
            <ul className="space-y-1">
              {campaigns.slice(0, 5).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="muted">{c.status}</Badge>
                  <Badge variant="muted">{c.targetCount} target(s)</Badge>
                  {c.criteria.healthBand ? <Badge variant="muted">{c.criteria.healthBand}</Badge> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground">No adoption campaigns yet.</p>}
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-2">
              <Input placeholder="Campaign name" className="w-52" value={campaign.name} onChange={(e) => setCampaign((c) => ({ ...c, name: e.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={campaign.healthBand} onChange={(e) => setCampaign((c) => ({ ...c, healthBand: e.target.value }))} disabled={busy !== null} aria-label="Target health band">
                <option value="">Any health band</option>
                {healthBands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={busy !== null || !campaign.name} onClick={() => void run("campaign", async () => { await apiRequest("/customer-success/adoption-campaigns", { method: "POST", accessToken, body: { name: campaign.name, criteria: { healthBand: campaign.healthBand || null } } }); setCampaign({ name: "", segmentKey: "", healthBand: "" }); await loadCampaigns(); }, "Adoption campaign created.")}>Create campaign</Button>
            </div>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}
