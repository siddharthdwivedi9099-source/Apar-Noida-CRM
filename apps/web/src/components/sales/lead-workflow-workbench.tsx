import { useEffect, useState, type FormEvent } from "react";
import type {
  CreateCrmTaskRequestBody,
  LeadBantChecklist,
  LeadCustomQualificationFieldInput,
  LeadQualificationFramework,
  SalesWorkspaceLeadSummary,
  SalesWorkspaceOptionsResponse,
  SalesWorkspaceTaskSummary,
  UpdateLeadWorkspaceRequestBody
} from "@crm/types";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime, getCrmTaskPriorityLabel, getCrmTaskStatusLabel, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";

type WorkspaceTaskType = "call" | "follow_up";

interface LeadWorkflowWorkbenchProps {
  workspaceLabel: string;
  leadLabel: string;
  lead: SalesWorkspaceLeadSummary | null;
  tasks: SalesWorkspaceTaskSummary[];
  options: SalesWorkspaceOptionsResponse | null;
  canEditWorkflow: boolean;
  canUpdateWorkflow: boolean;
  canAssignOwner: boolean;
  canCreateTask: boolean;
  allowedTaskTypes: WorkspaceTaskType[];
  defaultTaskType: WorkspaceTaskType;
  onSaveWorkflow: (leadId: string, payload: UpdateLeadWorkspaceRequestBody) => Promise<void>;
  onCreateTask: (leadId: string, payload: CreateCrmTaskRequestBody) => Promise<void>;
}

interface WorkflowDraftState {
  statusKey: string;
  ownerId: string;
  outreachStatusKey: string;
  handoffStatusKey: string;
  callDispositionKey: string;
  qualificationFramework: LeadQualificationFramework;
  qualificationChecklist: LeadBantChecklist;
  qualificationNotes: string;
  customQualificationFields: LeadCustomQualificationFieldInput[];
}

interface TaskDraftState {
  title: string;
  description: string;
  dueAt: string;
  priority: NonNullable<CreateCrmTaskRequestBody["priority"]>;
  ownerId: string;
  assigneeId: string;
  taskType: WorkspaceTaskType;
}

function getInitialWorkflowDraft(lead: SalesWorkspaceLeadSummary | null): WorkflowDraftState {
  return {
    statusKey: lead?.status?.key ?? "",
    ownerId: lead?.owner?.id ?? "",
    outreachStatusKey: lead?.workspace.outreachStatus?.key ?? "",
    handoffStatusKey: lead?.workspace.handoffStatus?.key ?? "",
    callDispositionKey: lead?.workspace.callDisposition?.key ?? "",
    qualificationFramework: lead?.workspace.qualificationFramework ?? "bant",
    qualificationChecklist: lead?.workspace.qualificationChecklist ?? {
      budget: false,
      authority: false,
      need: false,
      timeline: false
    },
    qualificationNotes: lead?.workspace.qualificationNotes ?? "",
    customQualificationFields: lead?.workspace.customQualificationFields.map((field) => ({
      id: field.id,
      label: field.label,
      value: field.value
    })) ?? []
  };
}

function getInitialTaskDraft(
  lead: SalesWorkspaceLeadSummary | null,
  defaultTaskType: WorkspaceTaskType
): TaskDraftState {
  return {
    title: "",
    description: "",
    dueAt: "",
    priority: defaultTaskType === "call" ? "high" : "medium",
    ownerId: lead?.owner?.id ?? "",
    assigneeId: lead?.owner?.id ?? "",
    taskType: defaultTaskType
  };
}

function getTaskTypeValue(task: SalesWorkspaceTaskSummary): WorkspaceTaskType {
  return task.metadata.phase11TaskType === "call" ? "call" : "follow_up";
}

function getTaskTypeLabel(value: WorkspaceTaskType) {
  return value === "call" ? "Call task" : "Follow-up task";
}

function getQualificationFieldLabel(key: keyof LeadBantChecklist) {
  switch (key) {
    case "budget":
      return "Budget";
    case "authority":
      return "Authority";
    case "need":
      return "Need";
    case "timeline":
      return "Timeline";
  }
}

