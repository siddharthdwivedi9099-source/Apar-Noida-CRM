import { useEffect, useState } from "react";
import type { PartnerConflictsResponse, PartnerPerformanceResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface PartnerChannelPanelProps {
  accessToken: string | null;
  canManage: boolean;
}

export function PartnerChannelPanel({ accessToken, canManage }: PartnerChannelPanelProps) {
  const [conflicts, setConflicts] = useState<PartnerConflictsResponse["conflicts"]>([]);
  const [performance, setPerformance] = useState<PartnerPerformanceResponse["rows"]>([]);
  const [resolveState, setResolveState] = useState<Record<string, { winningDealId: string; resolution: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [conflictsResponse, performanceResponse] = await Promise.all([
        apiRequest<PartnerConflictsResponse>("/partners/management/conflicts", { method: "GET", accessToken }),
        apiRequest<PartnerPerformanceResponse>("/partners/management/performance", { method: "GET", accessToken })
      ]);
      setConflicts(conflictsResponse.conflicts);
      setPerformance(performanceResponse.rows);
      setLoaded(true);
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

  if (!loaded) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {/* PM-004 */}
      <Card>
        <CardHeader>
          <CardTitle>Channel conflicts</CardTitle>
          <CardDescription>Overlapping active registrations across partners (PM-004).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {conflicts.length === 0 ? <p className="text-sm text-muted-foreground">No channel conflicts detected.</p> : conflicts.map((conflict) => (
            <div key={conflict.conflictKey} className="rounded-[1rem] bg-background/75 p-3 text-sm">
              <p className="font-medium">Conflict: {conflict.registrations.length} partners</p>
              {conflict.registrations.map((registration) => (
                <div key={registration.dealId} className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{registration.partner?.name ?? "—"} · {registration.customerName ?? "—"} · {formatCurrencyAmount(registration.amount)}</span>
                  <span>submitted {registration.submittedAt.slice(0, 10)}</span>
                </div>
              ))}
              {canManage ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <select className={selectClassName} value={resolveState[conflict.conflictKey]?.winningDealId ?? ""} onChange={(event) => setResolveState((c) => ({ ...c, [conflict.conflictKey]: { winningDealId: event.target.value, resolution: c[conflict.conflictKey]?.resolution ?? "" } }))} disabled={busy !== null}>
                    <option value="">Winning partner…</option>
                    {conflict.registrations.map((registration) => <option key={registration.dealId} value={registration.dealId}>{registration.partner?.name ?? registration.dealId}</option>)}
                  </select>
                  <Input placeholder="Resolution note" value={resolveState[conflict.conflictKey]?.resolution ?? ""} onChange={(event) => setResolveState((c) => ({ ...c, [conflict.conflictKey]: { winningDealId: c[conflict.conflictKey]?.winningDealId ?? "", resolution: event.target.value } }))} disabled={busy !== null} />
                  <Button type="button" variant="outline" disabled={busy !== null || !resolveState[conflict.conflictKey]?.winningDealId || !(resolveState[conflict.conflictKey]?.resolution ?? "").trim()} onClick={() => void run(`resolve-${conflict.conflictKey}`, () => apiRequest("/partners/management/conflicts/resolve", { method: "POST", accessToken, body: { conflictKey: conflict.conflictKey, winningDealId: resolveState[conflict.conflictKey].winningDealId, resolution: resolveState[conflict.conflictKey].resolution.trim() } }), "Conflict resolved.")}>Resolve</Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* PM-005 */}
      <Card>
        <CardHeader>
          <CardTitle>Partner performance</CardTitle>
          <CardDescription>Registrations, pipeline, revenue, win rate, cycle, onboarding (PM-005). AI high-performer/inactive detection is a governed placeholder.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {performance.length === 0 ? <p className="text-sm text-muted-foreground">No partner activity yet.</p> : performance.map((row) => (
            <div key={row.partner.id} className="rounded-[1rem] bg-background/75 p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{row.partner.name} {row.inactive ? <Badge variant="default">inactive</Badge> : null}</span>
                <span className="text-xs text-muted-foreground">{row.registrations} reg · {row.approvals} appr · {row.rejections} rej</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">pipeline {formatCurrencyAmount(row.pipelineValue)} · revenue {formatCurrencyAmount(row.revenue)} · win {row.winRate}% · cycle {row.avgCycleDays}d · onboarding {row.onboardingPercent}%</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
