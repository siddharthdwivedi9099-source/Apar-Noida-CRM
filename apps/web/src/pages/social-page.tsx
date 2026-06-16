import { useEffect, useMemo, useState } from "react";
import type { SocialPostListQuery, SocialOptionsResponse, SocialPostsResponse } from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import {
  buildQueryString,
  formatDateOnly,
  formatDateTime,
  formatShortDate,
  pageSizeOptions,
  selectClassName
} from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link } from "react-router-dom";

const defaultQuery: SocialPostListQuery = {
  page: 1,
  pageSize: 12,
  sortBy: "scheduledAt",
  sortOrder: "asc"
};

function getDefaultCalendarMonth() {
  const today = new Date();
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getCalendarWindow(monthValue: string) {
  const [yearValue, monthValuePart] = monthValue.split("-").map((segment) => Number.parseInt(segment, 10));
  const year = Number.isFinite(yearValue) ? yearValue : new Date().getUTCFullYear();
  const monthIndex = Number.isFinite(monthValuePart) ? monthValuePart - 1 : new Date().getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function getCalendarDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function SocialPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const socialLabel = getModuleLabel("social");
  const socialPostLabel = getModuleLabel("social", "singular");
  const [options, setOptions] = useState<SocialOptionsResponse | null>(null);
  const [data, setData] = useState<SocialPostsResponse | null>(null);
  const [calendarData, setCalendarData] = useState<SocialPostsResponse | null>(null);
  const [query, setQuery] = useState<SocialPostListQuery>(defaultQuery);
  const [calendarMonth, setCalendarMonth] = useState(getDefaultCalendarMonth());
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["social.create", "social.configure"]);
  const canEdit = hasAnyPermission(["social.edit", "social.assign", "social.approve", "social.configure"]);
  const canDelete = hasAnyPermission(["social.delete", "social.configure"]);

  const activeFilterCount = useMemo(
    () => [query.search, query.status, query.approvalStatus, query.channel, query.ownerId, query.campaignId].filter(Boolean).length,
    [query]
  );

  const dashboardMetrics = useMemo(() => {
    const visiblePosts = data?.posts ?? [];
    const calendarPosts = calendarData?.posts ?? [];

    return {
      visibleCount: data?.pagination.total ?? 0,
      pendingApprovals: visiblePosts.filter((post) => post.approvalStatus?.key === "pending_review").length,
      scheduledThisMonth: calendarPosts.filter((post) => Boolean(post.scheduledAt)).length,
      multiChannelPosts: visiblePosts.filter((post) => post.channels.length > 1).length
    };
  }, [calendarData, data]);

  const calendarDays = useMemo(() => {
    const { start, end } = getCalendarWindow(calendarMonth);
    const postsByDay = new Map<string, SocialPostsResponse["posts"]>();

    for (const post of calendarData?.posts ?? []) {
      if (!post.scheduledAt) {
        continue;
      }

      const dayKey = getCalendarDayKey(post.scheduledAt);
      const existing = postsByDay.get(dayKey) ?? [];
      existing.push(post);
      postsByDay.set(dayKey, existing);
    }

    const days = [];
    const leadingBlankDays = start.getUTCDay();

    for (let index = 0; index < leadingBlankDays; index += 1) {
      days.push(null);
    }

    for (let dayOfMonth = 1; dayOfMonth <= end.getUTCDate(); dayOfMonth += 1) {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), dayOfMonth, 12, 0, 0, 0));
      const dayKey = date.toISOString().slice(0, 10);
      days.push({
        dayKey,
        date,
        posts: postsByDay.get(dayKey) ?? []
      });
    }

    return days;
  }, [calendarData?.posts, calendarMonth]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void (async () => {
      try {
        const response = await apiRequest<SocialOptionsResponse>("/social/options", {
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
        const response = await apiRequest<SocialPostsResponse>(`/social${buildQueryString(query)}`, {
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

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const { startIso, endIso } = getCalendarWindow(calendarMonth);
    setIsCalendarLoading(true);

    void (async () => {
      try {
        const response = await apiRequest<SocialPostsResponse>(
          `/social${buildQueryString({
            page: 1,
            pageSize: 200,
            search: query.search,
            status: query.status,
            approvalStatus: query.approvalStatus,
            channel: query.channel,
            ownerId: query.ownerId,
            campaignId: query.campaignId,
            scheduledFrom: startIso,
            scheduledTo: endIso,
            sortBy: "scheduledAt",
            sortOrder: "asc"
          })}`,
          {
            method: "GET",
            accessToken
          }
        );
        setCalendarData(response);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsCalendarLoading(false);
      }
    })();
  }, [accessToken, calendarMonth, query]);

  function applyFilters() {
    setQuery((currentValue) => ({
      ...currentValue,
      page: 1,
      search: searchInput.trim() || undefined,
      status: statusFilter || undefined,
      approvalStatus: approvalStatusFilter || undefined,
      channel: channelFilter || undefined,
      ownerId: ownerFilter || undefined,
      campaignId: campaignFilter || undefined
    }));
  }

  function resetFilters() {
    setSearchInput("");
    setStatusFilter("");
    setApprovalStatusFilter("");
    setChannelFilter("");
    setOwnerFilter("");
    setCampaignFilter("");
    setQuery(defaultQuery);
  }

  async function handleDelete(postId: string) {
    if (!accessToken || !window.confirm(`Soft delete this ${socialPostLabel.toLowerCase()}?`)) {
      return;
    }

    setIsDeletingId(postId);
    setErrorMessage(null);

    try {
      await apiRequest(`/social/${postId}`, {
        method: "DELETE",
        accessToken
      });
      const [listResponse, { startIso, endIso }] = await Promise.all([
        apiRequest<SocialPostsResponse>(`/social${buildQueryString(query)}`, {
          method: "GET",
          accessToken
        }),
        Promise.resolve(getCalendarWindow(calendarMonth))
      ]);
      setData(listResponse);
      setCalendarData(
        await apiRequest<SocialPostsResponse>(
          `/social${buildQueryString({
            page: 1,
            pageSize: 200,
            search: query.search,
            status: query.status,
            approvalStatus: query.approvalStatus,
            channel: query.channel,
            ownerId: query.ownerId,
            campaignId: query.campaignId,
            scheduledFrom: startIso,
            scheduledTo: endIso,
            sortBy: "scheduledAt",
            sortOrder: "asc"
          })}`,
          {
            method: "GET",
            accessToken
          }
        )
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDeletingId(null);
    }
  }

  if (isLoading && !data) {
    return (
      <CrmLoadingState
        title={`Loading ${socialLabel.toLowerCase()}`}
        description="The page is fetching tenant-backed social filters, dashboard metrics, calendar data, and the live post list."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Social media marketing workspace"
        title={`${socialLabel} now runs on tenant-safe post planning, calendar visibility, campaign linkage, and approval-aware execution controls.`}
        summary={`This workspace is the production-ready entry point for ${socialPostLabel.toLowerCase()} planning, multi-channel scheduling, campaign mapping, approvals, and placeholder AI-assisted social operations.`}
        actions={
          canCreate ? (
            <Button asChild>
              <Link to="/social/new">Create {socialPostLabel}</Link>
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Visible posts"
              value={String(dashboardMetrics.visibleCount)}
              description={`Tenant-scoped ${socialLabel.toLowerCase()} records available under your current role.`}
            />
            <CrmMetricCard
              label="Pending approvals"
              value={String(dashboardMetrics.pendingApprovals)}
              description="Approval-aware execution keeps reviewers and content owners aligned."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Filter the workspace</CardTitle>
            <CardDescription>
              Search and filter by status, approval stage, channel, owner, and campaign while keeping pagination and sorting stable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium">Search</span>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search ${socialLabel.toLowerCase()} by title, caption, creative brief, or hashtag`}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Post status</span>
                <select className={selectClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {options?.statuses.map((status) => (
                    <option key={status.id} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Approval status</span>
                <select
                  className={selectClassName}
                  value={approvalStatusFilter}
                  onChange={(event) => setApprovalStatusFilter(event.target.value)}
                >
                  <option value="">All approval states</option>
                  {options?.approvalStatuses.map((status) => (
                    <option key={status.id} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium">Channel</span>
                <select className={selectClassName} value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                  <option value="">All channels</option>
                  {options?.channels.map((channel) => (
                    <option key={channel.id} value={channel.key}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>
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
                <span className="text-sm font-medium">Campaign</span>
                <select className={selectClassName} value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)}>
                  <option value="">All campaigns</option>
                  {options?.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <label className="space-y-2">
                <span className="text-sm font-medium">Calendar month</span>
                <Input type="month" value={calendarMonth} onChange={(event) => setCalendarMonth(event.target.value)} />
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
                      pageSize: Number.parseInt(event.target.value, 10)
                    }))
                  }
                >
                  {pageSizeOptions.map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize} rows
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Sort by</span>
                <select
                  className={selectClassName}
                  value={query.sortBy ?? "scheduledAt"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      sortBy: event.target.value as SocialPostListQuery["sortBy"]
                    }))
                  }
                >
                  <option value="scheduledAt">Scheduled date</option>
                  <option value="updatedAt">Updated date</option>
                  <option value="createdAt">Created date</option>
                  <option value="title">Title</option>
                  <option value="status">Post status</option>
                  <option value="approvalStatus">Approval status</option>
                  <option value="campaign">Campaign</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Order</span>
                <select
                  className={selectClassName}
                  value={query.sortOrder ?? "asc"}
                  onChange={(event) =>
                    setQuery((currentValue) => ({
                      ...currentValue,
                      sortOrder: event.target.value as SocialPostListQuery["sortOrder"]
                    }))
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={applyFilters}>
                Apply filters
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset
              </Button>
              <Badge variant="muted">{activeFilterCount} active filters</Badge>
            </div>
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Social media dashboard</CardTitle>
              <CardDescription>
                Scheduling volume, approval load, and campaign-linked content are now visible on live tenant data.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CrmMetricCard
                label="Scheduled this month"
                value={String(dashboardMetrics.scheduledThisMonth)}
                description="Calendar-backed posts that currently fall inside the selected month."
              />
              <CrmMetricCard
                label="Multi-channel posts"
                value={String(dashboardMetrics.multiChannelPosts)}
                description="Posts mapped to more than one social channel."
              />
              <CrmMetricCard
                label="Lead capture"
                value="Placeholder"
                description="Social lead capture will connect to qualification workflows in a later ingestion phase."
              />
              <CrmMetricCard
                label="Listening"
                value="Placeholder"
                description="Social listening and competitor tracking remain visible planning surfaces for later phases."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content calendar</CardTitle>
              <CardDescription>
                The selected month shows planned and scheduled posts grouped by day across linked channels and campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayLabel) => (
                  <div key={dayLabel} className="px-2 py-1">
                    {dayLabel}
                  </div>
                ))}
              </div>
              {isCalendarLoading ? (
                <div className="rounded-[1.5rem] bg-background/70 p-6 text-sm text-muted-foreground">
                  Loading calendar visibility for the selected month.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                  {calendarDays.map((day, index) =>
                    day ? (
                      <div
                        key={day.dayKey}
                        className="min-h-[180px] rounded-[1.25rem] border border-border/70 bg-background/70 p-3"
                      >
                        <p className="text-sm font-semibold">{day.date.getUTCDate()}</p>
                        <div className="mt-3 space-y-2">
                          {day.posts.length ? (
                            day.posts.slice(0, 3).map((post) => (
                              <Link
                                key={post.id}
                                to={`/social/${post.id}`}
                                className="block rounded-xl bg-secondary/55 px-3 py-2 text-xs leading-5 transition hover:bg-secondary"
                              >
                                <p className="font-semibold text-foreground">{post.title}</p>
                                <p className="text-muted-foreground">{post.channels.map((channel) => channel.label).join(", ")}</p>
                              </Link>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No scheduled posts.</p>
                          )}
                          {day.posts.length > 3 ? (
                            <p className="text-xs text-muted-foreground">+{day.posts.length - 3} more</p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div key={`blank-${index}`} className="hidden min-h-[180px] rounded-[1.25rem] bg-transparent md:block" />
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{socialLabel}</CardTitle>
          <CardDescription>
            Role-aware post planning now includes approval status, channel selection, campaign mapping, and placeholder AI visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.posts.length ? (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                {data.posts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="space-y-4 p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {post.status ? <Badge>{post.status.label}</Badge> : null}
                            {post.approvalStatus ? <Badge variant="muted">{post.approvalStatus.label}</Badge> : null}
                          </div>
                          <h3 className="font-display text-2xl font-semibold">{post.title}</h3>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {post.caption ?? "Caption not captured yet."}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{post.scheduledAt ? formatDateTime(post.scheduledAt) : "Not scheduled"}</p>
                          <p className="mt-1">Updated {formatShortDate(post.updatedAt)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {post.channels.map((channel) => (
                          <Badge key={`${post.id}-${channel.id}`} variant="muted">
                            {channel.label}
                          </Badge>
                        ))}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1.25rem] bg-background/75 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Campaign linkage</p>
                          <p className="mt-2 text-sm font-medium">
                            {post.campaign ? post.campaign.name : "No campaign linked yet."}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] bg-background/75 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
                          <p className="mt-2 text-sm font-medium">
                            {post.owner?.displayName ?? "Unassigned"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[1.25rem] bg-background/75 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hashtags</p>
                        <p className="mt-2 text-sm leading-6">
                          {post.hashtags.length ? post.hashtags.join(" ") : "No hashtags planned yet."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button variant="outline" asChild>
                          <Link to={`/social/${post.id}`}>View detail</Link>
                        </Button>
                        {canEdit ? (
                          <Button asChild>
                            <Link to={`/social/${post.id}/edit`}>Edit {socialPostLabel}</Link>
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="outline"
                            disabled={isDeletingId === post.id}
                            onClick={() => void handleDelete(post.id)}
                          >
                            {isDeletingId === post.id ? "Deleting..." : "Soft delete"}
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-background/70 px-4 py-3 text-sm">
                <span>
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <span>{data.pagination.total} total posts</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
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
                    type="button"
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
              title={`No ${socialLabel.toLowerCase()} posts match the current view.`}
              description="Create your first post or reset the filters to see records in this tenant workspace."
              action={
                canCreate ? (
                  <Button asChild>
                    <Link to="/social/new">Create {socialPostLabel}</Link>
                  </Button>
                ) : undefined
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
