import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  CustomerQueryDashboardResponse,
  CustomerQuerySession,
  CustomerQuerySessionDetail,
  CustomerQuerySessionListResponse,
  CustomerQuerySessionResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { useAuth } from "@/providers/auth-provider";

export function CustomerQueryReviewPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [sessions, setSessions] = useState<CustomerQuerySession[]>([]);
  const [dashboard, setDashboard] = useState<CustomerQueryDashboardResponse | null>(null);
  const [selected, setSelected] = useState<CustomerQuerySessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canResolve = hasAnyPermission(["customer_query.assign", "customer_query.manage_ai", "customer_query.configure", "customer_query.edit"]);

  async function load() {
    if (!accessToken) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [sessionsRes, dashboardRes] = await Promise.all([
        apiRequest<CustomerQuerySessionListResponse>("/customer-query/sessions?pageSize=100", { method: "GET", accessToken }),
        apiRequest<CustomerQueryDashboardResponse>("/customer-query/dashboard", { method: "GET", accessToken }).catch(() => null)
      ]);
      setSessions(sessionsRes.sessions);
      setDashboard(dashboardRes);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function openSession(sessionId: string) {
    if (!accessToken) {
      return;
    }
    try {
      const res = await apiRequest<CustomerQuerySessionResponse>(`/customer-query/sessions/${sessionId}`, { method: "GET", accessToken });
      setSelected(res.session);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function resolve() {
    if (!accessToken || !selected) {
      return;
    }
    try {
      const res = await apiRequest<CustomerQuerySessionResponse>(`/customer-query/sessions/${selected.id}/resolve`, { method: "POST", accessToken, body: { note: "Reviewed and resolved." } });
      setSelected(res.session);
      await load();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return <CrmLoadingState title="Loading query review" description="Customer query sessions and the AI query dashboard are loading." />;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Support & success"
        title="Review customer AI queries, escalations, and resolution."
        summary="Every customer question, AI answer, citation, confidence score, and escalation is logged here for support and customer success review."
        aside={dashboard ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Sessions" value={String(dashboard.totalSessions)} description="Total query sessions." />
            <CrmMetricCard label="Escalated" value={String(dashboard.escalatedSessions)} description="Sessions escalated to a human." />
            <CrmMetricCard label="Avg confidence" value={`${(dashboard.averageConfidence * 100).toFixed(0)}%`} description="Average answer confidence." />
          </div>
        ) : undefined}
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/customer-query/gaps">Knowledge gap dashboard</Link></Button>
        <Button size="sm" variant="outline" onClick={() => void load()}>Refresh</Button>
      </div>

      {dashboard ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CrmMetricCard label="Questions" value={String(dashboard.totalQuestions)} description="Customer questions asked." />
          <CrmMetricCard label="Grounded" value={String(dashboard.groundedAnswers)} description="Answers with sources." />
          <CrmMetricCard label="Helpful" value={String(dashboard.helpfulCount)} description="Marked helpful." />
          <CrmMetricCard label="Tickets" value={String(dashboard.ticketsCreated)} description="Support tickets created." />
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader><CardTitle>Sessions</CardTitle><CardDescription>Select a session to review.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? <p className="text-sm text-muted-foreground">No query sessions yet.</p> : (
              <ul className="space-y-2">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <button type="button" onClick={() => void openSession(session.id)} className={`w-full rounded-[1rem] border p-3 text-left ${selected?.id === session.id ? "border-primary bg-primary/5" : "border-border/60 bg-background/75"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{session.subject || "Untitled"}</span>
                        <Badge variant={session.status === "escalated" ? "default" : "muted"}>{session.status}</Badge>
                        {session.escalationLevel > 0 ? <Badge variant="muted">L{session.escalationLevel}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{session.channel} • {session.messageCount} msgs • {formatDateTime(session.updatedAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected.subject || "Query session"}</CardTitle>
              <CardDescription>{selected.channel} • status {selected.status}{selected.relatedTicketId ? " • ticket linked" : ""}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selected.status === "escalated" ? "default" : "muted"}>{selected.status}</Badge>
                {selected.lastConfidence !== null ? <Badge variant="muted">Last confidence {(selected.lastConfidence * 100).toFixed(0)}%</Badge> : null}
                {canResolve && selected.status !== "resolved" ? <Button size="sm" variant="outline" onClick={() => void resolve()}>Mark resolved</Button> : null}
              </div>

              <div className="space-y-2">
                {selected.messages.map((message) => (
                  <div key={message.id} className={`rounded-[1rem] border p-3 ${message.role === "assistant" ? "border-border/60 bg-background/75" : "border-transparent bg-muted/40"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{message.role}</Badge>
                      {message.queryLevel ? <Badge variant="muted">Level {message.queryLevel}</Badge> : null}
                      {message.confidenceScore !== null ? <Badge variant="muted">{(message.confidenceScore * 100).toFixed(0)}%</Badge> : null}
                      {message.escalated ? <Badge>Escalated</Badge> : null}
                      {message.feedback !== "pending" ? <Badge variant="muted">{message.feedback}</Badge> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{message.content}</p>
                    {message.citations.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {message.citations.map((citation, ci) => (
                          <li key={ci} className="text-xs text-muted-foreground">• {citation.sourceName ?? "Knowledge"}{citation.documentTitle ? ` — ${citation.documentTitle}` : citation.articleTitle ? ` — ${citation.articleTitle}` : ""}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>

              {selected.escalations.length > 0 ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Escalations</p>
                  <ul className="mt-1 space-y-1">
                    {selected.escalations.map((escalation) => (
                      <li key={escalation.id} className="rounded-[0.75rem] border border-border/60 bg-background/75 px-3 py-2 text-xs">
                        <Badge variant="muted">{escalation.reason}</Badge> <Badge variant="muted">{escalation.status}</Badge> {escalation.relatedTicketId ? "• ticket created" : ""} — {escalation.notes}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <CrmEmptyState title="Select a session" description="Choose a query session to review the conversation, citations, confidence, and escalations." />
        )}
      </section>
    </div>
  );
}
