import { useEffect, useState } from "react";
import type {
  BdMarketSignalsResponse,
  BdPartnerReferralsResponse,
  BdTargetAccountOptionsResponse,
  BdTerritoryPlansResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface BusinessDevelopmentBdmProps {
  options: BdTargetAccountOptionsResponse;
  accessToken: string | null;
  canCreate: boolean;
  canUpdate: boolean;
}

export function BusinessDevelopmentBdm({ options, accessToken, canCreate, canUpdate }: BusinessDevelopmentBdmProps) {
  const [plans, setPlans] = useState<BdTerritoryPlansResponse | null>(null);
  const [signals, setSignals] = useState<BdMarketSignalsResponse | null>(null);
  const [referrals, setReferrals] = useState<BdPartnerReferralsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [plan, setPlan] = useState({ name: "", geography: "", targetSegments: "", pipelineTarget: "", revenueTarget: "", reviewerUserId: "" });
  const [signal, setSignal] = useState({ signalTypeKey: options.marketSignalTypes[0]?.key ?? "", content: "" });
  const [referral, setReferral] = useState({ customerName: "", partnerAccountId: "", referralSource: "", referredValue: "" });

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [p, s, r] = await Promise.all([
        apiRequest<BdTerritoryPlansResponse>("/business-development/territory-plans", { method: "GET", accessToken }),
        apiRequest<BdMarketSignalsResponse>("/business-development/market-signals", { method: "GET", accessToken }),
        apiRequest<BdPartnerReferralsResponse>("/business-development/partner-referrals", { method: "GET", accessToken })
      ]);
      setPlans(p);
      setSignals(s);
      setReferrals(r);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
     
  }, [accessToken]);

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

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Territory plans</CardTitle>
          <CardDescription>Structured growth plans with pipeline + revenue targets (BDM-001).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(plans?.territoryPlans ?? []).map((p) => (
            <div key={p.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge variant={p.reviewStatus === "reviewed" ? "success" : "muted"}>{p.reviewStatus}</Badge>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {p.geography ?? "—"} • pipeline {formatCurrencyAmount(p.pipelineTarget ?? 0)} • revenue {formatCurrencyAmount(p.revenueTarget ?? 0)}
              </p>
              {canUpdate && p.reviewStatus === "draft" ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <select className={selectClassName} value={plan.reviewerUserId} onChange={(event) => setPlan((c) => ({ ...c, reviewerUserId: event.target.value }))} disabled={busy !== null}>
                    <option value="">Sales head…</option>
                    {options.owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.displayName}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" disabled={busy !== null || plan.reviewerUserId.length === 0} onClick={() => void run("planReview", () => apiRequest(`/business-development/territory-plans/${p.id}/review`, { method: "POST", accessToken, body: { reviewerUserId: plan.reviewerUserId } }), "Sent for review.")}>
                    Submit for review
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {canCreate ? (
            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-3">
              <Input placeholder="Plan name" value={plan.name} onChange={(event) => setPlan((c) => ({ ...c, name: event.target.value }))} disabled={busy !== null} />
              <div className="grid gap-2 md:grid-cols-2">
                <Input placeholder="Geography" value={plan.geography} onChange={(event) => setPlan((c) => ({ ...c, geography: event.target.value }))} disabled={busy !== null} />
                <Input placeholder="Target segments" value={plan.targetSegments} onChange={(event) => setPlan((c) => ({ ...c, targetSegments: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Pipeline target" value={plan.pipelineTarget} onChange={(event) => setPlan((c) => ({ ...c, pipelineTarget: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Revenue target" value={plan.revenueTarget} onChange={(event) => setPlan((c) => ({ ...c, revenueTarget: event.target.value }))} disabled={busy !== null} />
              </div>
              <Button
                type="button"
                disabled={busy !== null || plan.name.trim().length < 2}
                onClick={() => void run("plan", async () => {
                  await apiRequest("/business-development/territory-plans", { method: "POST", accessToken, body: { name: plan.name.trim(), geography: plan.geography || null, targetSegments: plan.targetSegments || null, pipelineTarget: plan.pipelineTarget ? Number(plan.pipelineTarget) : null, revenueTarget: plan.revenueTarget ? Number(plan.revenueTarget) : null } });
                  setPlan({ name: "", geography: "", targetSegments: "", pipelineTarget: "", revenueTarget: "", reviewerUserId: "" });
                }, "Territory plan created.")}
              >
                Create plan
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market intelligence</CardTitle>
          <CardDescription>Log competitor, pricing, objection, trend, and opportunity signals (BDM-002).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(signals?.marketSignals ?? []).map((s) => (
            <div key={s.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
              <Badge variant="muted">{s.signalType?.label ?? "Signal"}</Badge>
              <p className="mt-1">{s.content}</p>
            </div>
          ))}
          {canCreate ? (
            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-3">
              <select className={selectClassName} value={signal.signalTypeKey} onChange={(event) => setSignal((c) => ({ ...c, signalTypeKey: event.target.value }))} disabled={busy !== null}>
                {options.marketSignalTypes.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.label}
                  </option>
                ))}
              </select>
              <textarea className={textareaClassName} rows={2} placeholder="Signal content" value={signal.content} onChange={(event) => setSignal((c) => ({ ...c, content: event.target.value }))} disabled={busy !== null} />
              <Button type="button" disabled={busy !== null || signal.content.trim().length === 0 || signal.signalTypeKey.length === 0} onClick={() => void run("signal", async () => {
                await apiRequest("/business-development/market-signals", { method: "POST", accessToken, body: { signalTypeKey: signal.signalTypeKey, content: signal.content.trim() } });
                setSignal((c) => ({ ...c, content: "" }));
              }, "Signal logged.")}>
                Log signal
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner referrals</CardTitle>
          <CardDescription>Track partner-sourced pipeline, conversion, revenue, and commission (BDM-003).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(referrals?.referrals ?? []).map((r) => (
            <div key={r.id} className="rounded-[1rem] bg-background/75 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.customerName}</span>
                <span className="flex items-center gap-2">
                  {r.converted ? <Badge variant="success">Converted</Badge> : <Badge variant="muted">Open</Badge>}
                  {r.commissionEligible ? <Badge>Commission</Badge> : null}
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {r.partnerAccount?.name ?? "No partner"} • {formatCurrencyAmount(r.referredValue ?? 0)}
              </p>
              {canUpdate ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!r.converted ? (
                    <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("refConv", () => apiRequest(`/business-development/partner-referrals/${r.id}`, { method: "PATCH", accessToken, body: { converted: true } }), "Marked converted.")}>
                      Mark converted
                    </Button>
                  ) : null}
                  {!r.commissionEligible ? (
                    <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("refComm", () => apiRequest(`/business-development/partner-referrals/${r.id}`, { method: "PATCH", accessToken, body: { commissionEligible: true } }), "Flagged commission.")}>
                      Flag commission
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {canCreate ? (
            <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-background/70 p-3">
              <Input placeholder="Customer name" value={referral.customerName} onChange={(event) => setReferral((c) => ({ ...c, customerName: event.target.value }))} disabled={busy !== null} />
              <div className="grid gap-2 md:grid-cols-2">
                <select className={selectClassName} value={referral.partnerAccountId} onChange={(event) => setReferral((c) => ({ ...c, partnerAccountId: event.target.value }))} disabled={busy !== null}>
                  <option value="">Partner account…</option>
                  {options.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <Input placeholder="Referral source" value={referral.referralSource} onChange={(event) => setReferral((c) => ({ ...c, referralSource: event.target.value }))} disabled={busy !== null} />
                <Input type="number" placeholder="Referred value" value={referral.referredValue} onChange={(event) => setReferral((c) => ({ ...c, referredValue: event.target.value }))} disabled={busy !== null} />
              </div>
              <Button type="button" disabled={busy !== null || referral.customerName.trim().length === 0} onClick={() => void run("referral", async () => {
                await apiRequest("/business-development/partner-referrals", { method: "POST", accessToken, body: { customerName: referral.customerName.trim(), partnerAccountId: referral.partnerAccountId || null, referralSource: referral.referralSource || null, referredValue: referral.referredValue ? Number(referral.referredValue) : null } });
                setReferral({ customerName: "", partnerAccountId: "", referralSource: "", referredValue: "" });
              }, "Referral created.")}>
                Create referral
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
