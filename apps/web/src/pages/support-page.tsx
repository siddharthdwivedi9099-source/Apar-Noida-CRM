import { useEffect, useMemo, useState } from "react";
import type {
  CreateSupportKnowledgeArticleRequestBody,
  CreateSupportTicketRequestBody,
  SupportDashboardResponse,
  SupportKnowledgeArticlesResponse,
  SupportTicketDetail,
  SupportTicketMessageType,
  SupportTicketOptionsResponse,
  SupportTicketsResponse,
  UpdateSupportTicketRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface TicketFormState {
  subject: string;
  description: string;
  priorityKey: string;
  categoryKey: string;
  sourceKey: string;
  accountId: string;
  contactId: string;
  assigneeId: string;
  slaPolicyId: string;
}

interface ArticleFormState {
  title: string;
  categoryKey: string;
  summary: string;
}

function buildTicketFormState(options: SupportTicketOptionsResponse | null): TicketFormState {
  return {
    subject: "",
    description: "",
    priorityKey: options?.priorities.find((entry) => entry.isDefault)?.key ?? options?.priorities[0]?.key ?? "",
    categoryKey: options?.categories.find((entry) => entry.isDefault)?.key ?? options?.categories[0]?.key ?? "",
    sourceKey: options?.sources.find((entry) => entry.isDefault)?.key ?? options?.sources[0]?.key ?? "",
    accountId: "",
    contactId: "",
    assigneeId: "",
    slaPolicyId: ""
  };
}

export function SupportPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [options, setOptions] = useState<SupportTicketOptionsResponse | null>(null);
  const [dashboard, setDashboard] = useState<SupportDashboardResponse | null>(null);
  const [data, setData] = useState<SupportTicketsResponse | null>(null);
  const [articles, setArticles] = useState<SupportKnowledgeArticlesResponse | null>(null);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketFormState>(buildTicketFormState(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [replyType, setReplyType] = useState<SupportTicketMessageType>("internal_note");
  const [replyBody, setReplyBody] = useState("");
  const [linkArticleId, setLinkArticleId] = useState("");
  const [articleForm, setArticleForm] = useState<ArticleFormState>({ title: "", categoryKey: "", summary: "" });

  const canCreate = hasAnyPermission(["support.create", "support.configure"]);
  const canEdit = hasAnyPermission(["support.edit", "support.assign", "support.configure", "support.manage_workflow"]);
  const canMessage = hasAnyPermission(["support.edit", "support.create", "support.configure", "support.manage_workflow"]);

  const tickets = useMemo(() => data?.tickets ?? [], [data?.tickets]);

  async function loadAll() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, dashboardResponse, listResponse, articlesResponse] = await Promise.all([
        apiRequest<SupportTicketOptionsResponse>("/support/options", { method: "GET", accessToken }),
        apiRequest<SupportDashboardResponse>("/support/dashboard", { method: "GET", accessToken }),
        apiRequest<SupportTicketsResponse>("/support/tickets?pageSize=100", { method: "GET", accessToken }),
        apiRequest<SupportKnowledgeArticlesResponse>("/support/knowledge-articles", { method: "GET", accessToken })
      ]);
      setOptions(optionsResponse);
      setDashboard(dashboardResponse);
      setData(listResponse);
      setArticles(articlesResponse);
      setTicketForm((current) => (current.priorityKey ? current : buildTicketFormState(optionsResponse)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [accessToken]);

  useEffect(() => {
    if (tickets.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) => (current && tickets.some((ticket) => ticket.id === current) ? current : tickets[0].id));
  }, [tickets]);

  async function loadDetail(ticketId: string) {
    if (!accessToken) {
      return;
    }

    try {
      const response = await apiRequest<{ ticket: SupportTicketDetail }>(`/support/tickets/${ticketId}`, { method: "GET", accessToken });
      setDetail(response.ticket);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    void loadDetail(selectedId);
  }, [accessToken, selectedId]);

  async function handleCreateTicket(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setFormError(null);

    const payload: CreateSupportTicketRequestBody = {
      subject: ticketForm.subject.trim(),
      description: ticketForm.description.trim() || null,
      priorityKey: ticketForm.priorityKey,
      categoryKey: ticketForm.categoryKey,
      sourceKey: ticketForm.sourceKey,
      accountId: ticketForm.accountId || null,
      contactId: ticketForm.contactId || null,
      assigneeId: ticketForm.assigneeId || null,
      slaPolicyId: ticketForm.slaPolicyId || null
    };

    try {
      const response = await apiRequest<{ ticket: SupportTicketDetail }>("/support/tickets", { method: "POST", accessToken, body: payload });
      setIsCreating(false);
      setTicketForm(buildTicketFormState(options));
      await loadAll();
      setSelectedId(response.ticket.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function handleUpdateTicket(payload: UpdateSupportTicketRequestBody) {
    if (!accessToken || !detail) {
      return;
    }

    try {
      await apiRequest(`/support/tickets/${detail.id}`, { method: "PATCH", accessToken, body: payload });
      await loadDetail(detail.id);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleAddMessage(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken || !detail || replyBody.trim().length === 0) {
      return;
    }

    try {
      await apiRequest(`/support/tickets/${detail.id}/messages`, {
        method: "POST",
        accessToken,
        body: { messageType: replyType, body: replyBody.trim() }
      });
      setReplyBody("");
      await loadDetail(detail.id);
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleLinkArticle(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken || !detail || !linkArticleId) {
      return;
    }

    try {
      await apiRequest(`/support/tickets/${detail.id}/articles`, { method: "POST", accessToken, body: { articleId: linkArticleId } });
      setLinkArticleId("");
      await loadDetail(detail.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleCreateArticle(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken || articleForm.title.trim().length < 2) {
      return;
    }

    const payload: CreateSupportKnowledgeArticleRequestBody = {
      title: articleForm.title.trim(),
      categoryKey: articleForm.categoryKey || null,
      summary: articleForm.summary.trim() || null,
      status: "published"
    };

    try {
      await apiRequest("/support/knowledge-articles", { method: "POST", accessToken, body: payload });
      setArticleForm({ title: "", categoryKey: "", summary: "" });
      await loadAll();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title="Loading support workspace"
        description="Support dashboard, ticket queue, SLA policies, and knowledge base are loading from the tenant-safe API."
      />
    );
  }

  if (!data || !options || !dashboard) {
    return (
      <CrmEmptyState
        title="The support workspace could not be loaded."
        description={errorMessage ?? "The current tenant session could not load tickets."}
        action={
          <Button variant="outline" onClick={() => void loadAll()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Support operations"
        title="Ticket queues, SLA tracking, escalation, and knowledge base run from one support workspace."
        summary="Tickets keep status, priority, category, source, SLA due dates and breach status, assignment, internal notes, customer replies, and linked knowledge articles connected to the same tenant-aware accounts and contacts."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating((current) => !current)}>{isCreating ? "Close form" : "Create ticket"}</Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Open tickets" value={String(dashboard.openTickets)} description="Tickets not yet resolved or closed." />
            <CrmMetricCard label="SLA breached" value={String(dashboard.slaBreachedTickets)} description="Tickets past a first-response or resolution SLA." />
            <CrmMetricCard label="Unassigned" value={String(dashboard.unassignedTickets)} description="Tickets without an assignee." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="Total tickets" value={String(dashboard.totalTickets)} description="Tickets in scope." />
        <CrmMetricCard label="Escalated" value={String(dashboard.escalatedTickets)} description="Tickets in escalated status." />
        <CrmMetricCard label="Resolved" value={String(dashboard.resolvedTickets)} description="Resolved or closed tickets." />
        <CrmMetricCard label="KB articles" value={String(dashboard.knowledgeArticleCount)} description="Knowledge base articles." />
      </section>

      {isCreating && canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New ticket</CardTitle>
            <CardDescription>Capture the issue, classification, assignment, and SLA policy.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateTicket}>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Subject</span>
                <Input value={ticketForm.subject} onChange={(event) => setTicketForm((current) => ({ ...current, subject: event.target.value }))} required minLength={2} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Priority</span>
                <select className={selectClassName} value={ticketForm.priorityKey} onChange={(event) => setTicketForm((current) => ({ ...current, priorityKey: event.target.value }))}>
                  {options.priorities.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Category</span>
                <select className={selectClassName} value={ticketForm.categoryKey} onChange={(event) => setTicketForm((current) => ({ ...current, categoryKey: event.target.value }))}>
                  {options.categories.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Source</span>
                <select className={selectClassName} value={ticketForm.sourceKey} onChange={(event) => setTicketForm((current) => ({ ...current, sourceKey: event.target.value }))}>
                  {options.sources.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">SLA policy</span>
                <select className={selectClassName} value={ticketForm.slaPolicyId} onChange={(event) => setTicketForm((current) => ({ ...current, slaPolicyId: event.target.value }))}>
                  <option value="">No SLA policy</option>
                  {options.slaPolicies.map((policy) => (<option key={policy.id} value={policy.id}>{policy.name}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Account</span>
                <select className={selectClassName} value={ticketForm.accountId} onChange={(event) => setTicketForm((current) => ({ ...current, accountId: event.target.value }))}>
                  <option value="">No linked account</option>
                  {options.accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Assignee</span>
                <select className={selectClassName} value={ticketForm.assigneeId} onChange={(event) => setTicketForm((current) => ({ ...current, assigneeId: event.target.value }))}>
                  <option value="">Unassigned</option>
                  {options.owners.map((owner) => (<option key={owner.id} value={owner.id}>{owner.displayName}</option>))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Description</span>
                <textarea className={textareaClassName} rows={3} value={ticketForm.description} onChange={(event) => setTicketForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">Create ticket</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ticket queue</CardTitle>
            <CardDescription>Tickets with status, priority, SLA, and assignment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">No tickets are currently visible for this role.</div>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={cn(
                    "w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50",
                    selectedId === ticket.id ? "border-primary bg-primary/5" : ""
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{ticket.status?.label ?? "Status missing"}</Badge>
                    <Badge variant="muted">{ticket.priority?.label ?? "Priority missing"}</Badge>
                    {ticket.sla.resolutionBreached || ticket.sla.firstResponseBreached ? <Badge variant="muted">SLA breached</Badge> : null}
                    {ticket.escalationStatus === "escalated" ? <Badge variant="muted">Escalated</Badge> : null}
                  </div>
                  <p className="mt-3 font-semibold">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{ticket.account?.name ?? "No account"} • {ticket.category?.label ?? "No category"}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Assignee {ticket.assignee?.displayName ?? "Unassigned"} • {ticket.messageCount} messages • {ticket.articleCount} articles
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <TicketDetailCard
          detail={detail}
          options={options}
          articles={articles?.articles ?? []}
          canEdit={canEdit}
          canMessage={canMessage}
          replyType={replyType}
          setReplyType={setReplyType}
          replyBody={replyBody}
          setReplyBody={setReplyBody}
          linkArticleId={linkArticleId}
          setLinkArticleId={setLinkArticleId}
          onUpdate={handleUpdateTicket}
          onAddMessage={handleAddMessage}
          onLinkArticle={handleLinkArticle}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge base</CardTitle>
            <CardDescription>Articles available for linking to tickets (placeholder library).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {articles && articles.articles.length > 0 ? (
              <ul className="space-y-2">
                {articles.articles.map((article) => (
                  <li key={article.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{article.title}</span>
                      {article.category ? <Badge variant="muted">{article.category.label}</Badge> : null}
                      <Badge variant="muted">{article.status}</Badge>
                    </div>
                    {article.summary ? <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No knowledge articles yet.</p>
            )}
            {canCreate ? (
              <form className="grid gap-2 sm:grid-cols-2" onSubmit={handleCreateArticle}>
                <Input className="sm:col-span-2" placeholder="Article title" value={articleForm.title} onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))} minLength={2} />
                <select className={selectClassName} value={articleForm.categoryKey} onChange={(event) => setArticleForm((current) => ({ ...current, categoryKey: event.target.value }))}>
                  <option value="">No category</option>
                  {options.knowledgeCategories.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
                <Input placeholder="Summary" value={articleForm.summary} onChange={(event) => setArticleForm((current) => ({ ...current, summary: event.target.value }))} />
                <Button type="submit" className="sm:col-span-2">Add article</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA policies</CardTitle>
            <CardDescription>Configured first-response and resolution targets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {options.slaPolicies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No SLA policies configured yet.</p>
            ) : (
              <ul className="space-y-2">
                {options.slaPolicies.map((policy) => (
                  <li key={policy.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{policy.name}</span>
                      {policy.priority ? <Badge variant="muted">{policy.priority.label}</Badge> : null}
                      {policy.isActive ? <Badge variant="muted">Active</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      First response {policy.firstResponseMinutes}m • Resolution {policy.resolutionMinutes}m
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface TicketDetailCardProps {
  detail: SupportTicketDetail | null;
  options: SupportTicketOptionsResponse;
  articles: SupportKnowledgeArticlesResponse["articles"];
  canEdit: boolean;
  canMessage: boolean;
  replyType: SupportTicketMessageType;
  setReplyType: React.Dispatch<React.SetStateAction<SupportTicketMessageType>>;
  replyBody: string;
  setReplyBody: React.Dispatch<React.SetStateAction<string>>;
  linkArticleId: string;
  setLinkArticleId: React.Dispatch<React.SetStateAction<string>>;
  onUpdate: (payload: UpdateSupportTicketRequestBody) => void;
  onAddMessage: (event: React.FormEvent) => void;
  onLinkArticle: (event: React.FormEvent) => void;
}

function TicketDetailCard({
  detail,
  options,
  articles,
  canEdit,
  canMessage,
  replyType,
  setReplyType,
  replyBody,
  setReplyBody,
  linkArticleId,
  setLinkArticleId,
  onUpdate,
  onAddMessage,
  onLinkArticle
}: TicketDetailCardProps) {
  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket detail</CardTitle>
          <CardDescription>Select a ticket to review SLA, conversation, and resolution.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">No ticket selected.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{detail.subject}</CardTitle>
        <CardDescription>
          {detail.status?.label ?? "No status"} • {detail.priority?.label ?? "No priority"} • {detail.category?.label ?? "No category"} • {detail.source?.label ?? "No source"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canEdit ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</span>
              <select className={selectClassName} value={detail.status?.key ?? ""} onChange={(event) => onUpdate({ statusKey: event.target.value })}>
                {options.statuses.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Priority</span>
              <select className={selectClassName} value={detail.priority?.key ?? ""} onChange={(event) => onUpdate({ priorityKey: event.target.value })}>
                {options.priorities.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Assignee</span>
              <select className={selectClassName} value={detail.assignee?.id ?? ""} onChange={(event) => onUpdate({ assigneeId: event.target.value || null })}>
                <option value="">Unassigned</option>
                {options.owners.map((owner) => (<option key={owner.id} value={owner.id}>{owner.displayName}</option>))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Escalation</span>
              <select className={selectClassName} value={detail.escalationStatus} onChange={(event) => onUpdate({ escalationStatus: event.target.value as UpdateSupportTicketRequestBody["escalationStatus"] })}>
                {["none", "pending", "escalated", "resolved"].map((value) => (<option key={value} value={value}>{value}</option>))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">SLA</p>
          {detail.sla.policy ? (
            <p className="mt-1 font-medium">{detail.sla.policy.name}</p>
          ) : (
            <p className="mt-1 text-muted-foreground">No SLA policy attached.</p>
          )}
          <p className="mt-1 text-muted-foreground">
            First response due {formatDateTime(detail.sla.firstResponseDueAt)}{" "}
            {detail.sla.firstResponseBreached ? <Badge variant="muted">Breached</Badge> : null}
          </p>
          <p className="mt-1 text-muted-foreground">
            Resolution due {formatDateTime(detail.sla.resolutionDueAt)}{" "}
            {detail.sla.resolutionBreached ? <Badge variant="muted">Breached</Badge> : null}
          </p>
        </div>

        {detail.description ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Description</p>
            <p className="mt-1 leading-6 text-muted-foreground">{detail.description}</p>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</dt>
            <dd className="font-medium">{detail.account?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contact</dt>
            <dd className="font-medium">{detail.contact?.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">CS account</dt>
            <dd className="font-medium">{detail.customerSuccessAccount?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Root cause</dt>
            <dd className="font-medium">{detail.rootCause ?? "—"}</dd>
          </div>
        </dl>

        {detail.resolutionNotes ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resolution notes</p>
            <p className="mt-1 leading-6 text-muted-foreground">{detail.resolutionNotes}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conversation ({detail.messages.length})</p>
          {detail.messages.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.messages.map((message) => (
                <li key={message.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{message.messageType === "internal_note" ? "Internal note" : "Customer reply"}</Badge>
                    <span className="text-xs text-muted-foreground">{message.author?.displayName ?? "System"} • {formatDateTime(message.createdAt)}</span>
                  </div>
                  <p className="mt-1 leading-6">{message.body}</p>
                </li>
              ))}
            </ul>
          )}
          {canMessage ? (
            <form className="mt-3 space-y-2" onSubmit={onAddMessage}>
              <select className={selectClassName} value={replyType} onChange={(event) => setReplyType(event.target.value as SupportTicketMessageType)}>
                <option value="internal_note">Internal note</option>
                <option value="customer_reply">Customer reply</option>
              </select>
              <textarea className={textareaClassName} rows={2} placeholder="Add a note or reply" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} />
              <Button type="submit">Add message</Button>
            </form>
          ) : null}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Linked articles ({detail.articles.length})</p>
          {detail.articles.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No linked articles.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {detail.articles.map((article) => (
                <li key={article.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{article.title}</span>
                  {article.category ? <Badge variant="muted">{article.category.label}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit && articles.length > 0 ? (
            <form className="mt-2 flex gap-2" onSubmit={onLinkArticle}>
              <select className={selectClassName} value={linkArticleId} onChange={(event) => setLinkArticleId(event.target.value)}>
                <option value="">Select article…</option>
                {articles.map((article) => (<option key={article.id} value={article.id}>{article.title}</option>))}
              </select>
              <Button type="submit" variant="outline">Link</Button>
            </form>
          ) : null}
        </div>

        {detail.aiPlaceholders.actions.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI placeholders</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.aiPlaceholders.actions.map((action) => (
                <Button key={action.key} variant="outline" size="sm" disabled title={action.description}>{action.label}</Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
