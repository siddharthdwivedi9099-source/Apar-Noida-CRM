import { useEffect, useState } from "react";
import type {
  CreateCrmActivityRequestBody,
  CreateCrmNoteRequestBody,
  CreateCrmTaskRequestBody,
  CrmLookupUserSummary,
  LeadClassificationMetadata,
  LeadOptionsResponse,
  LeadResponse,
  LeadRuntimeResponse,
  UpdateCrmNoteRequestBody,
  UpdateCrmTaskRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BpfStageProgress } from "@/components/crm/bpf-stage-progress";
import { CrmActivityPanel } from "@/components/crm/crm-activity-panel";
import { CrmNotesPanel } from "@/components/crm/crm-notes-panel";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { EmailLink, PhoneLink } from "@/components/crm/contact-links";
import { CrmTaskList } from "@/components/crm/crm-task-list";
import { CrmTimeline } from "@/components/crm/crm-timeline";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import {
  formatFallbackCustomFieldLabel,
  getActiveCustomFieldDefinitions,
  getCustomFieldOptionLabels,
  hasCustomFieldValue
} from "@/lib/crm-custom-fields";
import { formatDateOnly, formatDateTime, formatShortDate } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useParams } from "react-router-dom";

export function LeadDetailPage() {
  const { leadId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const leadLabel = getModuleLabel("leads", "singular");
  const [data, setData] = useState<LeadResponse | null>(null);
  const [runtimeData, setRuntimeData] = useState<LeadRuntimeResponse | null>(null);
  const [runtimeErrorMessage, setRuntimeErrorMessage] = useState<string | null>(null);
  const [owners, setOwners] = useState<CrmLookupUserSummary[]>([]);
  const [leadOptions, setLeadOptions] = useState<LeadOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission(["leads.edit", "leads.configure"]);
  const canDelete = hasAnyPermission(["leads.delete", "leads.configure"]);
  const canManageProductivity = hasAnyPermission(["leads.create", "leads.edit", "leads.assign", "leads.configure"]);

  async function loadRuntime() {
    if (!accessToken || !leadId) {
      return;
    }

    try {
      const runtimeResponse = await apiRequest<LeadRuntimeResponse>(`/leads/${leadId}/runtime`, {
        method: "GET",
        accessToken
      });
      setRuntimeData(runtimeResponse);
    } catch (error) {
      setRuntimeData(null);
      setRuntimeErrorMessage(getErrorMessage(error));
    }
  }

  async function loadLead() {
    if (!accessToken || !leadId) {
      return;
    }

    setIsLoading(true);
    setRuntimeData(null);
    setErrorMessage(null);
    setRuntimeErrorMessage(null);

    try {
      const [detailResponse, optionsResponse] = await Promise.all([
        apiRequest<LeadResponse>(`/leads/${leadId}`, {
          method: "GET",
          accessToken
        }),
        apiRequest<LeadOptionsResponse>("/leads/options", {
          method: "GET",
          accessToken
        })
      ]);
      setData(detailResponse);
      setOwners(optionsResponse.owners);
      setLeadOptions(optionsResponse);
      void loadRuntime();
    } catch (error) {
      setData(null);
      setRuntimeData(null);
      setLeadOptions(null);
      setOwners([]);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLead();
  }, [accessToken, leadId]);

  async function handleAddNote(payload: CreateCrmNoteRequestBody) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/records/lead/${leadId}/notes`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadLead();
  }

  async function handleUpdateNote(noteId: string, payload: UpdateCrmNoteRequestBody) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/records/lead/${leadId}/notes/${noteId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadLead();
  }

  async function handleAddActivity(payload: CreateCrmActivityRequestBody) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/records/lead/${leadId}/activities`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadLead();
  }

  async function handleAddTask(payload: CreateCrmTaskRequestBody) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/records/lead/${leadId}/tasks`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadLead();
  }

  async function handleUpdateTask(taskId: string, payload: UpdateCrmTaskRequestBody) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/records/lead/${leadId}/tasks/${taskId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadLead();
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${leadLabel.toLowerCase()} detail`}
        description="The page is fetching the tenant-safe record, activities, notes, tasks, and customer timeline."
      />
    );
  }

  const lead = data?.lead;

  if (!lead) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">This {leadLabel.toLowerCase()} could not be loaded.</p>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "The record is unavailable."}</p>
          <Button asChild>
            <Link to="/leads">Back to {getModuleLabel("leads").toLowerCase()}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const customFieldDefinitions = getActiveCustomFieldDefinitions(leadOptions);
  const customFieldDefinitionKeys = new Set(customFieldDefinitions.map((field) => field.fieldKey));
  const configuredCustomFields = customFieldDefinitions.filter((field) => hasCustomFieldValue(lead.customFields[field.fieldKey]));
  const orphanCustomFields = Object.entries(lead.customFields).filter(
    ([fieldKey, value]) => !customFieldDefinitionKeys.has(fieldKey) && hasCustomFieldValue(value)
  );

  function renderCustomFieldValue(fieldKey: string, rawValue: unknown, dataType?: string) {
    if (dataType === "multiselect") {
      const labels = getCustomFieldOptionLabels(
        leadOptions,
        customFieldDefinitions.find((field) => field.fieldKey === fieldKey) ?? { dataType: "multiselect", optionSetKey: null },
        rawValue
      );

      return labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {labels.map((label) => (
            <Badge key={label} variant="muted">
              {label}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 font-semibold">Not provided</p>
      );
    }

    if (dataType === "select") {
      const label = getCustomFieldOptionLabels(
        leadOptions,
        customFieldDefinitions.find((field) => field.fieldKey === fieldKey) ?? { dataType: "select", optionSetKey: null },
        rawValue
      )[0];
      return <p className="mt-2 font-semibold">{label ?? "Not provided"}</p>;
    }

    if (typeof rawValue === "boolean") {
      return <p className="mt-2 font-semibold">{rawValue ? "Yes" : "No"}</p>;
    }

    if (typeof rawValue === "number") {
      return <p className="mt-2 font-semibold">{rawValue}</p>;
    }

    if (typeof rawValue === "string") {
      if (rawValue.trim().length === 0) {
        return <p className="mt-2 font-semibold">Not provided</p>;
      }
      if (dataType === "date") {
        return <p className="mt-2 font-semibold">{formatDateOnly(rawValue)}</p>;
      }
      if (dataType === "datetime") {
        return <p className="mt-2 font-semibold">{formatDateTime(rawValue)}</p>;
      }
      return <p className="mt-2 font-semibold">{rawValue}</p>;
    }

    return <p className="mt-2 font-semibold">Not provided</p>;
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Lead detail"
        title={`${lead.companyName} is now tracked as a live ${leadLabel.toLowerCase()} record.`}
        summary={`${lead.fullName} sits inside the authenticated CRM foundation with source tracking, ownership, notes, activities, task tracking, and a customer timeline ready for later opportunity conversion.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/leads">Back to list</Link>
            </Button>
            {canEdit ? (
              <Button asChild>
                <Link to={`/leads/${lead.id}/edit`}>Edit {leadLabel}</Link>
              </Button>
            ) : null}
            {canDelete ? <Badge variant="muted">Soft delete available from list view</Badge> : null}
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Status"
              value={lead.status?.label ?? "Missing"}
              description={`Current qualification state for this ${leadLabel.toLowerCase()} within the tenant.`}
            />
            <CrmMetricCard
              label="Source"
              value={lead.source?.label ?? "Missing"}
              description="Source values are backed by the tenant option catalog seeded for this workspace."
            />
          </div>
        }
      />

      <BpfStageProgress object="lead" recordId={lead.id} canEdit={canEdit} />

      {runtimeData ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration-driven runtime guidance</CardTitle>
            <CardDescription>
              Scoring, MQL, assignment, and SLA guidance is computed from governed configuration definitions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Score</p>
              <p className="mt-2 text-2xl font-semibold">{runtimeData.scoring?.result.finalScore ?? "Config missing"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Grade {runtimeData.scoring?.result.grade?.toUpperCase() ?? "not available"}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">MQL</p>
              <div className="mt-2">
                <Badge variant={runtimeData.mql?.result.isMql ? "default" : "muted"}>
                  {runtimeData.mql ? (runtimeData.mql.result.isMql ? "Qualified" : "Not MQL") : "Config missing"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {runtimeData.mql?.result.reasons[0] ?? "No MQL rule is active for this tenant."}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Assignment</p>
              <p className="mt-2 font-semibold">{runtimeData.assignment?.resolution.strategy ?? "Config missing"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {runtimeData.assignment?.resolution.reason ?? "No assignment rule is active for this tenant."}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">SLA</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {runtimeData.sla?.targets.map((target) => (
                  <Badge
                    key={target.key}
                    variant="muted"
                    className={
                      target.status === "breached"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : target.status === "warning"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : undefined
                    }
                  >
                    {target.label}: {target.status}
                  </Badge>
                )) ?? <Badge variant="muted">Config missing</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {runtimeData.sla?.targets[0] ? `Next due: ${formatDateTime(runtimeData.sla.targets[0].dueAt)}` : "No SLA policy is active."}
              </p>
            </div>
            {runtimeData.configGaps.length > 0 ? (
              <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 lg:col-span-4">
                {runtimeData.configGaps.join(" ")}
              </div>
            ) : null}
            {runtimeData.assignment?.requiresRuntimeSelection || runtimeData.sla?.breachDispatchRecommended ? (
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 lg:col-span-4">
                Runtime worker note: {runtimeData.deferredRuntimeActions.join(" ")}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {runtimeErrorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration-driven runtime guidance</CardTitle>
            <CardDescription>Runtime guidance is temporarily unavailable for this lead.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{runtimeErrorMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{lead.fullName}</CardTitle>
            <CardDescription>
              Core intake data, owner assignment, and qualification details for this record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Company</p>
              <p className="mt-2 font-semibold">{lead.companyName}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
              <p className="mt-2 font-semibold">{lead.owner?.displayName ?? "Unassigned"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</p>
              <p className="mt-2 font-semibold">{lead.email ? <EmailLink email={lead.email} /> : "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
              <p className="mt-2 font-semibold">{lead.phone ? <PhoneLink phone={lead.phone} /> : "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lead score placeholder</p>
              <p className="mt-2 font-semibold">{lead.score ?? "Not scored yet"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last activity</p>
              <p className="mt-2 font-semibold">{formatDateTime(lead.lastActivityAt)}</p>
            </div>
          </CardContent>
        </Card>

        {(() => {
          const classification = (lead.metadata ?? {}) as LeadClassificationMetadata;
          if (!classification.leadFor) {
            return null;
          }
          const leadForLabel =
            leadOptions?.leadForOptions.find((option) => option.key === classification.leadFor)?.label ?? classification.leadFor;
          const isService = classification.leadFor === "service_project";
          const selectedKeys = isService ? classification.technologies ?? [] : classification.products ?? [];
          const catalog = isService ? leadOptions?.technologyOptions ?? [] : leadOptions?.productOptions ?? [];
          const selectedLabels = selectedKeys.map((key) => catalog.find((option) => option.key === key)?.label ?? key);
          return (
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Lead classification</CardTitle>
                <CardDescription>
                  Whether this is an IT service project or a product opportunity, and the {isService ? "technologies" : "products"} involved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lead For</p>
                  <p className="mt-2 font-semibold">{leadForLabel}</p>
                </div>
                <div className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{isService ? "Technologies" : "Products"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLabels.length > 0 ? (
                      selectedLabels.map((label) => (
                        <Badge key={label} variant="muted">
                          {label}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">None selected</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {configuredCustomFields.length > 0 || orphanCustomFields.length > 0 ? (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Tenant-defined fields</CardTitle>
              <CardDescription>
                Extra workspace-configured lead attributes are stored alongside the core record.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {configuredCustomFields.map((field) => (
                <div key={field.fieldKey} className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{field.label}</p>
                  {renderCustomFieldValue(field.fieldKey, lead.customFields[field.fieldKey], field.dataType)}
                </div>
              ))}
              {orphanCustomFields.map(([fieldKey, value]) => (
                <div key={fieldKey} className="rounded-[1.25rem] bg-background/75 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{formatFallbackCustomFieldLabel(fieldKey)}</p>
                  {renderCustomFieldValue(fieldKey, value)}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {lead.conversion ? (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Conversion summary</CardTitle>
              <CardDescription>
                This lead has been converted into pipeline entities with duplicate checks and a handoff task recorded.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Converted at</p>
                <p className="mt-2 font-semibold">{formatDateTime(lead.conversion.convertedAt)}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Qualification summary</p>
                <p className="mt-2 text-sm leading-6">{lead.conversion.qualificationSummary ?? "No handoff notes were captured."}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</p>
                {lead.conversion.account ? (
                  <Link className="mt-2 block font-semibold text-primary underline-offset-4 hover:underline" to={`/accounts/${lead.conversion.account.id}`}>
                    {lead.conversion.account.name}
                  </Link>
                ) : (
                  <p className="mt-2 font-semibold">Not linked</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">Linked via {lead.conversion.accountLinkMode} account record.</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contact</p>
                {lead.conversion.contact ? (
                  <Link className="mt-2 block font-semibold text-primary underline-offset-4 hover:underline" to={`/contacts/${lead.conversion.contact.id}`}>
                    {lead.conversion.contact.fullName}
                  </Link>
                ) : (
                  <p className="mt-2 font-semibold">Not linked</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">Linked via {lead.conversion.contactLinkMode} contact record.</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Opportunity</p>
                {lead.conversion.opportunity ? (
                  <Link
                    className="mt-2 block font-semibold text-primary underline-offset-4 hover:underline"
                    to={`/opportunities/${lead.conversion.opportunity.id}`}
                  >
                    {lead.conversion.opportunity.name}
                  </Link>
                ) : (
                  <p className="mt-2 font-semibold">Not linked</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  Stage {lead.conversion.opportunity?.stage?.label ?? "not available"}
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Handoff task</p>
                <p className="mt-2 font-semibold">{lead.conversion.handoffTask?.title ?? "No handoff task created"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.conversion.handoffTask?.status ?? "Unknown"} · duplicate check completed{" "}
                  {formatDateTime(lead.conversion.duplicateCheckCompletedAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Foundation summary</CardTitle>
            <CardDescription>
              These cards show the cross-cutting behaviors already attached to this record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audit-safe timestamps</p>
              <p className="mt-2 text-sm leading-6">
                Created {formatShortDate(lead.createdAt)} and last updated {formatDateTime(lead.updatedAt)}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline coverage</p>
              <p className="mt-2 text-sm leading-6">
                {lead.noteCount} notes, {lead.activityCount} activities, and {lead.tasks.length} tasks are attached to this{" "}
                {leadLabel.toLowerCase()}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conversion placeholder</p>
              <p className="mt-2 text-sm leading-6">{lead.conversionPlaceholder.message}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <CrmNotesPanel
          entityLabel={leadLabel}
          notes={lead.notes}
          canWrite={canManageProductivity}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
        />
        <CrmActivityPanel
          entityLabel={leadLabel}
          activities={lead.activities}
          owners={owners}
          canWrite={canManageProductivity}
          onAddActivity={handleAddActivity}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <CrmTaskList
          entityLabel={leadLabel}
          tasks={lead.tasks}
          owners={owners}
          canWrite={canManageProductivity}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
        />
        <CrmTimeline entityLabel={leadLabel} items={lead.timeline} />
      </section>
    </div>
  );
}
