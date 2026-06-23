import { useEffect, useMemo, useState } from "react";
import type { CampaignListQuery, CampaignOptionsResponse, CampaignsResponse } from "@crm/types";
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

const defaultQuery: CampaignListQuery = {
  page: 1,
  pageSize: 12,
  sortBy: "updatedAt",
  sortOrder: "desc"
};

export function CampaignsPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel, settings } = useTenantConfig();
  const campaignLabel = getModuleLabel("campaigns", "singular");
  const campaignsLabel = getModuleLabel("campaigns");
  const [options, setOptions] = useState<CampaignOptionsResponse | null>(null);
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [query, setQuery] = useState<CampaignListQuery>(defaultQuery);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["campaigns.create", "campaigns.configure"]);
  const canEdit = hasAnyPermission(["campaigns.edit", "campaigns.assign", "campaigns.configure"]);
  const canDelete = hasAnyPermission(["campaigns.delete", "campaigns.configure"]);

  const activeFilterCount = useMemo(
    () => [query.search, query.status, query.type, query.channel, query.ownerId].filter(Boolean).length,
    [query]
  );

  const dashboardMetrics = useMemo(() => {
    const campaigns = data?.campaigns ?? [];

    return {
      activeCount: campaigns.filter((campaign) => campaign.status?.key === "active").length,
      plannedCount: campaigns.filter((campaign) => campaign.status?.key === "planned").length,
      scheduledBudget: campaigns.reduce((total, campaign) => total + (campaign.budgetAmount ?? 0), 0)
    };
  }, [data]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void (async () => {
      try {
        const response = await apiRequest<CampaignOptionsResponse>("/campaigns/options", {
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
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const response = await apiRequest<CampaignsResponse>(`/campaigns${buildQueryString(query)}`, {
          method: "GET",
          accessToken
        });
        setData(response);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, query]);

  function applyFilters() {
    setQuery((currentValue) => ({
      ...currentValue,
      page: 1,
      search: searchInput.trim() || undefined,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      channel: channelFilter || undefined,
      ownerId: ownerFilter || undefined
    }));
  }

  function resetFilters() {
    setSearchInput("");
    setStatusFilter("");
    setTypeFilter("");
    setChannelFilter("");
    setOwnerFilter("");
    setQuery(defaultQuery);
  }

  async function handleDelete(campaignId: string) {
    if (!accessToken || !window.confirm(`Soft delete this ${campaignLabel.toLowerCase()}?`)) {
      return;
    }

    setIsDeletingId(campaignId);
    setErrorMessage(null);

    try {
      await apiRequest(`/campaigns/${campaignId}`, {
        method: "DELETE",
        accessToken
      });
      const response = await apiRequest<CampaignsResponse>(`/campaigns${buildQueryString(query)}`, {
        method: "GET",
        accessToken
      });
      setData(response);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDeletingId(null);
    }
  }

  if (isLoading && !data) {
    return (
      <CrmLoadingState
        title={`Loading ${campaignsLabel.toLowerCase()}`}
        description="The page is fetching tenant-backed campaign filters, dashboard placeholders, and the live campaign list."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Campaign management foundation"
        title={`${campaignsLabel} now run on tenant-safe CRUD, configurable option sets, and member-aware execution planning.`}
        summary={`This workspace is the production-ready entry point for ${campaignLabel.toLowerCase()} planning, ownership, audience targeting, budget visibility, member orchestration, and placeholder AI-assisted marketing workflows.`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to="/campaigns/new">Create {campaignLabel}</Link>
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Visible campaigns"
              value={String(data?.pagination.total ?? 0)}
              description={`Tenant-scoped ${campaignsLabel.toLowerCase()} available under your current role.`}
            />
            <CrmMetricCard
              label="Applied filters"
              value={String(activeFilterCount)}
              description="Search, ownership, type, status, and channel filters all flow through the live API."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Find the right {campaignsLabel.toLowerCase()}</CardTitle>
            <CardDescription>
              Search and filter by status, type, channel, and owner while keeping pagination and sorting stable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Search</span>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${campaignsLabel.toLowerCase()} by name, description, or target audience`}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Status</span>
                <select
                  className={selectClassName}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  {options?.statuses.map((status) => (
                    <option key={status.id} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Type</span>
                <select
                  className={selectClassName}
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="">All types</option>
                  {options?.types.map((type) => (
                    <option key={type.id} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Channel</span>
                <select
                  className={selectClassName}
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value)}
                >
                  <option value="">All channels</option>
                  {options?.channels.map((channel) => (
                    <option key={channel.id} value={channel.key}>
                      {channel.label}
                    </option>
                  ))}
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
                  {pageSizeOptions.map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize} per page
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Owner</span>
                <select
                  className={selectClassName}
                  value={ownerFilter}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                >
                  <option value="">All owners</option>
                  {options?.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Sort by</span>
                <select
                  className={selectClassName}
                  value={query.sortBy ?? "updatedAt"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      page: 1,
                      sortBy: event.target.value as CampaignListQuery["sortBy"]
                    }))
                  }
                >
                  <option value="updatedAt">Updated</option>
                  <option value="createdAt">Created</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="startDate">Start date</option>
                  <option value="endDate">End date</option>
                  <option value="budget">Budget</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Button type="button" onClick={applyFilters}>
                Apply filters
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign dashboard placeholder</CardTitle>
              <CardDescription>
                This dashboard intentionally stays lightweight while the campaign schema, permissions, and routing become real.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active now</p>
                <p className="mt-2 font-display text-3xl font-semibold">{dashboardMetrics.activeCount}</p>
                <p className="mt-2 text-sm text-muted-foreground">Live campaign execution visible in the current result set.</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Planned next</p>
                <p className="mt-2 font-display text-3xl font-semibold">{dashboardMetrics.plannedCount}</p>
                <p className="mt-2 text-sm text-muted-foreground">Campaigns queued for launch and operational handoff.</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budget snapshot</p>
                <p className="mt-2 font-display text-3xl font-semibold">
                  {formatCurrencyAmount(dashboardMetrics.scheduledBudget, settings.currency)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Current visible budget total for planning conversations.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign calendar placeholder</CardTitle>
              <CardDescription>
                Cross-channel scheduling will land later, but the campaign date fields and UI slot are already ready for it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/60 p-6 text-sm leading-6 text-muted-foreground">
                Launch dates, end dates, and channel-level milestones are already stored in PostgreSQL. A later phase can layer a proper calendar view on top without changing the base data model.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-semibold">{campaignsLabel}</h3>
            <p className="text-sm text-muted-foreground">
              Budget, audience, member count, and placeholder AI visibility now live on each campaign record.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Page {data?.pagination.page ?? 1} of {data?.pagination.totalPages ?? 1}
          </p>
        </div>

        {data?.campaigns.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    {campaign.status ? <Badge>{campaign.status.label}</Badge> : null}
                    {campaign.type ? <Badge variant="muted">{campaign.type.label}</Badge> : null}
                    {campaign.channel ? <Badge variant="muted">{campaign.channel.label}</Badge> : null}
                  </div>
                  <CardTitle>{campaign.name}</CardTitle>
                  <CardDescription>
                    {campaign.description ?? `Owned by ${campaign.owner?.displayName ?? "an unassigned teammate"} with ${campaign.memberCount} members attached.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[1.25rem] bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Target audience</p>
                      <p className="mt-2 text-sm leading-6">{campaign.targetAudience ?? "Audience not captured yet."}</p>
                    </div>
                    <div className="rounded-[1.25rem] bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budget</p>
                      <p className="mt-2 text-sm leading-6">
                        {formatCurrencyAmount(campaign.budgetAmount, settings.currency)}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Window</p>
                      <p className="mt-2 text-sm leading-6">
                        {formatDateOnly(campaign.startDate)} to {formatDateOnly(campaign.endDate)}
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Execution counts</p>
                      <p className="mt-2 text-sm leading-6">
                        {campaign.memberCount} members, {campaign.taskCount} tasks, {campaign.activityCount} activities
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>Owner {campaign.owner?.displayName ?? "Unassigned"}</span>
                    <span>Updated {formatShortDate(campaign.updatedAt)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild variant="outline">
                      <Link to={`/campaigns/${campaign.id}`}>View detail</Link>
                    </Button>
                    {canEdit ? (
                      <Button asChild>
                        <Link to={`/campaigns/${campaign.id}/edit`}>Edit {campaignLabel}</Link>
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="outline"
                        disabled={isDeletingId === campaign.id}
                        onClick={() => void handleDelete(campaign.id)}
                      >
                        {isDeletingId === campaign.id ? "Deleting..." : "Soft delete"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <CrmEmptyState
            title={`No ${campaignsLabel.toLowerCase()} match the current view.`}
            description="Create your first campaign or reset the filters to see records in this tenant workspace."
            action={
              canCreate ? (
                <Button asChild>
                  <Link to="/campaigns/new">Create {campaignLabel}</Link>
                </Button>
              ) : null
            }
          />
        )}
      </section>
    </div>
  );
}
