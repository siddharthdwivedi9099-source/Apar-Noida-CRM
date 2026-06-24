import { useEffect, useMemo, useState } from "react";
import type {
  CreatePresalesRequestRequestBody,
  PresalesPriority,
  PresalesRequestDetail,
  PresalesRequestOptionsResponse,
  PresalesRequestsResponse
} from "@crm/types";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { ListToolbar } from "@/components/crm/list-toolbar";
import { apiRequest } from "@/lib/api-client";
import { formatDateOnly, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const PRIORITIES: PresalesPriority[] = ["low", "medium", "high", "urgent"];

interface CreateFormState {
  title: string;
  typeKey: string;
  statusKey: string;
  priority: PresalesPriority;
  opportunityId: string;
  accountId: string;
  ownerId: string;
  assigneeId: string;
  dueDate: string;
  summary: string;
  technicalRequirements: string;
  proposalContent: string;
}

function buildInitialFormState(options: PresalesRequestOptionsResponse | null): CreateFormState {
  return {
    title: "",
    typeKey: options?.requestTypes.find((type) => type.isDefault)?.key ?? options?.requestTypes[0]?.key ?? "",
    statusKey: options?.statuses.find((status) => status.isDefault)?.key ?? options?.statuses[0]?.key ?? "",
    priority: "medium",
    opportunityId: "",
    accountId: "",
    ownerId: "",
    assigneeId: "",
    dueDate: "",
    summary: "",
    technicalRequirements: "",
    proposalContent: ""
  };
}

export function PresalesPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [options, setOptions] = useState<PresalesRequestOptionsResponse | null>(null);
  const [data, setData] = useState<PresalesRequestsResponse | null>(null);
  const [detail, setDetail] = useState<PresalesRequestDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<CreateFormState>(buildInitialFormState(null));
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["presales.create", "presales.configure"]);

  const requests = useMemo(() => data?.requests ?? [], [data?.requests]);

  // Client-side search / filter / sort over the loaded presales request list.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "due" | "updated">("updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = requests.filter((request) => {
      if (statusFilter && request.status?.key !== statusFilter) return false;
      if (priorityFilter && request.priority !== priorityFilter) return false;
      if (term && !request.title.toLowerCase().includes(term)) return false;
      return true;
    });
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (a == null || b == null) return 0;
      if (sortBy === "title") return a.title.localeCompare(b.title) * direction;
      if (sortBy === "due") return (new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()) * direction;
      return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
    });
  }, [requests, search, statusFilter, priorityFilter, sortBy, sortOrder]);
  const dashboard = useMemo(() => {
    const rfpRfi = requests.filter((request) => ["rfp", "rfi"].includes(request.type?.key ?? "")).length;
    const proposals = requests.filter((request) => request.type?.key === "proposal").length;
    const open = requests.filter((request) => !["won", "lost", "cancelled"].includes(request.status?.key ?? "")).length;
    return { total: data?.pagination.total ?? requests.length, rfpRfi, proposals, open };
  }, [requests, data?.pagination.total]);

  async function loadList() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, listResponse] = await Promise.all([
        apiRequest<PresalesRequestOptionsResponse>("/presales/options", { method: "GET", accessToken }),
        apiRequest<PresalesRequestsResponse>("/presales?pageSize=100", { method: "GET", accessToken })
      ]);
      setOptions(optionsResponse);
      setData(listResponse);
      setFormState((current) => (current.typeKey ? current : buildInitialFormState(optionsResponse)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [accessToken]);

  useEffect(() => {
    if (requests.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) =>
      current && requests.some((request) => request.id === current) ? current : requests[0].id
    );
  }, [requests]);

  useEffect(() => {
    if (!accessToken || !selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    apiRequest<{ request: PresalesRequestDetail }>(`/presales/${selectedId}`, { method: "GET", accessToken })
      .then((response) => {
        if (!cancelled) {
          setDetail(response.request);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setFormError(null);

    const payload: CreatePresalesRequestRequestBody = {
      title: formState.title.trim(),
      typeKey: formState.typeKey,
      statusKey: formState.statusKey,
      priority: formState.priority,
      opportunityId: formState.opportunityId || null,
      accountId: formState.accountId || null,
      ownerId: formState.ownerId || null,
      assigneeId: formState.assigneeId || null,
      dueDate: formState.dueDate || null,
      summary: formState.summary.trim() || null,
      technicalRequirements: formState.technicalRequirements.trim() || null,
      proposalContent: formState.proposalContent.trim() || null
    };

    try {
      const response = await apiRequest<{ request: PresalesRequestDetail }>("/presales", {
        method: "POST",
        accessToken,
        body: payload
      });
      setIsCreating(false);
      setFormState(buildInitialFormState(options));
      await loadList();
      setSelectedId(response.request.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title="Loading presales workspace"
        description="Presales intake, RFP/RFI tracker, and proposal workspace are loading from the tenant-safe API."
      />
    );
  }

  if (!data || !options) {
    return (
      <CrmEmptyState
        title="The presales workspace could not be loaded."
        description={errorMessage ?? "The current tenant session could not load presales requests."}
        action={
          <Button variant="outline" onClick={() => void loadList()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Presales"
        title="Presales intake, RFP/RFI tracking, and proposal collaboration now run from one workspace."
        summary="Presales requests link to opportunities and accounts while keeping demo, RFP/RFI, proposal, and technical-validation work, requirements, and compliance status in one tenant-aware queue."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating((current) => !current)}>
              {isCreating ? "Close form" : "New presales request"}
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Requests" value={String(dashboard.total)} description="Presales requests in the queue." />
            <CrmMetricCard label="RFP / RFI" value={String(dashboard.rfpRfi)} description="Active RFP and RFI requests." />
            <CrmMetricCard label="Open" value={String(dashboard.open)} description="Requests not yet won, lost, or cancelled." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {isCreating && canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New presales request</CardTitle>
            <CardDescription>Capture intake details and link the request to an opportunity.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Request title</span>
                <Input
                  value={formState.title}
                  onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                  required
                  minLength={2}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Request type</span>
                <select
                  className={selectClassName}
                  value={formState.typeKey}
                  onChange={(event) => setFormState((current) => ({ ...current, typeKey: event.target.value }))}
                >
                  {options.requestTypes.map((type) => (
                    <option key={type.id} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Status</span>
                <select
                  className={selectClassName}
                  value={formState.statusKey}
                  onChange={(event) => setFormState((current) => ({ ...current, statusKey: event.target.value }))}
                >
                  {options.statuses.map((status) => (
                    <option key={status.id} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Priority</span>
                <select
                  className={selectClassName}
                  value={formState.priority}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, priority: event.target.value as PresalesPriority }))
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Due date</span>
                <Input
                  type="date"
                  value={formState.dueDate}
                  onChange={(event) => setFormState((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Linked opportunity</span>
                <select
                  className={selectClassName}
                  value={formState.opportunityId}
                  onChange={(event) => setFormState((current) => ({ ...current, opportunityId: event.target.value }))}
                >
                  <option value="">No linked opportunity</option>
                  {options.opportunities.map((opportunity) => (
                    <option key={opportunity.id} value={opportunity.id}>
                      {opportunity.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Account</span>
                <select
                  className={selectClassName}
                  value={formState.accountId}
                  onChange={(event) => setFormState((current) => ({ ...current, accountId: event.target.value }))}
                >
                  <option value="">No linked account</option>
                  {options.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Owner</span>
                <select
                  className={selectClassName}
                  value={formState.ownerId}
                  onChange={(event) => setFormState((current) => ({ ...current, ownerId: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Presales assignee</span>
                <select
                  className={selectClassName}
                  value={formState.assigneeId}
                  onChange={(event) => setFormState((current) => ({ ...current, assigneeId: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Summary</span>
                <textarea
                  className={textareaClassName}
                  rows={2}
                  value={formState.summary}
                  onChange={(event) => setFormState((current) => ({ ...current, summary: event.target.value }))}
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Technical requirements</span>
                <textarea
                  className={textareaClassName}
                  rows={3}
                  value={formState.technicalRequirements}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, technicalRequirements: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Proposal workspace</span>
                <textarea
                  className={textareaClassName}
                  rows={4}
                  value={formState.proposalContent}
                  onChange={(event) => setFormState((current) => ({ ...current, proposalContent: event.target.value }))}
                />
              </label>
              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">Create request</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Presales request queue</CardTitle>
            <CardDescription>Demo, RFP/RFI, proposal, and technical-validation requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ListToolbar
              search={search}
              onSearch={setSearch}
              searchPlaceholder="Search by request title..."
              filters={[
                { label: "statuses", value: statusFilter, onChange: setStatusFilter, options: options.statuses.map((s) => ({ value: s.key, label: s.label })) },
                { label: "priorities", value: priorityFilter, onChange: setPriorityFilter, options: PRIORITIES.map((p) => ({ value: p, label: p })) }
              ]}
              sortBy={sortBy}
              onSortBy={(value) => setSortBy(value as typeof sortBy)}
              sortOptions={[
                { value: "updated", label: "Recently updated" },
                { value: "title", label: "Title" },
                { value: "due", label: "Due date" }
              ]}
              sortOrder={sortOrder}
              onSortOrder={setSortOrder}
              resultCount={visibleRequests.length}
              totalCount={requests.length}
              noun="requests"
              onReset={() => {
                setSearch("");
                setStatusFilter("");
                setPriorityFilter("");
                setSortBy("updated");
                setSortOrder("desc");
              }}
            />
            {visibleRequests.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                {requests.length === 0 ? "No presales requests are currently visible for this role." : "No requests match the current filters."}
              </div>
            ) : (
              visibleRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedId(request.id)}
                  className={cn(
                    "w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50",
                    selectedId === request.id ? "border-primary bg-primary/5" : ""
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{request.type?.label ?? "Type missing"}</Badge>
                    <Badge variant="muted">{request.status?.label ?? "Status missing"}</Badge>
                    <Badge variant="muted">{request.priority}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{request.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.opportunity ? request.opportunity.name : "No linked opportunity"} •{" "}
                    {request.account ? request.account.name : "No account"}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Assignee {request.assignee?.displayName ?? "Unassigned"} • {request.requirementCount} requirements •{" "}
                    {request.gapRequirementCount} gaps • Due {formatDateOnly(request.dueDate)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <PresalesDetailCard detail={detail} />
      </section>
    </div>
  );
}

function PresalesDetailCard({ detail }: { detail: PresalesRequestDetail | null }) {
  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Request workspace</CardTitle>
          <CardDescription>Select a presales request to review requirements and proposal content.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            No presales request selected.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{detail.title}</CardTitle>
        <CardDescription>
          {detail.type?.label ?? "No type"} • {detail.status?.label ?? "No status"} • {detail.priority}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Opportunity</dt>
            <dd className="font-medium">
              {detail.opportunity ? (
                <Link className="text-primary hover:underline" to={`/opportunities/${detail.opportunity.id}`}>
                  {detail.opportunity.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Due date</dt>
            <dd className="font-medium">{formatDateOnly(detail.dueDate)}</dd>
          </div>
        </dl>

        {detail.summary ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Summary</p>
            <p className="mt-1 leading-6 text-muted-foreground">{detail.summary}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            RFP / RFI requirement tracker ({detail.requirements.length})
          </p>
          {detail.requirements.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No requirements captured yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.requirements.map((requirement) => (
                <li key={requirement.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{requirement.label}</span>
                    <Badge variant="muted">{requirement.category}</Badge>
                    <Badge variant="muted">{requirement.complianceStatus}</Badge>
                    <Badge variant="muted">{requirement.priority}</Badge>
                  </div>
                  {requirement.requirement ? (
                    <p className="mt-1 text-muted-foreground">{requirement.requirement}</p>
                  ) : null}
                  {requirement.response ? (
                    <p className="mt-1 text-foreground">Response: {requirement.response}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {detail.proposalContent ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proposal workspace</p>
            <p className="mt-1 whitespace-pre-wrap leading-6 text-muted-foreground">{detail.proposalContent}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="rounded-[1rem] border border-dashed border-border/60 p-3 text-muted-foreground">
            {detail.demoCalendarPlaceholder.message}
          </div>
          <div className="rounded-[1rem] border border-dashed border-border/60 p-3 text-muted-foreground">
            {detail.solutionRepositoryPlaceholder.message}
          </div>
        </div>

        {detail.aiPlaceholders.actions.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI placeholders</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.aiPlaceholders.actions.map((action) => (
                <Button key={action.key} variant="outline" size="sm" disabled title={action.description}>
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
