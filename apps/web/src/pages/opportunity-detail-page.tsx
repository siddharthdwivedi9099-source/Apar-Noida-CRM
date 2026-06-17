import { useEffect, useState } from "react";
import type {
  CreateCrmActivityRequestBody,
  CreateCrmNoteRequestBody,
  CreateCrmTaskRequestBody,
  OpportunityOptionsResponse,
  OpportunityResponse,
  UpdateCrmNoteRequestBody,
  UpdateCrmTaskRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmActivityPanel } from "@/components/crm/crm-activity-panel";
import { CrmNotesPanel } from "@/components/crm/crm-notes-panel";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { CrmTaskList } from "@/components/crm/crm-task-list";
import { CrmTimeline } from "@/components/crm/crm-timeline";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { formatCurrencyAmount, formatDateOnly, formatDateTime, formatShortDate } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useParams } from "react-router-dom";

export function OpportunityDetailPage() {
  const { opportunityId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const opportunityLabel = getModuleLabel("opportunities", "singular");
  const opportunitiesLabel = getModuleLabel("opportunities");
  const [detailResponse, setDetailResponse] = useState<OpportunityResponse | null>(null);
  const [optionsResponse, setOptionsResponse] = useState<OpportunityOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission([
    "opportunities.edit",
    "opportunities.assign",
    "opportunities.approve",
    "opportunities.configure",
    "opportunities.manage_workflow"
  ]);
  const canDelete = hasAnyPermission(["opportunities.delete", "opportunities.configure"]);
  const canManageProductivity = hasAnyPermission([
    "opportunities.create",
    "opportunities.edit",
    "opportunities.assign",
    "opportunities.configure"
  ]);

  async function loadOpportunity() {
    if (!accessToken || !opportunityId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [detail, options] = await Promise.all([
        apiRequest<OpportunityResponse>(`/opportunities/${opportunityId}`, {
          method: "GET",
          accessToken
        }),
        apiRequest<OpportunityOptionsResponse>("/opportunities/options", {
          method: "GET",
          accessToken
        })
      ]);

      setDetailResponse(detail);
      setOptionsResponse(options);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOpportunity();
  }, [accessToken, opportunityId]);

  async function handleAddNote(payload: CreateCrmNoteRequestBody) {
    if (!accessToken || !opportunityId) {
      return;
    }

    await apiRequest(`/records/opportunity/${opportunityId}/notes`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadOpportunity();
  }

  async function handleUpdateNote(noteId: string, payload: UpdateCrmNoteRequestBody) {
    if (!accessToken || !opportunityId) {
      return;
    }

    await apiRequest(`/records/opportunity/${opportunityId}/notes/${noteId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadOpportunity();
  }

  async function handleAddActivity(payload: CreateCrmActivityRequestBody) {
    if (!accessToken || !opportunityId) {
      return;
    }

    await apiRequest(`/records/opportunity/${opportunityId}/activities`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadOpportunity();
  }

  async function handleAddTask(payload: CreateCrmTaskRequestBody) {
    if (!accessToken || !opportunityId) {
      return;
    }

    await apiRequest(`/records/opportunity/${opportunityId}/tasks`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadOpportunity();
  }

  async function handleUpdateTask(taskId: string, payload: UpdateCrmTaskRequestBody) {
    if (!accessToken || !opportunityId) {
      return;
    }

    await apiRequest(`/records/opportunity/${opportunityId}/tasks/${taskId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadOpportunity();
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${opportunityLabel.toLowerCase()} detail`}
        description="The page is fetching the sales record, linked stakeholders, notes, activities, tasks, and the customer timeline."
      />
    );
  }

  const opportunity = detailResponse?.opportunity;

  if (!opportunity || !optionsResponse) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">This {opportunityLabel.toLowerCase()} could not be loaded.</p>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "The record is unavailable."}</p>
          <Button asChild>
            <Link to="/opportunities">Back to {opportunitiesLabel.toLowerCase()}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Opportunity detail"
        title={`${opportunity.name} is now tracked as a live ${opportunityLabel.toLowerCase()} record.`}
        summary="This detail view combines account and contact linkage, stakeholders, commercial context, productivity touchpoints, stage movement history, and permission-aware AI placeholders."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/opportunities">Back to list</Link>
            </Button>
            {canEdit ? (
              <Button asChild>
                <Link to={`/opportunities/${opportunity.id}/edit`}>Edit {opportunityLabel}</Link>
              </Button>
            ) : null}
            {canDelete ? <Badge variant="muted">Soft delete available from list view</Badge> : null}
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Current stage"
              value={opportunity.stage?.label ?? "Missing"}
              description="Stage transitions are configurable by tenant and every change is audit logged."
            />
            <CrmMetricCard
              label="Opportunity value"
              value={formatCurrencyAmount(opportunity.amount)}
              description={`${opportunity.probability ?? 0}% probability with expected close ${formatDateOnly(opportunity.expectedCloseDate)}.`}
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{opportunity.name}</CardTitle>
            <CardDescription>
              Commercial context, account linkage, primary contact coverage, and close planning for this opportunity.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</p>
              <p className="mt-2 font-semibold">{opportunity.account?.name ?? "No account linked"}</p>
              {opportunity.account ? (
                <Button className="mt-3" variant="outline" asChild>
                  <Link to={`/accounts/${opportunity.account.id}`}>Open account</Link>
                </Button>
              ) : null}
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Primary contact</p>
              <p className="mt-2 font-semibold">{opportunity.primaryContact?.fullName ?? "No primary contact linked"}</p>
              {opportunity.primaryContact ? (
                <Button className="mt-3" variant="outline" asChild>
                  <Link to={`/contacts/${opportunity.primaryContact.id}`}>Open contact</Link>
                </Button>
              ) : null}
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source</p>
              <p className="mt-2 font-semibold">{opportunity.source?.label ?? "Not set"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Outcome</p>
              <p className="mt-2 font-semibold">{opportunity.outcomeStatus?.label ?? "Not set"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
              <p className="mt-2 font-semibold">{opportunity.owner?.displayName ?? "Unassigned"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Competitor</p>
              <p className="mt-2 font-semibold">{opportunity.competitor ?? "No competitor tracked"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expected close</p>
              <p className="mt-2 font-semibold">{formatDateOnly(opportunity.expectedCloseDate)}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last stage change</p>
              <p className="mt-2 font-semibold">{formatDateTime(opportunity.lastStageChangedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deal summary</CardTitle>
            <CardDescription>
              Close planning, AI placeholders, and forecast-oriented context for this opportunity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next step</p>
              <p className="mt-2 text-sm leading-6">{opportunity.nextStep ?? "No next step recorded yet."}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Win/loss reason</p>
              <p className="mt-2 text-sm leading-6">{opportunity.winLossReason ?? "No win/loss reason recorded."}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Products/services placeholder</p>
              <p className="mt-2 text-sm leading-6">{opportunity.productsServicesPlaceholder.message}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deal risk placeholder</p>
              <p className="mt-2 text-sm leading-6">{opportunity.dealRiskPlaceholder.message}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Stakeholders</CardTitle>
            <CardDescription>
              These contacts provide buying-committee and execution visibility for the opportunity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunity.stakeholders.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No additional stakeholders are linked to this opportunity yet.
              </div>
            ) : (
              opportunity.stakeholders.map((stakeholder) => (
                <div key={stakeholder.id} className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {stakeholder.role ? <Badge>{stakeholder.role.label}</Badge> : null}
                    <p className="font-semibold">{stakeholder.fullName}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{stakeholder.email ?? "No email provided"}</p>
                  <Button className="mt-3" variant="outline" asChild>
                    <Link to={`/contacts/${stakeholder.id}`}>Open stakeholder</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI placeholders</CardTitle>
            <CardDescription>
              Visibility is permission-aware and execution remains intentionally deferred until the AI Gateway phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {opportunity.aiPlaceholders.actions.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                {opportunity.aiPlaceholders.governanceHint}
              </div>
            ) : (
              <>
                {opportunity.aiPlaceholders.actions.map((action) => (
                  <div key={action.key} className="rounded-[1.25rem] bg-background/75 p-4">
                    <p className="font-semibold">{action.label}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
                  </div>
                ))}
                <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                  {opportunity.aiPlaceholders.governanceHint}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <CrmNotesPanel
          entityLabel={opportunityLabel}
          notes={opportunity.notes}
          canWrite={canManageProductivity}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
        />
        <CrmActivityPanel
          entityLabel={opportunityLabel}
          activities={opportunity.activities}
          owners={optionsResponse.owners}
          canWrite={canManageProductivity}
          onAddActivity={handleAddActivity}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <CrmTaskList
          entityLabel={opportunityLabel}
          tasks={opportunity.tasks}
          owners={optionsResponse.owners}
          canWrite={canManageProductivity}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
        />
        <CrmTimeline entityLabel={opportunityLabel} items={opportunity.timeline} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.25rem] bg-background/75 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audit-safe timestamps</p>
          <p className="mt-2 text-sm leading-6">
            Created {formatShortDate(opportunity.createdAt)} and last updated {formatDateTime(opportunity.updatedAt)}.
          </p>
        </div>
        <div className="rounded-[1.25rem] bg-background/75 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline coverage</p>
          <p className="mt-2 text-sm leading-6">
            {opportunity.noteCount} notes, {opportunity.activityCount} activities, and {opportunity.tasks.length} tasks are attached to this{" "}
            {opportunityLabel.toLowerCase()}.
          </p>
        </div>
        <div className="rounded-[1.25rem] bg-background/75 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Forecast placeholder</p>
          <p className="mt-2 text-sm leading-6">{opportunity.forecastPlaceholder.message}</p>
        </div>
      </section>
    </div>
  );
}
