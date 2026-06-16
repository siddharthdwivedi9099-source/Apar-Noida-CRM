import { useEffect, useMemo, useState } from "react";
import type { ContactListQuery, ContactOptionsResponse, ContactsResponse } from "@crm/types";
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

const defaultQuery: ContactListQuery = {
  page: 1,
  pageSize: 12,
  sortBy: "updatedAt",
  sortOrder: "desc"
};

export function ContactsPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const contactLabel = getModuleLabel("contacts", "singular");
  const contactsLabel = getModuleLabel("contacts");
  const accountLabel = getModuleLabel("accounts", "singular");
  const [options, setOptions] = useState<ContactOptionsResponse | null>(null);
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [query, setQuery] = useState<ContactListQuery>(defaultQuery);
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["contacts.create", "contacts.configure"]);
  const canEdit = hasAnyPermission(["contacts.edit", "contacts.configure"]);
  const canDelete = hasAnyPermission(["contacts.delete", "contacts.configure"]);

  const activeFilterCount = useMemo(
    () => [query.search, query.role, query.accountId, query.ownerId].filter(Boolean).length,
    [query]
  );

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void (async () => {
      try {
        setOptions(
          await apiRequest<ContactOptionsResponse>("/contacts/options", {
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
          await apiRequest<ContactsResponse>(`/contacts${buildQueryString(query)}`, {
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
      role: roleFilter || undefined,
      accountId: accountFilter || undefined,
      ownerId: ownerFilter || undefined
    }));
  }

  function resetFilters() {
    setSearchInput("");
    setRoleFilter("");
    setAccountFilter("");
    setOwnerFilter("");
    setQuery(defaultQuery);
  }

  async function handleDelete(contactId: string) {
    if (!accessToken || !window.confirm(`Soft delete this ${contactLabel.toLowerCase()}?`)) {
      return;
    }

    setIsDeletingId(contactId);
    setErrorMessage(null);

    try {
      await apiRequest(`/contacts/${contactId}`, {
        method: "DELETE",
        accessToken
      });
      setData(
        await apiRequest<ContactsResponse>(`/contacts${buildQueryString(query)}`, {
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
        eyebrow="Stakeholder mapping"
        title={`${contactsLabel} now connect people, ${accountLabel.toLowerCase()} relationships, owner assignment, and shared activity history.`}
        summary={`This workspace is the production-ready home for stakeholder identity, account mapping, contact roles, notes, activities, and role-aware actions within the tenant.`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to="/contacts/new">Create {contactLabel}</Link>
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Visible records"
              value={String(data?.pagination.total ?? 0)}
              description={`Tenant-scoped ${contactsLabel.toLowerCase()} currently visible to your role.`}
            />
            <CrmMetricCard
              label="Applied filters"
              value={String(activeFilterCount)}
              description="Search, account, role, and owner filters are now wired through the live contacts API."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Refine {contactsLabel.toLowerCase()}</CardTitle>
            <CardDescription>
              Search and filter stakeholders by account, role, owner, and sort order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Search</span>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${contactsLabel.toLowerCase()} by name, email, phone, or account`}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Role</span>
                <select
                  className={selectClassName}
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value="">All roles</option>
                  {options?.roles.map((role) => (
                    <option key={role.id} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Related account</span>
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
                      sortBy: event.target.value as ContactListQuery["sortBy"]
                    }))
                  }
                >
                  <option value="updatedAt">Last updated</option>
                  <option value="createdAt">Created date</option>
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="account">Account</option>
                  <option value="role">Role</option>
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
                      sortOrder: event.target.value as ContactListQuery["sortOrder"]
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
            <CardTitle>{contactsLabel} list</CardTitle>
            <CardDescription>
              Every stakeholder record already supports account mapping, soft delete, audit logging, notes, and activities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

            {isLoading ? (
              <CrmLoadingState
                title={`Loading ${contactsLabel.toLowerCase()}`}
                description="The workspace is fetching tenant-safe contact records from the CRM API."
              />
            ) : data && data.contacts.length > 0 ? (
              <>
                <div className="space-y-3">
                  {data.contacts.map((contact) => (
                    <div key={contact.id} className="rounded-[1.5rem] bg-background/75 p-5 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {contact.role ? <Badge>{contact.role.label}</Badge> : null}
                            {contact.account ? <Badge variant="muted">{contact.account.name}</Badge> : null}
                            <Badge variant="success">{contact.activityCount} activities</Badge>
                          </div>
                          <div>
                            <p className="font-display text-2xl font-semibold">{contact.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              {contact.email ?? "No email"} {contact.phone ? `• ${contact.phone}` : ""} {contact.linkedinUrl ? `• ${contact.linkedinUrl}` : ""}
                            </p>
                          </div>
                          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Owner</p>
                              <p className="mt-1 text-foreground">{contact.owner?.displayName ?? "Unassigned"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Timeline</p>
                              <p className="mt-1 text-foreground">
                                {contact.noteCount} notes • {contact.activityCount} activities
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em]">Last updated</p>
                              <p className="mt-1 text-foreground">{formatDateTime(contact.updatedAt)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" asChild>
                            <Link to={`/contacts/${contact.id}`}>Open</Link>
                          </Button>
                          {canEdit ? (
                            <Button variant="secondary" asChild>
                              <Link to={`/contacts/${contact.id}/edit`}>Edit</Link>
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              onClick={() => handleDelete(contact.id)}
                              disabled={isDeletingId === contact.id}
                            >
                              {isDeletingId === contact.id ? "Deleting..." : "Delete"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-background/75 p-4 text-sm">
                  <p className="text-muted-foreground">
                    Page {data.pagination.page} of {data.pagination.totalPages} • {data.pagination.total} total {contactsLabel.toLowerCase()}
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
                title={`No ${contactsLabel.toLowerCase()} matched the current criteria.`}
                description={`Try a broader search, remove a filter, or create the first ${contactLabel.toLowerCase()} for this tenant.`}
                action={
                  canCreate ? (
                    <Button asChild>
                      <Link to="/contacts/new">Create {contactLabel}</Link>
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
