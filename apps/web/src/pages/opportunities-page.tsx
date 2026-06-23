import { useEffect, useMemo, useState } from "react";
import type {
  OpportunityDashboardResponse,
  OpportunityListQuery,
  OpportunityOptionsResponse,
  OpportunitiesResponse,
  OpportunityPipelineScope
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import {
  buildQueryString,
  formatCurrencyAmount,
  formatDateOnly,
  formatShortDate,
  pageSizeOptions,
  selectClassName
} from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link } from "react-router-dom";

type PipelineViewMode = "list" | "kanban";

const baseQuery: OpportunityListQuery = {
  page: 1,
  pageSize: 12,
  stalledDays: 30,
  sortBy: "expectedCloseDate",
  sortOrder: "asc"
};

function getScopeLabel(scope: OpportunityPipelineScope) {
  switch (scope) {
    case "mine":
      return "My pipeline";
    case "team":
      return "Team pipeline";
    case "all":
      return "All opportunities";
  }
}

export function OpportunitiesPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const opportunityLabel = getModuleLabel("opportunities", "singular");
  const opportunitiesLabel = getModuleLabel("opportunities");
  const [options, setOptions] = useState<OpportunityOptionsResponse | null>(null);
  const [listData, setListData] = useState<OpportunitiesResponse | null>(null);
  const [kanbanData, setKanbanData] = useState<OpportunitiesResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<OpportunityDashboardResponse | null>(null);
  const [query, setQuery] = useState<OpportunityListQuery>(baseQuery);
  const [viewMode, setViewMode] = useState<PipelineViewMode>("list");
  const [searchInput, setSearchInput] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<OpportunityPipelineScope>("mine");
  const [stalledDaysInput, setStalledDaysInput] = useState("30");
  const [isInitializedScope, setIsInitializedScope] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isKanbanLoading, setIsKanbanLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [draggingOpportunityId, setDraggingOpportunityId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const canCreate = hasAnyPermission(["opportunities.create", "opportunities.configure"]);
  const canEdit = hasAnyPermission(["opportunities.edit", "opportunities.assign", "opportunities.configure"]);
  const canDelete = hasAnyPermission(["opportunities.delete", "opportunities.configure"]);
  const canUpdateStage = hasAnyPermission([
    "opportunities.edit",
    "opportunities.approve",
    "opportunities.configure",
    "opportunities.manage_workflow"
  ]);

  const activeFilterCount = useMemo(
    () =>
      [query.search, query.stage, query.source, query.outcomeStatus, query.ownerId, query.accountId, query.contactId]
        .filter(Boolean)
        .length + (query.scope && query.scope !== "mine" ? 1 : 0),
    [query]
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void (async () => {
      try {
        const response = await apiRequest<OpportunityOptionsResponse>("/opportunities/options", {
          method: "GET",
          accessToken
        });
        setOptions(response);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (!options || isInitializedScope) {
      return;
    }

    const nextScope = options.availableScopes.includes("all") ? "all" : options.availableScopes[0] ?? "mine";
    setScopeFilter(nextScope);
    setQuery((currentValue) => ({
      ...currentValue,
      scope: nextScope
    }));
    setIsInitializedScope(true);
  }, [isInitializedScope, options]);

  useEffect(() => {
    if (!accessToken || !isInitializedScope) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const [listResponse, dashboardResponse] = await Promise.all([
          apiRequest<OpportunitiesResponse>(`/opportunities${buildQueryString(query)}`, {
            method: "GET",
            accessToken
          }),
          apiRequest<OpportunityDashboardResponse>(`/opportunities/dashboard${buildQueryString(query)}`, {
            method: "GET",
            accessToken
          })
        ]);
        setListData(listResponse);
        setDashboardData(dashboardResponse);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, isInitializedScope, query, refreshToken]);

  useEffect(() => {
    if (!accessToken || !isInitializedScope) {
      return;
    }

    setIsKanbanLoading(true);

    void (async () => {
      try {
        const response = await apiRequest<OpportunitiesResponse>(
          `/opportunities${buildQueryString({
            ...query,
            page: 1,
            pageSize: 200,
            sortBy: "expectedCloseDate",
            sortOrder: "asc"
          })}`,
          {
            method: "GET",
            accessToken
          }
        );
        setKanbanData(response);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsKanbanLoading(false);
      }
    })();
  }, [accessToken, isInitializedScope, query, refreshToken]);

  const kanbanColumns = useMemo(() => {
    const opportunities = kanbanData?.opportunities ?? [];
    const grouped = new Map<string, typeof opportunities>();

    for (const stage of options?.stages ?? []) {
      grouped.set(stage.key, []);
    }

    for (const opportunity of opportunities) {
      const stageKey = opportunity.stage?.key ?? "unassigned";
      const existing = grouped.get(stageKey) ?? [];
      existing.push(opportunity);
      grouped.set(stageKey, existing);
    }

    return grouped;
  }, [kanbanData?.opportunities, options?.stages]);

  const stageDistributionMax = useMemo(
    () =>
      Math.max(
        1,
        ...(dashboardData?.stageDistribution.map((distribution) => distribution.opportunityCount) ?? [1])
      ),
    [dashboardData?.stageDistribution]
  );

  function applyFilters() {
    setQuery((currentValue) => ({
      ...currentValue,
      page: 1,
      search: searchInput.trim() || undefined,
      stage: stageFilter || undefined,
      source: sourceFilter || undefined,
      outcomeStatus: outcomeFilter || undefined,
      ownerId: ownerFilter || undefined,
      accountId: accountFilter || undefined,
      contactId: contactFilter || undefined,
      scope: scopeFilter,
      stalledDays: stalledDaysInput ? Number(stalledDaysInput) : 30
    }));
  }

  function resetFilters() {
    const nextScope = options?.availableScopes.includes("all") ? "all" : options?.availableScopes[0] ?? "mine";
    setSearchInput("");
    setStageFilter("");
    setSourceFilter("");
    setOutcomeFilter("");
    setOwnerFilter("");
    setAccountFilter("");
    setContactFilter("");
    setScopeFilter(nextScope);
    setStalledDaysInput("30");
    setQuery({
      ...baseQuery,
      scope: nextScope
    });
  }

  async function handleDelete(opportunityId: string) {
    if (!accessToken || !window.confirm(`Soft delete this ${opportunityLabel.toLowerCase()}?`)) {
      return;
    }

    setIsDeletingId(opportunityId);
    setErrorMessage(null);

    try {
      await apiRequest(`/opportunities/${opportunityId}`, {
        method: "DELETE",
        accessToken
      });
      setRefreshToken((currentValue) => currentValue + 1);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDeletingId(null);
    }
  }

  async function handleStageDrop(opportunityId: string, stageKey: string, currentStageKey: string | null) {
    if (!accessToken || !canUpdateStage || !stageKey || stageKey === currentStageKey) {
      return;
    }

    setErrorMessage(null);

    try {
      await apiRequest(`/opportunities/${opportunityId}`, {
        method: "PATCH",
        accessToken,
        body: {
          stageKey
        }
      });
      setRefreshToken((currentValue) => currentValue + 1);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDraggingOpportunityId(null);
    }
  }

  if ((isLoading && !listData) || !isInitializedScope) {
    return (
      <CrmLoadingState
        title={`Loading ${opportunitiesLabel.toLowerCase()}`}
        description="The page is fetching tenant-backed opportunity filters, dashboard metrics, and the live sales pipeline."
      />
    );
  }

  const visibleOpportunities = listData?.opportunities ?? [];

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Sales pipeline workspace"
        title={`${opportunitiesLabel} now run on tenant-safe CRUD, configurable stages, and audited pipeline progression.`}
        summary={`This workspace combines ${opportunityLabel.toLowerCase()} creation, dashboard metrics, list filtering, role-aware stage movement, and a Kanban pipeline view backed by the opportunity engine.`}
        actions={
          <>
            {canCreate ? (
              <Button asChild>
                <Link to="/opportunities/new">Create {opportunityLabel}</Link>
              </Button>
            ) : null}
            <Button variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}>
              List view
            </Button>
            <Button variant={viewMode === "kanban" ? "default" : "outline"} onClick={() => setViewMode("kanban")}>
              Kanban view
            </Button>
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Visible opportunities"
              value={String(dashboardData?.visibleCount ?? 0)}
              description={`Tenant-scoped ${opportunitiesLabel.toLowerCase()} currently visible under ${getScopeLabel(query.scope ?? "mine").toLowerCase()}.`}
            />
            <CrmMetricCard
              label="Applied filters"
              value={String(activeFilterCount)}
              description="Search, scope, account, contact, source, stage, and owner filters all flow through the live API."
            />
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-4">
        <CrmMetricCard
          label="Pipeline value"
          value={formatCurrencyAmount(dashboardData?.pipelineValue ?? 0)}
          description="Sum of open opportunity value across the current filtered scope."
        />
        <CrmMetricCard
          label="Closing this month"
          value={`${dashboardData?.closingThisMonthCount ?? 0} deals`}
          description={formatCurrencyAmount(dashboardData?.closingThisMonthValue ?? 0)}
        />
        <CrmMetricCard
          label="Stalled deals"
          value={`${dashboardData?.stalledDealsCount ?? 0} deals`}
          description={`No stage movement within the last ${query.stalledDays ?? 30} days.`}
        />
        <CrmMetricCard
          label="Current scope"
          value={getScopeLabel(dashboardData?.scope ?? query.scope ?? "mine")}
          description="Switch between personal, team, and tenant-wide pipeline views when your role allows it."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Filter the pipeline</CardTitle>
            <CardDescription>
              Narrow the sales workspace by stage, source, outcome, ownership, relationship links, and scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Search</span>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${opportunitiesLabel.toLowerCase()} by name, account, contact, competitor, or next step`}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Pipeline scope</span>
                <select
                  className={selectClassName}
                  value={scopeFilter}
                  onChange={(event) => setScopeFilter(event.target.value as OpportunityPipelineScope)}
                >
                  {options?.availableScopes.map((scope) => (
                    <option key={scope} value={scope}>
                      {getScopeLabel(scope)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Stalled days</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={stalledDaysInput}
                  onChange={(event) => setStalledDaysInput(event.target.value)}
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium">Stage</span>
                <select className={selectClassName} value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                  <option value="">All stages</option>
                  {options?.stages.map((stage) => (
                    <option key={stage.id} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Source</span>
                <select className={selectClassName} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                  <option value="">All sources</option>
                  {options?.sources.map((source) => (
                    <option key={source.id} value={source.key}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Outcome</span>
                <select
                  className={selectClassName}
                  value={outcomeFilter}
                  onChange={(event) => setOutcomeFilter(event.target.value)}
                >
                  <option value="">All outcomes</option>
                  {options?.outcomeStatuses.map((status) => (
                    <option key={status.id} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium">Owner</span>
                <select className={selectClassName} value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                  <option value="">All owners</option>
                  {options?.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Account</span>
                <select
                  className={selectClassName}
                  value={accountFilter}
                  onChange={(event) => setAccountFilter(event.target.value)}
                >
                  <option value="">All accounts</option>
                  {options?.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Contact</span>
                <select
                  className={selectClassName}
                  value={contactFilter}
                  onChange={(event) => setContactFilter(event.target.value)}
                >
                  <option value="">All contacts</option>
                  {options?.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium">Sort by</span>
                <select
                  className={selectClassName}
                  value={query.sortBy ?? "expectedCloseDate"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      sortBy: event.target.value as NonNullable<OpportunityListQuery["sortBy"]>
                    }))
                  }
                >
                  <option value="expectedCloseDate">Expected close</option>
                  <option value="name">Name</option>
                  <option value="stage">Stage</option>
                  <option value="amount">Amount</option>
                  <option value="probability">Probability</option>
                  <option value="owner">Owner</option>
                  <option value="account">Account</option>
                  <option value="updatedAt">Updated at</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Sort order</span>
                <select
                  className={selectClassName}
                  value={query.sortOrder ?? "asc"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      sortOrder: event.target.value as NonNullable<OpportunityListQuery["sortOrder"]>
                    }))
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Page size</span>
                <select
                  className={selectClassName}
                  value={String(query.pageSize ?? 12)}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      page: 1,
                      pageSize: Number(event.target.value)
                    }))
                  }
                >
                  {pageSizeOptions.map((optionValue) => (
                    <option key={optionValue} value={optionValue}>
                      {optionValue}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={applyFilters}>Apply filters</Button>
              <Button variant="outline" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stage distribution</CardTitle>
            <CardDescription>
              Stage totals, value distribution, and placeholder forecasting guidance for the current scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(dashboardData?.stageDistribution.length ?? 0) === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No opportunity stages match the current filters.
              </div>
            ) : (
              dashboardData?.stageDistribution.map((distribution) => (
                <div key={distribution.stage?.id ?? distribution.stage?.key ?? "missing-stage"} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {distribution.stage ? <Badge>{distribution.stage.label}</Badge> : <Badge variant="muted">Missing stage</Badge>}
                      <span>{distribution.opportunityCount} deals</span>
                    </div>
                    <span className="text-muted-foreground">{formatCurrencyAmount(distribution.totalAmount)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-secondary/60">
                    <div
                      className="h-3 rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.max(
                          8,
                          Math.round((distribution.opportunityCount / stageDistributionMax) * 100)
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ))
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Forecast placeholder</p>
                <p className="mt-2 text-sm leading-6">{dashboardData?.forecastPlaceholder.message}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deal risk placeholder</p>
                <p className="mt-2 text-sm leading-6">{dashboardData?.dealRiskPlaceholder.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {viewMode === "list" ? (
        <Card>
          <CardHeader>
            <CardTitle>{opportunitiesLabel}</CardTitle>
            <CardDescription>
              Review opportunity value, stage, relationship linkage, and next-step context in a sortable list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleOpportunities.length === 0 ? (
              <CrmEmptyState
                title={`No ${opportunitiesLabel.toLowerCase()} match the current filters`}
                description="Adjust the pipeline filters, switch scope, or create a new opportunity to populate the sales workspace."
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link to="/opportunities/new">Create {opportunityLabel}</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              visibleOpportunities.map((opportunity) => (
                <div key={opportunity.id} className="rounded-[1.5rem] border border-border/70 bg-background/85 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {opportunity.stage ? <Badge>{opportunity.stage.label}</Badge> : null}
                        {opportunity.outcomeStatus ? <Badge variant="muted">{opportunity.outcomeStatus.label}</Badge> : null}
                        <p className="font-display text-xl font-semibold">{opportunity.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {opportunity.account?.name ?? "No account linked"}
                        {opportunity.primaryContact ? ` • ${opportunity.primaryContact.fullName}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-semibold">{formatCurrencyAmount(opportunity.amount)}</p>
                      <p className="text-sm text-muted-foreground">{opportunity.probability ?? 0}% probability</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <div className="rounded-[1.25rem] bg-secondary/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected close</p>
                      <p className="mt-2 font-semibold">{formatDateOnly(opportunity.expectedCloseDate)}</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-secondary/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source</p>
                      <p className="mt-2 font-semibold">{opportunity.source?.label ?? "Not set"}</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-secondary/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
                      <p className="mt-2 font-semibold">{opportunity.owner?.displayName ?? "Unassigned"}</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-secondary/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last stage move</p>
                      <p className="mt-2 font-semibold">{formatShortDate(opportunity.lastStageChangedAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">Next step:</span>{" "}
                        {opportunity.nextStep ?? "No next step recorded yet."}
                      </p>
                      <p className="mt-2">
                        <span className="font-medium text-foreground">Competitor:</span>{" "}
                        {opportunity.competitor ?? "No competitor tracked"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="outline" asChild>
                        <Link to={`/opportunities/${opportunity.id}`}>Open {opportunityLabel}</Link>
                      </Button>
                      {canEdit ? (
                        <Button asChild>
                          <Link to={`/opportunities/${opportunity.id}/edit`}>Edit</Link>
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="outline"
                          disabled={isDeletingId === opportunity.id}
                          onClick={() => void handleDelete(opportunity.id)}
                        >
                          {isDeletingId === opportunity.id ? "Deleting..." : "Delete"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}

            {listData ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-secondary/40 p-4 text-sm">
                <p>
                  Page {listData.pagination.page} of {listData.pagination.totalPages} • {listData.pagination.total} total{" "}
                  {opportunitiesLabel.toLowerCase()}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    disabled={!listData.pagination.hasPreviousPage}
                    onClick={() =>
                      setQuery((currentValue) => ({
                        ...currentValue,
                        page: Math.max(1, (currentValue.page ?? 1) - 1)
                      }))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!listData.pagination.hasNextPage}
                    onClick={() =>
                      setQuery((currentValue) => ({
                        ...currentValue,
                        page: (currentValue.page ?? 1) + 1
                      }))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Kanban pipeline</CardTitle>
            <CardDescription>
              Drag opportunities between stages to update pipeline progression. Every stage change is audit logged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isKanbanLoading && !kanbanData ? (
              <CrmLoadingState
                title="Loading pipeline columns"
                description="Fetching opportunity cards and stage groupings for the Kanban board."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
                {options?.stages.map((stage) => {
                  const stageOpportunities = kanbanColumns.get(stage.key) ?? [];
                  const stageAmount = stageOpportunities.reduce((total, opportunity) => total + (opportunity.amount ?? 0), 0);

                  return (
                    <div
                      key={stage.id}
                      className="rounded-[1.5rem] border border-border/70 bg-background/85 p-4 shadow-sm"
                      onDragOver={(event) => {
                        if (canUpdateStage) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();

                        if (!draggingOpportunityId) {
                          return;
                        }

                        const currentOpportunity = (kanbanData?.opportunities ?? []).find(
                          (opportunity) => opportunity.id === draggingOpportunityId
                        );

                        void handleStageDrop(draggingOpportunityId, stage.key, currentOpportunity?.stage?.key ?? null);
                      }}
                    >
                      <div className="mb-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge>{stage.label}</Badge>
                          <span className="text-sm text-muted-foreground">{stageOpportunities.length} deals</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{formatCurrencyAmount(stageAmount)}</p>
                      </div>

                      <div className="space-y-3">
                        {stageOpportunities.length === 0 ? (
                          <div className="rounded-[1.25rem] border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                            No opportunities in this stage.
                          </div>
                        ) : (
                          stageOpportunities.map((opportunity) => (
                            <div
                              key={opportunity.id}
                              draggable={canUpdateStage}
                              onDragStart={() => setDraggingOpportunityId(opportunity.id)}
                              onDragEnd={() => setDraggingOpportunityId(null)}
                              className="cursor-grab rounded-[1.25rem] border border-border/60 bg-secondary/35 p-4 shadow-sm active:cursor-grabbing"
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  {opportunity.outcomeStatus ? <Badge variant="muted">{opportunity.outcomeStatus.label}</Badge> : null}
                                  <Link to={`/opportunities/${opportunity.id}`} className="font-semibold hover:underline">
                                    {opportunity.name}
                                  </Link>
                                </div>
                                <p className="text-sm text-muted-foreground">{opportunity.account?.name ?? "No account linked"}</p>
                                <p className="font-display text-xl font-semibold">{formatCurrencyAmount(opportunity.amount)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {opportunity.probability ?? 0}% probability • {formatDateOnly(opportunity.expectedCloseDate)}
                                </p>
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {opportunity.nextStep ?? "No next step recorded yet."}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
