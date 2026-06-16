import { useEffect, useState } from "react";
import type {
  CampaignOptionsResponse,
  CampaignResponse,
  CreateCampaignMemberRequestBody,
  CreateCrmActivityRequestBody,
  CreateCrmNoteRequestBody,
  CreateCrmTaskRequestBody,
  CrmActivitiesResponse,
  CrmNotesResponse,
  CrmTasksResponse,
  CrmTimelineResponse,
  UpdateCampaignMemberRequestBody,
  UpdateCrmNoteRequestBody,
  UpdateCrmTaskRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignMembersManager } from "@/components/campaigns/campaign-members-manager";
import { CrmActivityPanel } from "@/components/crm/crm-activity-panel";
import { CrmNotesPanel } from "@/components/crm/crm-notes-panel";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { CrmTaskList } from "@/components/crm/crm-task-list";
import { CrmTimeline } from "@/components/crm/crm-timeline";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { formatCurrencyAmount, formatDateOnly, formatDateTime } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useParams } from "react-router-dom";

export function CampaignDetailPage() {
  const { campaignId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel, settings } = useTenantConfig();
  const campaignLabel = getModuleLabel("campaigns", "singular");
  const campaignsLabel = getModuleLabel("campaigns");
  const [campaignResponse, setCampaignResponse] = useState<CampaignResponse | null>(null);
  const [optionsResponse, setOptionsResponse] = useState<CampaignOptionsResponse | null>(null);
  const [notesResponse, setNotesResponse] = useState<CrmNotesResponse | null>(null);
  const [activitiesResponse, setActivitiesResponse] = useState<CrmActivitiesResponse | null>(null);
  const [tasksResponse, setTasksResponse] = useState<CrmTasksResponse | null>(null);
  const [timelineResponse, setTimelineResponse] = useState<CrmTimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission(["campaigns.edit", "campaigns.assign", "campaigns.configure"]);
  const canDelete = hasAnyPermission(["campaigns.delete", "campaigns.configure"]);
  const canManageProductivity = hasAnyPermission([
    "campaigns.create",
    "campaigns.edit",
    "campaigns.assign",
    "campaigns.configure"
  ]);
  const canManageMembers = hasAnyPermission([
    "campaigns.create",
    "campaigns.edit",
    "campaigns.assign",
    "campaigns.configure"
  ]);

  async function loadCampaign() {
    if (!accessToken || !campaignId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [detail, options, notes, activities, tasks, timeline] = await Promise.all([
        apiRequest<CampaignResponse>(`/campaigns/${campaignId}`, {
          method: "GET",
          accessToken
        }),
        apiRequest<CampaignOptionsResponse>("/campaigns/options", {
          method: "GET",
          accessToken
        }),
        apiRequest<CrmNotesResponse>(`/records/campaign/${campaignId}/notes`, {
          method: "GET",
          accessToken
        }),
        apiRequest<CrmActivitiesResponse>(`/records/campaign/${campaignId}/activities`, {
          method: "GET",
          accessToken
        }),
        apiRequest<CrmTasksResponse>(`/records/campaign/${campaignId}/tasks`, {
          method: "GET",
          accessToken
        }),
        apiRequest<CrmTimelineResponse>(`/records/campaign/${campaignId}/timeline`, {
          method: "GET",
          accessToken
        })
      ]);

      setCampaignResponse(detail);
      setOptionsResponse(options);
      setNotesResponse(notes);
      setActivitiesResponse(activities);
      setTasksResponse(tasks);
      setTimelineResponse(timeline);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaign();
  }, [accessToken, campaignId]);

  async function handleAddNote(payload: CreateCrmNoteRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/records/campaign/${campaignId}/notes`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleUpdateNote(noteId: string, payload: UpdateCrmNoteRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/records/campaign/${campaignId}/notes/${noteId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleAddActivity(payload: CreateCrmActivityRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/records/campaign/${campaignId}/activities`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleAddTask(payload: CreateCrmTaskRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/records/campaign/${campaignId}/tasks`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleUpdateTask(taskId: string, payload: UpdateCrmTaskRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/records/campaign/${campaignId}/tasks/${taskId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleAddMember(payload: CreateCampaignMemberRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/campaigns/${campaignId}/members`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleUpdateMember(memberId: string, payload: UpdateCampaignMemberRequestBody) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/campaigns/${campaignId}/members/${memberId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadCampaign();
  }

  async function handleDeleteMember(memberId: string) {
    if (!accessToken || !campaignId) {
      return;
    }

    await apiRequest(`/campaigns/${campaignId}/members/${memberId}`, {
      method: "DELETE",
      accessToken
    });
    await loadCampaign();
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${campaignLabel.toLowerCase()} detail`}
        description="The page is fetching campaign strategy, member orchestration, notes, activities, tasks, and the unified timeline."
      />
    );
  }

  const campaign = campaignResponse?.campaign;

  if (!campaign || !optionsResponse || !notesResponse || !activitiesResponse || !tasksResponse || !timelineResponse) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">This {campaignLabel.toLowerCase()} could not be loaded.</p>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "The record is unavailable."}</p>
          <Button asChild>
            <Link to="/campaigns">Back to {campaignsLabel.toLowerCase()}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Campaign detail"
        title={`${campaign.name} is now tracked as a live ${campaignLabel.toLowerCase()} record.`}
        summary={`This detail view combines strategy, budget, members, notes, activities, tasks, timeline coverage, and permission-aware AI placeholders inside the authenticated campaign foundation.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/campaigns">Back to list</Link>
            </Button>
            {canEdit ? (
              <Button asChild>
                <Link to={`/campaigns/${campaign.id}/edit`}>Edit {campaignLabel}</Link>
              </Button>
            ) : null}
            {canDelete ? <Badge variant="muted">Soft delete available from list view</Badge> : null}
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Status"
              value={campaign.status?.label ?? "Missing"}
              description={`Current execution state for this ${campaignLabel.toLowerCase()} within the tenant.`}
            />
            <CrmMetricCard
              label="Members"
              value={String(campaign.memberCount)}
              description="Leads, contacts, and accounts attached to the current campaign audience."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
            <CardDescription>
              Core planning data, audience context, and owner assignment for this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
              <p className="mt-2 font-semibold">{campaign.owner?.displayName ?? "Unassigned"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budget</p>
              <p className="mt-2 font-semibold">{formatCurrencyAmount(campaign.budgetAmount, settings.currency)}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</p>
              <p className="mt-2 font-semibold">{campaign.type?.label ?? "Missing"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Objective</p>
              <p className="mt-2 font-semibold">{campaign.objective?.label ?? "Missing"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Channel</p>
              <p className="mt-2 font-semibold">{campaign.channel?.label ?? "Missing"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Window</p>
              <p className="mt-2 font-semibold">
                {formatDateOnly(campaign.startDate)} to {formatDateOnly(campaign.endDate)}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Target audience</p>
              <p className="mt-2 text-sm leading-6">{campaign.targetAudience ?? "Audience not captured yet."}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Description</p>
              <p className="mt-2 text-sm leading-6">{campaign.description ?? "Description not provided yet."}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution summary</CardTitle>
            <CardDescription>
              These cards show the cross-cutting behaviors already attached to this campaign record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audit-safe timestamps</p>
              <p className="mt-2 text-sm leading-6">
                Created {formatDateTime(campaign.createdAt)} and last updated {formatDateTime(campaign.updatedAt)}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Execution coverage</p>
              <p className="mt-2 text-sm leading-6">
                {campaign.memberCount} members, {campaign.noteCount} notes, {campaign.activityCount} activities, and{" "}
                {campaign.taskCount} tasks are attached to this {campaignLabel.toLowerCase()}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Performance placeholder</p>
              <p className="mt-2 text-sm leading-6">{campaign.performancePlaceholder.message}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Calendar placeholder</p>
              <p className="mt-2 text-sm leading-6">{campaign.calendarPlaceholder.message}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Related assets</CardTitle>
            <CardDescription>
              These assets stay attached to the campaign record for later content and channel execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaign.relatedAssets.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No related assets have been attached yet.
              </div>
            ) : (
              campaign.relatedAssets.map((asset) => (
                <div key={`${asset.label}-${asset.url}`} className="rounded-[1.25rem] bg-background/75 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {asset.assetType ? <Badge variant="muted">{asset.assetType}</Badge> : null}
                    <a className="font-semibold hover:underline" href={asset.url} target="_blank" rel="noreferrer">
                      {asset.label}
                    </a>
                  </div>
                  <p className="mt-2 break-all text-sm text-muted-foreground">{asset.url}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI placeholders</CardTitle>
            <CardDescription>
              These buttons are intentionally non-executing for now and stay visible only when the current role has AI access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.aiPlaceholders.actions.length > 0 ? (
              <div className="grid gap-3">
                {campaign.aiPlaceholders.actions.map((action) => (
                  <div key={action.key} className="rounded-[1.25rem] bg-background/75 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{action.label}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
                      </div>
                      <Button type="button" variant="outline">
                        Placeholder
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                AI placeholder actions are hidden for your current role.
              </div>
            )}
            <p className="text-sm text-muted-foreground">{campaign.aiPlaceholders.governanceHint}</p>
          </CardContent>
        </Card>
      </section>

      <CampaignMembersManager
        entityLabel={campaignLabel}
        members={campaign.members}
        options={{
          memberStatuses: optionsResponse.memberStatuses,
          leadCandidates: optionsResponse.leadCandidates,
          contactCandidates: optionsResponse.contactCandidates,
          accountCandidates: optionsResponse.accountCandidates
        }}
        canWrite={canManageMembers}
        onAddMember={handleAddMember}
        onUpdateMember={handleUpdateMember}
        onDeleteMember={handleDeleteMember}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <CrmNotesPanel
          entityLabel={campaignLabel}
          notes={notesResponse.notes}
          canWrite={canManageProductivity}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
        />
        <CrmActivityPanel
          entityLabel={campaignLabel}
          activities={activitiesResponse.activities}
          owners={optionsResponse.owners}
          canWrite={canManageProductivity}
          onAddActivity={handleAddActivity}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <CrmTaskList
          entityLabel={campaignLabel}
          tasks={tasksResponse.tasks}
          owners={optionsResponse.owners}
          canWrite={canManageProductivity}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
        />
        <CrmTimeline entityLabel={campaignLabel} items={timelineResponse.items} />
      </section>
    </div>
  );
}
