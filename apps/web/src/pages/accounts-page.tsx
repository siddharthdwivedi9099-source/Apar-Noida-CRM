import { useEffect, useMemo, useState } from "react";
import type { AccountListQuery, AccountOptionsResponse, AccountsResponse } from "@crm/types";
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

const defaultQuery: AccountListQuery = {
  page: 1,
  pageSize: 12,
  sortBy: "updatedAt",
  sortOrder: "desc"
};

export function AccountsPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const accountLabel = getModuleLabel("accounts", "singular");
  const accountsLabel = getModuleLabel("accounts");
  const [options, setOptions] = useState<AccountOptionsResponse | null>(null);
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [query, setQuery] = useState<AccountListQuery>(defaultQuery);
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["accounts.create", "accounts.configure"]);
  const canEdit = hasAnyPermission(["accounts.edit", "accounts.configure"]);
  const canDelete = hasAnyPermission(["accounts.delete", "accounts.configure"]);

  const activeFilterCount = useMemo(
    () => [query.search, query.accountType, query.industry, query.ownerId].filter(Boolean).length,
    [query]
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void (async () => {
      try {
        setOptions(
          await apiRequest<AccountOptionsResponse>("/accounts/options", {
            method: "GET",
            accessToken
          })
        );
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
        setData(
          await apiRequest<AccountsResponse>(`/accounts${buildQueryString(query)}`, {
            method: "GET",
            accessToken
          })
        );
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
      accountType: typeFilter || undefined,
      industry: industryFilter.trim() || undefined,
      ownerId: ownerFilter || undefined
    }));
  }

  function resetFilters() {
    setSearchInput("");
    setTypeFilter("");
    setIndustryFilter("");
    setOwnerFilter("");
    setQuery(defaultQuery);
  }

  async function handleDelete(accountId: string) {
    if (!accessToken || !window.confirm(`Soft delete this ${accountLabel.toLowerCase()}?`)) {
      return;
    }

    setIsDeletingId(accountId);
    setErrorMessage(null);

    try {
      await apiRequest(`/accounts/${accountId}`, {
        method: "DELETE",
        accessToken
      });
      setData(
        await apiRequest<AccountsResponse>(`/accounts${buildQueryString(query)}`, {
          method: "GET",
          accessToken
        })
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Customer context spine"
        title={`${accountsLabel} now hold shared ownership, relationship context, and tenant-safe lifecycle metadata.`}
        summary={`This workspace establishes the production-ready ${accountLabel.toLowerCase()} system of record that opportunities, support, and customer-success flows can attach to without duplicating customer identity.`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to="/accounts/new">Create {accountLabel}</Link>
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Visible records"
              value={String(data?.pagination.total ?? 0)}
              description={`Tenant-scoped ${accountsLabel.toLowerCase()} currently visible to your role.`}
            />
            <CrmMetricCard
              label="Applied filters"
              value={String(activeFilterCount)}
              description="Search, owner, account type, and industry filters all resolve through the live API."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Refine {accountsLabel.toLowerCase()}</CardTitle>
            <CardDescription>
              Filter by customer shape, owner, and industry while preserving search, sorting, and pagination.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Search</span>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${accountsLabel.toLowerCase()} by name, website, or industry`}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Account type</span>
                <select
                  className={selectClassName}
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="">All types</option>
                  {options?.accountTypes.map((option) => (
                    <option key={option.id} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Industry</span>
                <Input
                  value={industryFilter}
                  onChange={(event) => setIndustryFilter(event.target.value)}
                  placeholder="Software, Manufacturing, Services..."
                />
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
                      sortBy: event.target.value as AccountListQuery["sortBy"]
                    }))
                  }
                >
                  <option value="updatedAt">Last updated</option>
                  <option value="createdAt">Created date</option>
                  <option value="name">Name</option>
                  <option value="accountType">Account type</option>
                  <option value="industry">Industry</option>
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
                      sortOrder: event.target.value as AccountListQuery["sortOrder"]
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
            <CardTitle>{accountsLabel} list</CardTitle>
            <CardDescription>
              These records already support soft delete, audit logging, related contacts, and future opportunity attachments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

            {isLoading ? (
              <CrmLoadingState
                title={`Loading ${accountsLabel.toLowerCase()}`}
                description="The workspace is fetching account records from the CRM API."
              />
            ) : data && data.accounts.length > 0 ? (
              <>
                <div className="space-y-3">
                  {data.accounts.map((account) => (
                    <div key={account.id} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{account.accountType?.label ?? "Type open"}</Badge>
                            <Badge variant="muted">{account.healthStatus?.label ?? "Health placeholder"}</Badge>
                            <Badge variant="success">{account.contactCount} contacts</Badge>
                          </div>
                          <div>
                            <p className="font-display text-2xl font-semibold">{account.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {account.website ?? "No website yet"} {account.industry ? `• ${account.industry}` : ""}
                            </p>
                          </div>
                          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Owner</p>
                              <p className="mt-1 text-foreground">{account.owner?.displayName ?? "Unassigned"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Timeline</p>
                              <p className="mt-1 text-foreground">
                                {account.noteCount} notes • {account.activityCount} activities
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Last updated</p>
                              <p className="mt-1 text-foreground">{formatDateTime(account.updatedAt)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" asChild>
                            <Link to={`/accounts/${account.id}`}>Open</Link>
                          </Button>
                          {canEdit ? (
                            <Button variant="secondary" asChild>
                              <Link to={`/accounts/${account.id}/edit`}>Edit</Link>
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(account.id)}
                              disabled={isDeletingId === account.id}
                            >
                              {isDeletingId === account.id ? "Deleting..." : "Delete"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-background/75 p-4 text-sm">
                  <p className="text-muted-foreground">
                    Page {data.pagination.page} of {data.pagination.totalPages} • {data.pagination.total} total {accountsLabel.toLowerCase()}
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
                title={`No ${accountsLabel.toLowerCase()} matched the current criteria.`}
                description={`Try a broader search, remove a filter, or create the first ${accountLabel.toLowerCase()} for this tenant.`}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link to="/accounts/new">Create {accountLabel}</Link>
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
