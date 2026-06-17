import { useEffect, useMemo, useState } from "react";
import type {
  CreateCrmTaskRequestBody,
  InsideSalesWorkspaceResponse,
  SalesWorkspaceLeadSummary,
  SalesWorkspaceOptionsResponse,
  SalesWorkspaceTaskSummary,
  UpdateLeadWorkspaceRequestBody
} from "@crm/types";
import { Link } from "react-router-dom";
import { LeadWorkflowWorkbench } from "@/components/sales/lead-workflow-workbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

function getUniqueLeads(leads: SalesWorkspaceLeadSummary[]) {
  const map = new Map<string, SalesWorkspaceLeadSummary>();

  for (const lead of leads) {
    if (!map.has(lead.id)) {
      map.set(lead.id, lead);
    }
  }

  return Array.from(map.values());
}

interface LeadQueueCardProps {
  title: string;
  description: string;
  leads: SalesWorkspaceLeadSummary[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  emptyMessage: string;
}

function LeadQueueCard({
  title,
  description,
  leads,
  selectedLeadId,
  onSelect,
  emptyMessage
}: LeadQueueCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {leads.length === 0 ? (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          leads.map((lead) => (
            <button
              key={lead.id}
              type="button"
              onClick={() => onSelect(lead.id)}
              className={cn(
                "w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50",
                selectedLeadId === lead.id ? "border-primary bg-primary/5" : ""
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{lead.status?.label ?? "Status missing"}</Badge>
                {lead.workspace.callDisposition ? <Badge variant="muted">{lead.workspace.callDisposition.label}</Badge> : null}
                {lead.workspace.handoffStatus ? <Badge variant="muted">{lead.workspace.handoffStatus.label}</Badge> : null}
              </div>
              <p className="mt-3 font-semibold">{lead.fullName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{lead.companyName}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {lead.workspace.qualificationChecklistCompletionCount}/{lead.workspace.qualificationChecklistTotal} BANT
                complete • {lead.overdueTaskCount} overdue tasks
              </p>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

interface TaskQueueCardProps {
  title: string;
  description: string;
  tasks: SalesWorkspaceTaskSummary[];
  onSelectLead: (leadId: string) => void;
  emptyMessage: string;
}

function TaskQueueCard({ title, description, tasks, onSelectLead, emptyMessage }: TaskQueueCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelectLead(task.lead.id)}
              className="w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{task.status}</Badge>
                <Badge variant="muted">{task.priority}</Badge>
              </div>
              <p className="mt-3 font-semibold">{task.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {task.lead.fullName} • {task.lead.companyName}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Due {formatDateTime(task.dueAt)} • Assignee {task.assignee?.displayName ?? "Unassigned"}
              </p>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function InsideSalesWorkspacePage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const leadLabel = getModuleLabel("leads", "singular");
  const [options, setOptions] = useState<SalesWorkspaceOptionsResponse | null>(null);
  const [data, setData] = useState<InsideSalesWorkspaceResponse | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canCreateLead = hasAnyPermission(["leads.create", "leads.configure"]);
  const canUpdateWorkflow = hasAnyPermission(["leads.edit", "leads.configure", "sales.edit", "sales.configure"]);
  const canAssignOwner = hasAnyPermission(["leads.assign", "leads.configure", "sales.assign", "sales.configure"]);
  const canEditWorkflow = canUpdateWorkflow || canAssignOwner;
  const canCreateTask = hasAnyPermission(["leads.create", "leads.edit", "leads.assign", "leads.configure"]);

  const visibleLeads = useMemo(() => getUniqueLeads(data?.leadQueue ?? []), [data?.leadQueue]);
  const selectedLead = visibleLeads.find((lead) => lead.id === selectedLeadId) ?? visibleLeads[0] ?? null;
  const selectedLeadTasks = useMemo(
    () =>
      [...(data?.callQueue ?? []), ...(data?.followUpTasks ?? [])].filter((task) => task.lead.id === selectedLead?.id),
    [data?.callQueue, data?.followUpTasks, selectedLead?.id]
  );

  async function loadWorkspace() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, workspaceResponse] = await Promise.all([
        apiRequest<SalesWorkspaceOptionsResponse>("/sales-workspaces/options", {
          method: "GET",
          accessToken
        }),
        apiRequest<InsideSalesWorkspaceResponse>("/sales-workspaces/inside-sales", {
          method: "GET",
          accessToken
        })
      ]);
      setOptions(optionsResponse);
      setData(workspaceResponse);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [accessToken]);

  useEffect(() => {
    if (!visibleLeads.length) {
      setSelectedLeadId(null);
      return;
    }

    setSelectedLeadId((currentValue) =>
      currentValue && visibleLeads.some((lead) => lead.id === currentValue) ? currentValue : visibleLeads[0].id
    );
  }, [visibleLeads]);

  async function handleSaveWorkflow(leadId: string, payload: UpdateLeadWorkspaceRequestBody) {
    if (!accessToken) {
      return;
    }

    await apiRequest(`/sales-workspaces/leads/${leadId}/workflow`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadWorkspace();
    setSelectedLeadId(leadId);
  }

  async function handleCreateTask(leadId: string, payload: CreateCrmTaskRequestBody) {
    if (!accessToken) {
      return;
    }

    await apiRequest(`/records/lead/${leadId}/tasks`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadWorkspace();
    setSelectedLeadId(leadId);
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title="Loading inside sales workspace"
        description="Lead qualification forms, call queue, and handoff-ready task data are loading from the API."
      />
    );
  }

  if (!data || !options) {
    return (
      <CrmEmptyState
        title="The inside sales workspace could not be loaded."
        description={errorMessage ?? "The current tenant session could not load the inside sales queue."}
        action={
          <Button variant="outline" onClick={() => void loadWorkspace()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Inside sales workspace"
        title="Lead qualification, call disposition, and conversion handoff now live in one inside-sales queue."
        summary="This workspace turns the lead queue into an execution surface for qualification forms, status updates, call outcomes, and sales handoff tracking while preserving tenant isolation and role-aware behavior."
        actions={
          <>
            {canCreateLead ? (
              <Button asChild>
                <Link to="/leads/new">Create {leadLabel}</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/leads">Open leads module</Link>
            </Button>
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Lead queue"
              value={String(data.dashboard.leadQueueCount)}
              description="Leads currently visible for qualification and status progression."
            />
            <CrmMetricCard
              label="Call queue"
              value={String(data.dashboard.callQueueCount)}
              description="Open call tasks attached to lead records in this workspace."
            />
            <CrmMetricCard
              label="Handed off"
              value={String(data.dashboard.handedOffLeadCount)}
              description="Leads that have already progressed into sales handoff states."
            />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <LeadQueueCard
          title="Lead queue"
          description="Work the current queue with qualification notes, BANT progress, and ownership updates."
          leads={data.leadQueue}
          selectedLeadId={selectedLeadId}
          onSelect={setSelectedLeadId}
          emptyMessage="No inside sales leads are currently visible for this role."
        />
        <TaskQueueCard
          title="Call queue"
          description="Open call tasks remain visible here for same-day execution."
          tasks={data.callQueue}
          onSelectLead={setSelectedLeadId}
          emptyMessage="No open call tasks are currently visible."
        />
        <TaskQueueCard
          title="Follow-up tasks"
          description="Qualification and conversion follow-ups stay attached to the originating lead."
          tasks={data.followUpTasks}
          onSelectLead={setSelectedLeadId}
          emptyMessage="No follow-up tasks are currently visible."
        />
      </section>

      {visibleLeads.length === 0 ? (
        <CrmEmptyState
          title="No inside sales leads are currently visible."
          description="Once leads enter the inside-sales workflow, this queue will expose qualification, call disposition, and handoff controls."
          action={
            <Button variant="outline" asChild>
              <Link to="/leads">Review lead inventory</Link>
            </Button>
          }
        />
      ) : (
        <LeadWorkflowWorkbench
          workspaceLabel="Inside Sales Workspace"
          leadLabel={leadLabel}
          lead={selectedLead}
          tasks={selectedLeadTasks}
          options={options}
          canEditWorkflow={canEditWorkflow}
          canUpdateWorkflow={canUpdateWorkflow}
          canAssignOwner={canAssignOwner}
          canCreateTask={canCreateTask}
          allowedTaskTypes={["call", "follow_up"]}
          defaultTaskType="follow_up"
          onSaveWorkflow={handleSaveWorkflow}
          onCreateTask={handleCreateTask}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI placeholders</CardTitle>
          <CardDescription>
            Placeholder actions stay permission-aware now and can attach to the AI Gateway once that phase begins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{data.aiPlaceholders.governanceHint}</p>
          {data.aiPlaceholders.actions.length === 0 ? (
            <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              AI placeholder actions are hidden for your current role.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {data.aiPlaceholders.actions.map((action) => (
                <Button key={action.key} variant="outline" disabled title={action.description}>
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
