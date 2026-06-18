import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CustomerQueryDashboardResponse, CustomerQueryKnowledgeGapListResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function KnowledgeGapDashboardPage() {
  const { accessToken } = useAuth();
  const [gaps, setGaps] = useState<CustomerQueryKnowledgeGapListResponse["gaps"]>([]);
  const [dashboard, setDashboard] = useState<CustomerQueryDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [gapsRes, dashboardRes] = await Promise.all([
        apiRequest<CustomerQueryKnowledgeGapListResponse>("/customer-query/knowledge-gaps", { method: "GET", accessToken }),
        apiRequest<CustomerQueryDashboardResponse>("/customer-query/dashboard", { method: "GET", accessToken }).catch(() => null)
      ]);
      setGaps(gapsRes.gaps);
      setDashboard(dashboardRes);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  if (isLoading) {
    return <CrmLoadingState title="Loading knowledge gaps" description="AI knowledge gaps and query analytics are loading." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Knowledge gaps"
        title="Knowledge gaps surface what customers ask that the AI couldn't answer."
        summary="Unanswered and low-confidence queries are logged here so support and customer success can close gaps in the approved knowledge base."
        aside={dashboard ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Open gaps" value={String(gaps.filter((g) => g.status === "open").length)} description="Gaps awaiting content." />
            <CrmMetricCard label="Not helpful" value={String(dashboard.notHelpfulCount)} description="Answers marked not helpful." />
            <CrmMetricCard label="Open escalations" value={String(dashboard.openEscalations)} description="Escalations awaiting review." />
          </div>
        ) : undefined}
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/customer-query">Query review</Link></Button>
        <Button size="sm" variant="outline" onClick={() => void load()}>Refresh</Button>
      </div>

      {dashboard ? (
        <Card>
          <CardHeader><CardTitle>Query levels</CardTitle><CardDescription>Distribution of question complexity.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {dashboard.levelDistribution.map((entry) => (
              <div key={entry.level} className="rounded-[1rem] border border-border/60 bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Level {entry.level}</p>
                <p className="mt-1 text-2xl font-semibold">{entry.count}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Knowledge gaps</CardTitle><CardDescription>Queries that returned no confident answer.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knowledge gaps logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {gaps.map((gap) => (
                <li key={gap.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{gap.status}</Badge>
                    <Badge variant="muted">{gap.detectedSource}</Badge>
                    {gap.occurrenceCount > 1 ? <Badge variant="muted">×{gap.occurrenceCount}</Badge> : null}
                    <span className="text-xs text-muted-foreground">{formatDateTime(gap.createdAt)}</span>
                  </div>
                  <p className="mt-1">{gap.queryText}</p>
                  {gap.resolutionNote ? <p className="mt-1 text-xs text-muted-foreground">Resolution: {gap.resolutionNote}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
