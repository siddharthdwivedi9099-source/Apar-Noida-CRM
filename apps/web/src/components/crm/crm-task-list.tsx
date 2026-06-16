import { useEffect, useState, type FormEvent } from "react";
import type {
  CreateCrmTaskRequestBody,
  CrmLookupUserSummary,
  CrmTaskSummary,
  UpdateCrmTaskRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import {
  formatDateTime,
  formatDateTimeInputValue,
  getCrmTaskPriorityLabel,
  getCrmTaskStatusLabel,
  selectClassName,
  textareaClassName
} from "@/lib/crm";

const taskPriorityOptions: NonNullable<CreateCrmTaskRequestBody["priority"]>[] = ["low", "medium", "high", "urgent"];
const taskStatusOptions: NonNullable<CreateCrmTaskRequestBody["status"]>[] = [
  "open",
  "in_progress",
  "blocked",
  "completed",
  "cancelled"
];

interface CrmTaskListProps {
  entityLabel: string;
  tasks: CrmTaskSummary[];
  owners: CrmLookupUserSummary[];
  canWrite: boolean;
  onAddTask: (payload: CreateCrmTaskRequestBody) => Promise<void>;
  onUpdateTask: (taskId: string, payload: UpdateCrmTaskRequestBody) => Promise<void>;
}

interface EditableTaskCardProps {
  task: CrmTaskSummary;
  owners: CrmLookupUserSummary[];
  canWrite: boolean;
  onUpdateTask: (taskId: string, payload: UpdateCrmTaskRequestBody) => Promise<void>;
}

function EditableTaskCard({ task, owners, canWrite, onUpdateTask }: EditableTaskCardProps) {
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [ownerId, setOwnerId] = useState(task.owner?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? "");
  const [dueAt, setDueAt] = useState(formatDateTimeInputValue(task.dueAt));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatus(task.status);
    setPriority(task.priority);
    setOwnerId(task.owner?.id ?? "");
    setAssigneeId(task.assignee?.id ?? "");
    setDueAt(formatDateTimeInputValue(task.dueAt));
  }, [task]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onUpdateTask(task.id, {
        status,
        priority,
        ownerId: ownerId || null,
        assigneeId: assigneeId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null
      });
      setMessage("Task updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{getCrmTaskStatusLabel(task.status)}</Badge>
        <Badge variant={task.priority === "urgent" ? "success" : "default"}>{getCrmTaskPriorityLabel(task.priority)}</Badge>
        <p className="font-semibold">{task.title}</p>
      </div>
      {task.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description}</p> : null}
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Owner {task.owner?.displayName ?? "Unassigned"} • Assignee {task.assignee?.displayName ?? "Unassigned"} • Due{" "}
        {formatDateTime(task.dueAt)}
      </p>
      {task.reminderAt ? (
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Reminder placeholder {formatDateTime(task.reminderAt)}
        </p>
      ) : null}

      {canWrite ? (
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
          <label className="space-y-2">
            <span className="text-sm font-medium">Status</span>
            <select
              className={selectClassName}
              value={status}
              onChange={(event) => setStatus(event.target.value as CrmTaskSummary["status"])}
              disabled={isSubmitting}
            >
              {taskStatusOptions.map((value) => (
                <option key={value} value={value}>
                  {getCrmTaskStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Priority</span>
            <select
              className={selectClassName}
              value={priority}
              onChange={(event) => setPriority(event.target.value as CrmTaskSummary["priority"])}
              disabled={isSubmitting}
            >
              {taskPriorityOptions.map((value) => (
                <option key={value} value={value}>
                  {getCrmTaskPriorityLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Owner</span>
            <select
              className={selectClassName}
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Unassigned</option>
              {owners.map((owner) => (
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
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium">Due at</span>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving task..." : "Save task changes"}
            </Button>
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function CrmTaskList({ entityLabel, tasks, owners, canWrite, onAddTask, onUpdateTask }: CrmTaskListProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [priority, setPriority] = useState<CreateCrmTaskRequestBody["priority"]>("medium");
  const [status, setStatus] = useState<CreateCrmTaskRequestBody["status"]>("open");
  const [ownerId, setOwnerId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onAddTask({
        title,
        description: description || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        priority,
        status,
        ownerId: ownerId || null,
        assigneeId: assigneeId || null
      });

      setTitle("");
      setDescription("");
      setDueAt("");
      setReminderAt("");
      setPriority("medium");
      setStatus("open");
      setOwnerId("");
      setAssigneeId("");
      setMessage(`${entityLabel} task created.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>
          Assign work, track status, and keep due dates attached to this {entityLabel.toLowerCase()} record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Assigned tasks</h4>
            <Badge variant="muted">{tasks.length} active</Badge>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              No tasks have been created for this record yet.
            </div>
          ) : (
            tasks.map((task) => (
              <EditableTaskCard key={task.id} task={task} owners={owners} canWrite={canWrite} onUpdateTask={onUpdateTask} />
            ))
          )}
        </div>

        {canWrite ? (
          <form className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-5" onSubmit={handleCreateTask}>
            <div className="space-y-2">
              <h4 className="font-semibold">Create task</h4>
              <p className="text-sm text-muted-foreground">
                Set ownership, status, priority, and due dates without leaving the current {entityLabel.toLowerCase()}.
              </p>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">Title</span>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Prepare follow-up proposal"
                disabled={isSubmitting}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Description</span>
              <textarea
                className={textareaClassName}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Capture task details, dependencies, or the expected outcome."
                disabled={isSubmitting}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Priority</span>
                <select
                  className={selectClassName}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as CreateCrmTaskRequestBody["priority"])}
                  disabled={isSubmitting}
                >
                  {taskPriorityOptions.map((value) => (
                    <option key={value} value={value}>
                      {getCrmTaskPriorityLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Status</span>
                <select
                  className={selectClassName}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as CreateCrmTaskRequestBody["status"])}
                  disabled={isSubmitting}
                >
                  {taskStatusOptions.map((value) => (
                    <option key={value} value={value}>
                      {getCrmTaskStatusLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Owner</span>
                <select
                  className={selectClassName}
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Current user</option>
                  {owners.map((owner) => (
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
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Match owner</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Due at</span>
                <Input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Reminder placeholder</span>
                <Input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(event) => setReminderAt(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <Button type="submit" disabled={isSubmitting || title.trim().length < 2}>
              {isSubmitting ? "Creating task..." : "Create task"}
            </Button>
          </form>
        ) : (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            You can review task status here, but task assignment and updates require additional permissions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
