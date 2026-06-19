import { useEffect, useMemo, useState } from "react";
import type {
  NotificationListQuery,
  NotificationPreferencesResponse,
  NotificationType,
  NotificationsResponse,
  ReplaceNotificationPreferencesRequestBody
} from "@crm/types";
import { Bell, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { buildQueryString, formatDateTime, selectClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link } from "react-router-dom";

const defaultQuery: NotificationListQuery = {
  page: 1,
  pageSize: 20,
  status: "all"
};

function toTitleCaseLabel(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getLinkedRecordHref(input: { entityType: string; entityId: string } | null) {
  if (!input) {
    return null;
  }

  switch (input.entityType) {
    case "lead":
      return `/leads/${input.entityId}`;
    case "account":
      return `/accounts/${input.entityId}`;
    case "contact":
      return `/contacts/${input.entityId}`;
    case "campaign":
      return `/campaigns/${input.entityId}`;
    case "opportunity":
      return `/opportunities/${input.entityId}`;
    case "partner":
      return "/partners";
    case "reseller":
      return "/resellers";
    default:
      return null;
  }
}

export function NotificationsPage() {
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const notificationsLabel = getModuleLabel("notifications");
  const notificationLabel = getModuleLabel("notifications", "singular");
  const [query, setQuery] = useState<NotificationListQuery>(defaultQuery);
  const [filterStatus, setFilterStatus] = useState<NonNullable<NotificationListQuery["status"]>>("all");
  const [filterType, setFilterType] = useState<NotificationType | "">("");
  const [notificationsResponse, setNotificationsResponse] = useState<NotificationsResponse | null>(null);
  const [preferencesResponse, setPreferencesResponse] = useState<NotificationPreferencesResponse | null>(null);
  const [preferenceDraft, setPreferenceDraft] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const unreadNotifications = notificationsResponse?.notifications.filter((notification) => !notification.isRead) ?? [];
  const hasUnread = (notificationsResponse?.unreadCount ?? 0) > 0;

  const activePreferenceCount = useMemo(
    () => Object.values(preferenceDraft).filter(Boolean).length,
    [preferenceDraft]
  );

  async function loadWorkspace(activeQuery: NotificationListQuery) {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [notifications, preferences] = await Promise.all([
        apiRequest<NotificationsResponse>(`/notifications${buildQueryString(activeQuery)}`, {
          method: "GET",
          accessToken
        }),
        apiRequest<NotificationPreferencesResponse>("/notifications/preferences", {
          method: "GET",
          accessToken
        })
      ]);

      setNotificationsResponse(notifications);
      setPreferencesResponse(preferences);
      setPreferenceDraft(
        Object.fromEntries(
          preferences.preferences.map((preference) => [preference.notificationType, preference.enabled])
        )
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace(query);
  }, [accessToken, query]);

  function applyFilters() {
    setQuery({
      page: 1,
      pageSize: 20,
      status: filterStatus,
      notificationType: filterType || undefined
    });
  }

  async function handleMarkRead(notificationId: string) {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: "POST",
        accessToken
      });
      setSuccessMessage(`${notificationLabel} marked as read.`);
      await loadWorkspace(query);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkAllRead() {
    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest("/notifications/read-all", {
        method: "POST",
        accessToken
      });
      setSuccessMessage(`All visible ${notificationsLabel.toLowerCase()} are now marked as read.`);
      await loadWorkspace(query);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSavePreferences() {
    if (!accessToken || !preferencesResponse) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: ReplaceNotificationPreferencesRequestBody = {
        preferences: preferencesResponse.preferences.map((preference) => ({
          notificationType: preference.notificationType,
          enabled: preferenceDraft[preference.notificationType] ?? preference.enabled
        }))
      };

      const response = await apiRequest<NotificationPreferencesResponse>("/notifications/preferences", {
        method: "PUT",
        accessToken,
        body: payload
      });

      setPreferencesResponse(response);
      setPreferenceDraft(
        Object.fromEntries(
          response.preferences.map((preference) => [preference.notificationType, preference.enabled])
        )
      );
      setSuccessMessage("Notification preferences updated.");
      await loadWorkspace(query);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading && !notificationsResponse) {
    return (
      <CrmLoadingState
        title={`Loading ${notificationsLabel.toLowerCase()}`}
        description="The notification center is loading unread counts, in-app deliveries, and per-type preferences."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Notification center"
        title={`${notificationsLabel} now run as tenant-backed in-app deliveries with read tracking, linked records, and per-user preferences.`}
        summary="This workspace brings unread visibility, role-aware delivery, linked business context, and preference management into one place for every authenticated user."
        actions={
          <>
            <Button variant="outline" onClick={applyFilters}>
              Refresh
            </Button>
            <Button onClick={() => void handleMarkAllRead()} disabled={!hasUnread || isSaving}>
              Mark all read
            </Button>
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Unread"
              value={String(notificationsResponse?.unreadCount ?? 0)}
              description="Unread in-app notifications currently assigned to your user account."
            />
            <CrmMetricCard
              label="Preferences on"
              value={String(activePreferenceCount)}
              description="Notification types currently enabled for in-app delivery."
            />
          </div>
        }
      />

      {errorMessage ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {successMessage ? (
        <Card>
          <CardContent className="p-6 text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              Filter live notifications by read state and type while keeping linked record context visible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Status</span>
                <select
                  className={selectClassName}
                  value={filterStatus}
                  onChange={(event) =>
                    setFilterStatus(event.target.value as NonNullable<NotificationListQuery["status"]>)
                  }
                >
                  <option value="all">All notifications</option>
                  <option value="unread">Unread only</option>
                  <option value="read">Read only</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Type</span>
                <select
                  className={selectClassName}
                  value={filterType}
                  onChange={(event) => setFilterType(event.target.value as NotificationType | "")}
                >
                  <option value="">All types</option>
                  {notificationsResponse?.availableTypes.map((definition) => (
                    <option key={definition.key} value={definition.key}>
                      {definition.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {notificationsResponse && notificationsResponse.notifications.length === 0 ? (
              <CrmEmptyState
                title={`No ${notificationsLabel.toLowerCase()} match this filter`}
                description="Adjust the read state or type filter to inspect other in-app deliveries."
              />
            ) : (
              <div className="space-y-4">
                {notificationsResponse?.notifications.map((notification) => {
                  const linkedRecordHref = getLinkedRecordHref(notification.linkedRecord);

                  return (
                    <div
                      key={notification.id}
                      className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={notification.isRead ? "muted" : "default"}>
                              {notification.isRead ? "Read" : "Unread"}
                            </Badge>
                            <Badge variant="muted">
                              {notificationsResponse?.availableTypes.find(
                                (definition) => definition.key === notification.notificationType
                              )?.label ?? toTitleCaseLabel(notification.notificationType)}
                            </Badge>
                            {notification.recipientRole ? (
                              <Badge variant="muted">{notification.recipientRole.name}</Badge>
                            ) : null}
                          </div>
                          <div>
                            <h3 className="font-display text-xl font-semibold">{notification.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                        {!notification.isRead ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSaving}
                            onClick={() => void handleMarkRead(notification.id)}
                          >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Mark read
                          </Button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.15rem] bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                          <p className="mt-2 text-sm font-medium">{formatDateTime(notification.createdAt)}</p>
                        </div>
                        <div className="rounded-[1.15rem] bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Actor</p>
                          <p className="mt-2 text-sm font-medium">
                            {notification.actor?.displayName ?? "System"}
                          </p>
                        </div>
                        <div className="rounded-[1.15rem] bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Linked record</p>
                          {notification.linkedRecord ? (
                            linkedRecordHref ? (
                              <Link className="mt-2 inline-flex text-sm font-medium text-primary" to={linkedRecordHref}>
                                {toTitleCaseLabel(notification.linkedRecord.entityType)} ·{" "}
                                {notification.linkedRecord.entityId.slice(0, 8)}
                              </Link>
                            ) : (
                              <p className="mt-2 text-sm font-medium">
                                {toTitleCaseLabel(notification.linkedRecord.entityType)} ·{" "}
                                {notification.linkedRecord.entityId.slice(0, 8)}
                              </p>
                            )
                          ) : (
                            <p className="mt-2 text-sm font-medium text-muted-foreground">Not linked</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {notificationsResponse ? (
              <div className="flex items-center justify-between rounded-[1.25rem] bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                <span>
                  Showing {notificationsResponse.notifications.length} of {notificationsResponse.pagination.total}{" "}
                  {notificationsLabel.toLowerCase()}.
                </span>
                <span>{unreadNotifications.length} unread on this page.</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Enable or mute in-app delivery by notification type for your current tenant session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preferencesResponse?.preferences.map((preference) => (
              <label
                key={preference.notificationType}
                className="flex items-start gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 p-4"
              >
                <input
                  className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                  type="checkbox"
                  checked={preferenceDraft[preference.notificationType] ?? preference.enabled}
                  onChange={(event) =>
                    setPreferenceDraft((currentValue) => ({
                      ...currentValue,
                      [preference.notificationType]: event.target.checked
                    }))
                  }
                />
                <div className="space-y-1">
                  <p className="font-medium">{preference.label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{preference.description}</p>
                </div>
              </label>
            ))}

            <Button className="w-full" disabled={isSaving} onClick={() => void handleSavePreferences()}>
              <Bell className="mr-2 h-4 w-4" />
              Save preferences
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
