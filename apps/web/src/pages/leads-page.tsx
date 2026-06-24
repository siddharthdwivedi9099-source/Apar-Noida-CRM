import { useEffect, useMemo, useState } from "react";
import type { LeadListQuery, LeadOptionsResponse, LeadsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { buildQueryString, formatDateTime, pageSizeOptions, selectClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link } from "react-router-dom";

const defaultQuery: LeadListQuery = {
  page: 1,
  pageSize: 12,
  sortBy: "updatedAt",
  sortOrder: "desc"
};

export function LeadsPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const leadLabel = getModuleLabel("leads", "singular");
  const leadsLabel = getModuleLabel("leads");
  const [options, setOptions] = useState<LeadOptionsResponse | null>(null);
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [query, setQuery] = useState<LeadListQuery>(defaultQuery);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [leadForFilter, setLeadForFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["leads.create", "leads.configure"]);
  const canEdit = hasAnyPermission(["leads.edit", "leads.configure"]);
  const canDelete = hasAnyPermission(["leads.delete", "leads.configure"]);

  const activeFilterCount = useMemo(
    () => [query.search, query.status, query.source, query.ownerId].filter(Boolean).length,
    [query]
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void (async () => {
      try {
        const response = await apiRequest<LeadOptionsResponse>("/leads/options", {
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
        const response = await apiRequest<LeadsResponse>(`/leads${buildQueryString(query)}`, {
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
      source: sourceFilter || undefined,
      ownerId: ownerFilter || undefined,
      leadFor: leadForFilter || undefined,
      product: productFilter || undefined
    }));
  }

  function resetFilters() {
    setSearchInput("");
    setStatusFilter("");
    setSourceFilter("");
    setOwnerFilter("");
    setLeadForFilter("");
    setProductFilter("");
    setQuery(defaultQuery);
  }

  async function handleDelete(leadId: string) {
    if (!accessToken || !window.confirm(`Soft delete this ${leadLabel.toLowerCase()}?`)) {
      return;
    }

    setIsDeletingId(leadId);
    setErrorMessage(null);

    try {
      await apiRequest(`/leads/${leadId}`, {
        method: "DELETE",
        accessToken
      });
      const response = await apiRequest<LeadsResponse>(`/leads${buildQueryString(query)}`, {
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

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Core CRM foundation"
        title={`${leadsLabel} now run on tenant-safe CRUD, filters, assignment, notes, and activities.`}
        summary={`This workspace is the production-ready entry point for ${leadLabel.toLowerCase()} intake, qualification visibility, source tracking, ownership handoff, and timeline capture.`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to="/leads/new">Create {leadLabel}</Link>
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Visible records"
              value={String(data?.pagination.total ?? 0)}
              description={`Tenant-scoped ${leadsLabel.toLowerCase()} available under your current role.`}
            />
            <CrmMetricCard
              label="Applied filters"
              value={String(activeFilterCount)}
              description="Search, ownership, source, and status filters all flow through the live API."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Find the right {leadsLabel.toLowerCase()}</CardTitle>
            <CardDescription>
              Search and filter by owner, qualification status, and source while keeping pagination and sorting stable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Search</span>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${leadsLabel.toLowerCase()} by name, company, email, or phone`}
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
                <span className="text-sm font-medium">Source</span>
                <select
                  className={selectClassName}
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                >
                  <option value="">All sources</option>
                  {options?.sources.map((source) => (
                    <option key={source.id} value={source.key}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Lead For</span>
                <select className={selectClassName} value={leadForFilter} onChange={(event) => setLeadForFilter(event.target.value)}>
                  <option value="">All lead types</option>
                  {options?.leadForOptions.map((option) => (
                    <option key={option.id} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Product</span>
                <select className={selectClassName} value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
                  <option value="">All products</option>
                  {options?.productOptions.map((option) => (
                    <option key={option.id} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 md:col-span-2">
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
                <span className="text-sm font-medium">Sort by</span>
                <select
                  className={selectClassName}
                  value={query.sortBy ?? "updatedAt"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      page: 1,
                      sortBy: event.target.value as LeadListQuery["sortBy"]
                    }))
                  }
                >
                  <option value="updatedAt">Last updated</option>
                  <option value="createdAt">Created date</option>
                  <option value="companyName">Company</option>
                  <option value="status">Status</option>
                  <option value="source">Source</option>
                  <option value="score">Score</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Sort order</span>
                <select
                  className={selectClassName}
                  value={query.sortOrder ?? "desc"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      page: 1,
                      sortOrder: event.target.value as LeadListQuery["sortOrder"]
                    }))
                  }
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
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
            <CardTitle>{leadsLabel} queue</CardTitle>
            <CardDescription>
              Every row is already tenant-isolated and backed by audit-logged create, update, delete, note, and activity flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

            {isLoading ? (
              <CrmLoadingState
                title={`Loading ${leadsLabel.toLowerCase()}`}
                description="The workspace is fetching filtered lead records from the CRM API."
              />
            ) : data && data.leads.length > 0 ? (
              <>
                <div className="space-y-3">
                  {data.leads.map((lead) => (
                    <div key={lead.id} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{lead.status?.label ?? "Status missing"}</Badge>
                            <Badge variant="muted">{lead.source?.label ?? "Source missing"}</Badge>
                            {lead.score !== null ? <Badge variant="success">Score {lead.score}</Badge> : null}
                          </div>
                          <div>
                            <p className="font-display text-2xl font-semibold">{lead.companyName}</p>
                            <p className="text-sm text-muted-foreground">
                              {lead.fullName} {lead.email ? `• ${lead.email}` : ""} {lead.phone ? `• ${lead.phone}` : ""}
                            </p>
                          </div>
                          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Owner</p>
                              <p className="mt-1 text-foreground">{lead.owner?.displayName ?? "Unassigned"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Timeline</p>
                              <p className="mt-1 text-foreground">
                                {lead.noteCount} notes • {lead.activityCount} activities
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Last activity</p>
                              <p className="mt-1 text-foreground">{formatDateTime(lead.lastActivityAt)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" asChild>
                            <Link to={`/leads/${lead.id}`}>Open</Link>
                          </Button>
                          {canEdit ? (
                            <Button variant="secondary" asChild>
                              <Link to={`/leads/${lead.id}/edit`}>Edit</Link>
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(lead.id)}
                              disabled={isDeletingId === lead.id}
                            >
                              {isDeletingId === lead.id ? "Deleting..." : "Delete"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-background/75 p-4 text-sm">
                  <p className="text-muted-foreground">
                    Page {data.pagination.page} of {data.pagination.totalPages} • {data.pagination.total} total {leadsLabel.toLowerCase()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={!data.pagination.hasPreviousPage}
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
                      disabled={!data.pagination.hasNextPage}
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
              </>
            ) : (
              <CrmEmptyState
                title={`No ${leadsLabel.toLowerCase()} matched the current criteria.`}
                description={`Try widening your filters, changing the search term, or create the first ${leadLabel.toLowerCase()} for this tenant.`}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link to="/leads/new">Create {leadLabel}</Link>
                    </Button>
                  ) : null
                }
              />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