export function LeadWorkflowWorkbench({
  workspaceLabel,
  leadLabel,
  lead,
  tasks,
  options,
  canEditWorkflow,
  canUpdateWorkflow,
  canAssignOwner,
  canCreateTask,
  allowedTaskTypes,
  defaultTaskType,
  onSaveWorkflow,
  onCreateTask
}: LeadWorkflowWorkbenchProps) {
  const [workflowDraft, setWorkflowDraft] = useState<WorkflowDraftState>(getInitialWorkflowDraft(lead));
  const [taskDraft, setTaskDraft] = useState<TaskDraftState>(getInitialTaskDraft(lead, defaultTaskType));
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);
  const [workflowErrorMessage, setWorkflowErrorMessage] = useState<string | null>(null);
  const [taskErrorMessage, setTaskErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowDraft(getInitialWorkflowDraft(lead));
    setTaskDraft(getInitialTaskDraft(lead, defaultTaskType));
    setWorkflowMessage(null);
    setTaskMessage(null);
    setWorkflowErrorMessage(null);
    setTaskErrorMessage(null);
  }, [defaultTaskType, lead]);

  async function handleSaveWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!lead) {
      return;
    }

    setIsSavingWorkflow(true);
    setWorkflowMessage(null);
    setWorkflowErrorMessage(null);

    try {
      const payload: UpdateLeadWorkspaceRequestBody = {};

      if (canUpdateWorkflow) {
        payload.statusKey = workflowDraft.statusKey;
        payload.outreachStatusKey = workflowDraft.outreachStatusKey || null;
        payload.handoffStatusKey = workflowDraft.handoffStatusKey || null;
        payload.callDispositionKey = workflowDraft.callDispositionKey || null;
        payload.qualificationFramework = workflowDraft.qualificationFramework;
        payload.qualificationChecklist = workflowDraft.qualificationChecklist;
        payload.qualificationNotes = workflowDraft.qualificationNotes.trim() || null;
        payload.customQualificationFields = workflowDraft.customQualificationFields
          .map((field) => ({
            id: field.id,
            label: field.label.trim(),
            value: field.value.trim()
          }))
          .filter((field) => field.label.length > 0 || field.value.length > 0);
      }

      if (canAssignOwner) {
        payload.ownerId = workflowDraft.ownerId || null;
      }

      await onSaveWorkflow(lead.id, {
        ...payload
      });
      setWorkflowMessage(`${lead.fullName} was updated.`);
    } catch (error) {
      setWorkflowErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!lead) {
      return;
    }

    setIsCreatingTask(true);
    setTaskMessage(null);
    setTaskErrorMessage(null);

    try {
      await onCreateTask(lead.id, {
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim() || null,
        dueAt: taskDraft.dueAt ? new Date(taskDraft.dueAt).toISOString() : null,
        priority: taskDraft.priority,
        status: "open",
        ownerId: taskDraft.ownerId || null,
        assigneeId: taskDraft.assigneeId || null,
        metadata: {
          phase11TaskType: taskDraft.taskType,
          workspace: workspaceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_")
        }
      });
      setTaskDraft(getInitialTaskDraft(lead, defaultTaskType));
      setTaskMessage(`${getTaskTypeLabel(taskDraft.taskType)} created for ${lead.fullName}.`);
    } catch (error) {
      setTaskErrorMessage(getErrorMessage(error));
    } finally {
      setIsCreatingTask(false);
    }
  }

  if (!lead || !options) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">Select a {leadLabel.toLowerCase()} to open the workspace workbench.</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Queue selection loads qualification controls, handoff status, placeholders, and lead-linked task creation
            in one place.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{lead.fullName}</CardTitle>
            <CardDescription>
              {lead.companyName} is active inside the {workspaceLabel.toLowerCase()} with tenant-safe workflow state and
              task visibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge>{lead.status?.label ?? "Status missing"}</Badge>
              <Badge variant="muted">{lead.workspace.outreachStatus?.label ?? "Outreach not started"}</Badge>
              <Badge variant="muted">{lead.workspace.handoffStatus?.label ?? "Handoff not started"}</Badge>
              {lead.workspace.callDisposition ? <Badge variant="muted">{lead.workspace.callDisposition.label}</Badge> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
                <p className="mt-2 font-semibold">{lead.owner?.displayName ?? "Unassigned"}</p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Qualification progress</p>
                <p className="mt-2 font-semibold">
                  {lead.workspace.qualificationChecklistCompletionCount}/{lead.workspace.qualificationChecklistTotal}
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Open tasks</p>
                <p className="mt-2 font-semibold">
                  {lead.openTaskCount} total • {lead.openCallTaskCount} calls
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next due</p>
                <p className="mt-2 font-semibold">{formatDateTime(lead.nextOpenTaskDueAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link to={`/leads/${lead.id}`}>Open {leadLabel} detail</Link>
              </Button>
              {canEditWorkflow ? (
                <Button asChild>
                  <Link to={`/leads/${lead.id}/edit`}>Edit {leadLabel}</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{workspaceLabel} workflow</CardTitle>
            <CardDescription>
              Update lead status, ownership, qualification state, outreach progress, and handoff tracking without
              leaving the queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowMessage ? <p className="text-sm text-emerald-600">{workflowMessage}</p> : null}
            {workflowErrorMessage ? <p className="text-sm text-rose-600">{workflowErrorMessage}</p> : null}

            {canEditWorkflow ? (
              <form className="space-y-5" onSubmit={handleSaveWorkflow}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Lead status</span>
                    <select
                      className={selectClassName}
                      value={workflowDraft.statusKey}
                      onChange={(event) =>
                        setWorkflowDraft((currentValue) => ({
                          ...currentValue,
                          statusKey: event.target.value
                        }))
                      }
                      disabled={isSavingWorkflow || !canUpdateWorkflow}
                    >
                      {options.leadStatuses.map((status) => (
                        <option key={status.id} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {canAssignOwner ? (
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Owner</span>
                      <select
                        className={selectClassName}
                        value={workflowDraft.ownerId}
                        onChange={(event) =>
                          setWorkflowDraft((currentValue) => ({
                            ...currentValue,
                            ownerId: event.target.value
                          }))
                        }
                        disabled={isSavingWorkflow}
                      >
                        <option value="">Unassigned</option>
                        {options.owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="rounded-[1.25rem] bg-background/75 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
                      <p className="mt-2 font-semibold">{lead.owner?.displayName ?? "Unassigned"}</p>
                    </div>
                  )}
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Outreach status</span>
                    <select
                      className={selectClassName}
                      value={workflowDraft.outreachStatusKey}
                      onChange={(event) =>
                        setWorkflowDraft((currentValue) => ({
                          ...currentValue,
                          outreachStatusKey: event.target.value
                        }))
                      }
                      disabled={isSavingWorkflow || !canUpdateWorkflow}
                    >
                      <option value="">Not set</option>
                      {options.outreachStatuses.map((status) => (
                        <option key={status.id} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Handoff status</span>
                    <select
                      className={selectClassName}
                      value={workflowDraft.handoffStatusKey}
                      onChange={(event) =>
                        setWorkflowDraft((currentValue) => ({
                          ...currentValue,
                          handoffStatusKey: event.target.value
                        }))
                      }
                      disabled={isSavingWorkflow || !canUpdateWorkflow}
                    >
                      <option value="">Not set</option>
                      {options.handoffStatuses.map((status) => (
                        <option key={status.id} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Call disposition</span>
                    <select
                      className={selectClassName}
                      value={workflowDraft.callDispositionKey}
                      onChange={(event) =>
                        setWorkflowDraft((currentValue) => ({
                          ...currentValue,
                          callDispositionKey: event.target.value
                        }))
                      }
                      disabled={isSavingWorkflow || !canUpdateWorkflow}
                    >
                      <option value="">Not set</option>
                      {options.callDispositions.map((status) => (
                        <option key={status.id} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Framework</span>
                    <select
                      className={selectClassName}
                      value={workflowDraft.qualificationFramework}
                      onChange={(event) =>
                        setWorkflowDraft((currentValue) => ({
                          ...currentValue,
                          qualificationFramework: event.target.value as LeadQualificationFramework
                        }))
                      }
                      disabled={isSavingWorkflow || !canUpdateWorkflow}
                    >
                      {options.qualificationFrameworks.map((framework) => (
                        <option key={framework.key} value={framework.key}>
                          {framework.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                  <div className="space-y-2">
                    <h4 className="font-semibold">BANT qualification checklist</h4>
                    <p className="text-sm leading-6 text-muted-foreground">
                      The live checklist in this phase tracks budget, authority, need, and timeline for handoff
                      readiness.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(Object.keys(workflowDraft.qualificationChecklist) as (keyof LeadBantChecklist)[]).map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-3 rounded-[1rem] bg-background/75 px-4 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={workflowDraft.qualificationChecklist[key]}
                          onChange={(event) =>
                            setWorkflowDraft((currentValue) => ({
                              ...currentValue,
                              qualificationChecklist: {
                                ...currentValue.qualificationChecklist,
                                [key]: event.target.checked
                              }
                            }))
                          }
                          disabled={isSavingWorkflow || !canUpdateWorkflow}
                        />
                        <span>{getQualificationFieldLabel(key)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-medium">Qualification notes</span>
                  <textarea
                    className={textareaClassName}
                    value={workflowDraft.qualificationNotes}
                    onChange={(event) =>
                      setWorkflowDraft((currentValue) => ({
                        ...currentValue,
                        qualificationNotes: event.target.value
                      }))
                    }
                    placeholder="Capture discovery notes, objections, fit, and next steps."
                    disabled={isSavingWorkflow || !canUpdateWorkflow}
                  />
                </label>

                <div className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">Custom qualification fields</h4>
                      <p className="text-sm text-muted-foreground">
                        Store tenant-specific prompts while the schema remains extensible through metadata.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setWorkflowDraft((currentValue) => ({
                          ...currentValue,
                          customQualificationFields: [
                            ...currentValue.customQualificationFields,
                            { label: "", value: "" }
                          ]
                        }))
                      }
                      disabled={isSavingWorkflow || !canUpdateWorkflow}
                    >
                      Add field
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {workflowDraft.customQualificationFields.length === 0 ? (
                      <div className="rounded-[1rem] bg-background/75 px-4 py-3 text-sm leading-6 text-muted-foreground">
                        No custom qualification fields added yet.
                      </div>
                    ) : (
                      workflowDraft.customQualificationFields.map((field, index) => (
                        <div key={field.id ?? `field-${index}`} className="grid gap-3 md:grid-cols-[0.9fr_1.1fr_auto]">
                          <Input
                            value={field.label}
                            onChange={(event) =>
                              setWorkflowDraft((currentValue) => ({
                                ...currentValue,
                                customQualificationFields: currentValue.customQualificationFields.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        label: event.target.value
                                      }
                                    : entry
                                )
                              }))
                            }
                            placeholder="Field label"
                            disabled={isSavingWorkflow || !canUpdateWorkflow}
                          />
                          <Input
                            value={field.value}
                            onChange={(event) =>
                              setWorkflowDraft((currentValue) => ({
                                ...currentValue,
                                customQualificationFields: currentValue.customQualificationFields.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        value: event.target.value
                                      }
                                    : entry
                                )
                              }))
                            }
                            placeholder="Field value"
                            disabled={isSavingWorkflow || !canUpdateWorkflow}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setWorkflowDraft((currentValue) => ({
                                ...currentValue,
                                customQualificationFields: currentValue.customQualificationFields.filter(
                                  (_entry, entryIndex) => entryIndex !== index
                                )
                              }))
                            }
                            disabled={isSavingWorkflow || !canUpdateWorkflow}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSavingWorkflow || (!canAssignOwner && !canUpdateWorkflow) || workflowDraft.statusKey.length === 0}
                >
                  {isSavingWorkflow ? "Saving workflow..." : "Save workflow"}
                </Button>
              </form>
            ) : (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                You can review qualification and handoff state here, but edits require lead assignment or edit
                permissions.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Linked tasks</CardTitle>
            <CardDescription>
              Call tasks and follow-up work remain attached to the same lead record used by the core CRM module.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No tasks are attached to this {leadLabel.toLowerCase()} yet.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{getTaskTypeLabel(getTaskTypeValue(task))}</Badge>
                    <Badge variant={task.status === "completed" ? "success" : "default"}>
                      {getCrmTaskStatusLabel(task.status)}
                    </Badge>
                    <Badge variant="muted">{getCrmTaskPriorityLabel(task.priority)}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{task.title}</p>
                  {task.description ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description}</p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Due {formatDateTime(task.dueAt)} • Assignee {task.assignee?.displayName ?? "Unassigned"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create task</CardTitle>
            <CardDescription>
              Add a call or follow-up task directly from the {workspaceLabel.toLowerCase()} without leaving the queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {taskMessage ? <p className="text-sm text-emerald-600">{taskMessage}</p> : null}
            {taskErrorMessage ? <p className="text-sm text-rose-600">{taskErrorMessage}</p> : null}

            {canCreateTask ? (
              <form className="space-y-4" onSubmit={handleCreateTask}>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Title</span>
                  <Input
                    value={taskDraft.title}
                    onChange={(event) =>
                      setTaskDraft((currentValue) => ({
                        ...currentValue,
                        title: event.target.value
                      }))
                    }
                    placeholder="Book discovery call"
                    disabled={isCreatingTask}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Description</span>
                  <textarea
                    className={textareaClassName}
                    value={taskDraft.description}
                    onChange={(event) =>
                      setTaskDraft((currentValue) => ({
                        ...currentValue,
                        description: event.target.value
                      }))
                    }
                    placeholder="Capture the task context, desired outcome, or talk-track notes."
                    disabled={isCreatingTask}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Task type</span>
                    <select
                      className={selectClassName}
                      value={taskDraft.taskType}
                      onChange={(event) =>
                        setTaskDraft((currentValue) => ({
                          ...currentValue,
                          taskType: event.target.value as WorkspaceTaskType
                        }))
                      }
                      disabled={isCreatingTask}
                    >
                      {allowedTaskTypes.map((taskType) => (
                        <option key={taskType} value={taskType}>
                          {getTaskTypeLabel(taskType)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Priority</span>
                    <select
                      className={selectClassName}
                      value={taskDraft.priority}
                      onChange={(event) =>
                        setTaskDraft((currentValue) => ({
                          ...currentValue,
                          priority: event.target.value as TaskDraftState["priority"]
                        }))
                      }
                      disabled={isCreatingTask}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Owner</span>
                    <select
                      className={selectClassName}
                      value={taskDraft.ownerId}
                      onChange={(event) =>
                        setTaskDraft((currentValue) => ({
                          ...currentValue,
                          ownerId: event.target.value
                        }))
                      }
                      disabled={isCreatingTask}
                    >
                      <option value="">Current user</option>
                      {options.owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Assignee</span>
                    <select
                      className={selectClassName}
                      value={taskDraft.assigneeId}
                      onChange={(event) =>
                        setTaskDraft((currentValue) => ({
                          ...currentValue,
                          assigneeId: event.target.value
                        }))
                      }
                      disabled={isCreatingTask}
                    >
                      <option value="">Match owner</option>
                      {options.owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Due at</span>
                  <Input
                    type="datetime-local"
                    value={taskDraft.dueAt}
                    onChange={(event) =>
                      setTaskDraft((currentValue) => ({
                        ...currentValue,
                        dueAt: event.target.value
                      }))
                    }
                    disabled={isCreatingTask}
                  />
                </label>
                <Button type="submit" disabled={isCreatingTask || taskDraft.title.trim().length < 2}>
                  {isCreatingTask ? "Creating task..." : "Create task"}
                </Button>
              </form>
            ) : (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                Task creation is hidden until the role includes lead create, edit, assign, or configure permissions.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phase placeholders</CardTitle>
            <CardDescription>
              The qualification model already stores enough metadata to absorb richer automation later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">MEDDIC placeholder</p>
              <p className="mt-2 text-sm leading-6">{lead.workspace.meddicPlaceholder.message}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email sequence placeholder</p>
              <p className="mt-2 text-sm leading-6">{lead.workspace.emailSequencePlaceholder.message}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Meeting booking placeholder</p>
              <p className="mt-2 text-sm leading-6">{lead.workspace.meetingBookingPlaceholder.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
