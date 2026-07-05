import { useEffect, useState, type FormEvent } from "react";
import type {
  CrmLookupUserSummary,
  DealReviewBoardResponse,
  RevenueDashboardResponse,
  SalesQuotasResponse,
  SalesWorkspaceOptionsResponse,
  WinLossAnalyticsResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

interface SalesLeadershipDashboardProps {
  accessToken: string | null;
  canManage: boolean;
}

const emptyQuota = { name: "", periodType: "quarter" as "month" | "quarter" | "year", periodStart: "", periodEnd: "", targetAmount: "", ownerId: "", product: "", region: "" };

export function SalesLeadershipDashboard({ accessToken, canManage }: SalesLeadershipDashboardProps) {
  const [revenue, setRevenue] = useState<RevenueDashboardResponse | null>(null);
  const [quotas, setQuotas] = useState<SalesQuotasResponse | null>(null);
  const [winLoss, setWinLoss] = useState<WinLossAnalyticsResponse | null>(null);
  const [board, setBoard] = useState<DealReviewBoardResponse | null>(null);
  const [owners, setOwners] = useState<CrmLookupUserSummary[]>([]);
  const [quotaForm, setQuotaForm] = useState(emptyQuota);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) {
      return;
    }
    try {
      const [rev, q, wl, b, opts] = await Promise.all([
        apiRequest<RevenueDashboardResponse>("/sales-leadership/revenue-dashboard", { method: "GET", accessToken }),
        apiRequest<SalesQuotasResponse>("/sales-leadership/quotas", { method: "GET", accessToken }),
        apiRequest<WinLossAnalyticsResponse>("/sales-leadership/win-loss", { method: "GET", accessToken }),
        apiRequest<DealReviewBoardResponse>("/sales-leadership/deal-review-board", { method: "GET", accessToken }),
        apiRequest<SalesWorkspaceOptionsResponse>("/sales-workspaces/options", { method: "GET", accessToken })
      ]);
      setRevenue(rev);
      setQuotas(q);
      setWinLoss(wl);
      setBoard(b);
      setOwners(opts.owners);
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

  function handleCreateQuota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("create-quota", () => apiRequest("/sales-leadership/quotas", {
      method: "POST",
      accessToken,
      body: {
        name: quotaForm.name.trim(),
        periodType: quotaForm.periodType,
        periodStart: quotaForm.periodStart,
        periodEnd: quotaForm.periodEnd,
        targetAmount: Number(quotaForm.targetAmount),
        ownerId: quotaForm.ownerId || null,
        product: quotaForm.product || null,
        region: quotaForm.region || null
      }
    }), "Quota created.");
    setQuotaForm(emptyQuota);
  }

  if (!revenue || !quotas || !winLoss || !board) {
    return null;
  }

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Revenue dashboard</CardTitle>
          <CardDescription>Executive revenue performance (SH-001).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Target", revenue.targetAmount],
              ["Achieved", revenue.achievedAmount],
              ["Gap", revenue.gap],
              ["Pipeline", revenue.pipelineValue],
              ["Weighted forecast", revenue.weightedForecast],
              ["Renewal pipeline", revenue.renewalPipelineValue]
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-[1.25rem] bg-background/75 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold">{formatCurrencyAmount(value as number)}</p>
              </div>
            ))}
            <div className="rounded-[1.25rem] bg-background/75 p-3">
              <p className="text-xs text-muted-foreground">Win rate / avg deal / cycle</p>
              <p className="text-sm font-semibold">{revenue.winRate}% · {formatCurrencyAmount(revenue.avgDealSize)} · {revenue.avgCycleDays}d</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotas</CardTitle>
          <CardDescription>Attainment and risk roll-up (SH-002).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotas.quotas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotas defined yet.</p>
          ) : (
            quotas.quotas.map((quota) => (
              <div key={quota.id} className="rounded-[1rem] bg-background/75 p-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{quota.name} <span className="text-xs text-muted-foreground">({quota.periodType})</span></span>
                  <span className="flex items-center gap-2">
                    <Badge variant={quota.attainment.status === "behind" ? "default" : "muted"}>{quota.attainment.attainmentPercent}%</Badge>
                    <Badge variant={quota.risk.risk === "high" ? "default" : "muted"}>risk {quota.risk.risk}</Badge>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrencyAmount(quota.attainment.achievedAmount)} / {formatCurrencyAmount(quota.targetAmount)} · gap {formatCurrencyAmount(quota.attainment.gap)}
                  {quota.owner ? ` · ${quota.owner.displayName}` : ""}{quota.childCount > 0 ? ` · ${quota.childCount} child quotas` : ""}
                </p>
              </div>
            ))
          )}
          {canManage ? (
            <form className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 rounded-[1rem] border border-border/60 p-3" onSubmit={handleCreateQuota}>
              <Input placeholder="Quota name" value={quotaForm.name} onChange={(event) => setQuotaForm((c) => ({ ...c, name: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={quotaForm.periodType} onChange={(event) => setQuotaForm((c) => ({ ...c, periodType: event.target.value as typeof c.periodType }))} disabled={busy !== null}>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
              <Input type="number" placeholder="Target amount" value={quotaForm.targetAmount} onChange={(event) => setQuotaForm((c) => ({ ...c, targetAmount: event.target.value }))} disabled={busy !== null} />
              <Input type="date" aria-label="Period start" value={quotaForm.periodStart} onChange={(event) => setQuotaForm((c) => ({ ...c, periodStart: event.target.value }))} disabled={busy !== null} />
              <Input type="date" aria-label="Period end" value={quotaForm.periodEnd} onChange={(event) => setQuotaForm((c) => ({ ...c, periodEnd: event.target.value }))} disabled={busy !== null} />
              <select className={selectClassName} value={quotaForm.ownerId} onChange={(event) => setQuotaForm((c) => ({ ...c, ownerId: event.target.value }))} disabled={busy !== null}>
                <option value="">All owners</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.displayName}</option>
                ))}
              </select>
              <Button type="submit" disabled={busy !== null || quotaForm.name.trim().length < 2 || !quotaForm.periodStart || !quotaForm.periodEnd || Number(quotaForm.targetAmount) <= 0}>
                Create quota
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Win/loss analytics</CardTitle>
            <CardDescription>Overall win rate {winLoss.winRate}% · {winLoss.totalWon}W / {winLoss.totalLost}L (SH-004).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { label: "By loss reason", entries: winLoss.byLossReason },
              { label: "By competitor", entries: winLoss.byCompetitor },
              { label: "By rep", entries: winLoss.byRep }
            ]).map(({ label, entries }) => (
              <div key={label}>
                <p className="text-sm font-semibold">{label}</p>
                {entries.slice(0, 5).map((entry) => (
                  <div key={entry.label} className="mt-1 flex items-center justify-between text-sm">
                    <span>{entry.label}</span>
                    <span className="text-xs text-muted-foreground">{entry.wonCount}W / {entry.lostCount}L · {entry.winRate}%</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strategic deal review board</CardTitle>
            <CardDescription>Deals above {formatCurrencyAmount(board.thresholdAmount)} (SH-003).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {board.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals above the review threshold.</p>
            ) : (
              board.entries.slice(0, 8).map((entry) => (
                <div key={entry.opportunityId} className="rounded-[1rem] bg-background/75 p-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{entry.name} · {formatCurrencyAmount(entry.amount)}</span>
                    {entry.stage ? <Badge variant="muted">{entry.stage.label}</Badge> : null}
                  </div>
                  {entry.executiveSponsor ? <p className="mt-1 text-xs text-muted-foreground">Sponsor: {entry.executiveSponsor}</p> : null}
                  {entry.comments.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">{entry.comments.length} leadership comment(s)</p> : null}
                  {canManage ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <Input placeholder="Leadership comment" value={comments[entry.opportunityId] ?? ""} onChange={(event) => setComments((c) => ({ ...c, [entry.opportunityId]: event.target.value }))} disabled={busy !== null} />
                      <Button type="button" variant="outline" disabled={busy !== null || !(comments[entry.opportunityId] ?? "").trim()} onClick={() => void run(`comment-${entry.opportunityId}`, async () => {
                        await apiRequest(`/sales-leadership/opportunities/${entry.opportunityId}/leadership-comment`, { method: "POST", accessToken, body: { comment: comments[entry.opportunityId].trim() } });
                        setComments((c) => ({ ...c, [entry.opportunityId]: "" }));
                      }, "Comment logged.")}>
                        Comment
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
