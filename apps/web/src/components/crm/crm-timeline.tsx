import { useState } from "react";
import type {
  CreateCrmActivityRequestBody,
  CrmActivitySummary,
  CrmNoteSummary
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import { formatDateTime, selectClassName, textareaClassName } from "@/lib/crm";

interface CrmTimelineProps {
  entityLabel: string;
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  canWrite: boolean;
  onAddNote: (body: string) => Promise<void>;
  onAddActivity: (payload: CreateCrmActivityRequestBody) => Promise<void>;
}

export function CrmTimeline({
  entityLabel,
  notes,
  activities,
  canWrite,
  onAddNote,
  onAddActivity
}: CrmTimelineProps) {
  const [noteBody, setNoteBody] = useState("");
  const [activityType, setActivityType] = useState<CreateCrmActivityRequestBody["activityType"]>("call");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleNoteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingNote(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onAddNote(noteBody);
      setNoteBody("");
      setMessage(`${entityLabel} note captured.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleActivitySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingActivity(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onAddActivity({
        activityType,
        subject: activitySubject,
        description: activityDescription || null
      });
      setActivityType("call");
      setActivitySubject("");
      setActivityDescription("");
      setMessage(`${entityLabel} activity logged.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmittingActivity(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Notes and activity</CardTitle>
          <CardDescription>
            Every update stays tenant-scoped and feeds the shared CRM timeline model for this record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold">Activity feed</h4>
              <Badge variant="muted">{activities.length} logged</Badge>
            </div>
            {activities.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No activities have been logged for this record yet.
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{activity.activityType.replace("_", " ")}</Badge>
                    <p className="font-semibold">{activity.subject}</p>
                  </div>
                  {activity.description ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{activity.description}</p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {activity.author?.displayName ?? "System"} • {formatDateTime(activity.occurredAt)}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold">Notes</h4>
              <Badge variant="muted">{notes.length} saved</Badge>
            </div>
            {notes.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No notes have been saved for this record yet.
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
                  <p className="text-sm leading-6">{note.body}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {note.author?.displayName ?? "System"} • {formatDateTime(note.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add note</CardTitle>
            <CardDescription>
              Capture context that should stay with this {entityLabel.toLowerCase()} across handoffs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleNoteSubmit}>
              <textarea
                className={textareaClassName}
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder={`Add a note for this ${entityLabel.toLowerCase()}...`}
                disabled={!canWrite || isSubmittingNote}
              />
              <Button type="submit" disabled={!canWrite || isSubmittingNote || noteBody.trim().length < 2}>
                {isSubmittingNote ? "Saving note..." : "Save note"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log activity</CardTitle>
            <CardDescription>
              Track the operational touchpoints that happened around this {entityLabel.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleActivitySubmit}>
              <label className="space-y-2">
                <span className="text-sm font-medium">Activity type</span>
                <select
                  className={selectClassName}
                  value={activityType}
                  onChange={(event) =>
                    setActivityType(event.target.value as CreateCrmActivityRequestBody["activityType"])
                  }
                  disabled={!canWrite || isSubmittingActivity}
                >
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="task">Task</option>
                  <option value="status_change">Status change</option>
                  <option value="note">Note</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Subject</span>
                <Input
                  value={activitySubject}
                  onChange={(event) => setActivitySubject(event.target.value)}
                  placeholder="Discovery call completed"
                  disabled={!canWrite || isSubmittingActivity}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className={textareaClassName}
                  value={activityDescription}
                  onChange={(event) => setActivityDescription(event.target.value)}
                  placeholder="Capture the decision, context, or next action."
                  disabled={!canWrite || isSubmittingActivity}
                />
              </label>
              <Button
                type="submit"
                disabled={!canWrite || isSubmittingActivity || activitySubject.trim().length < 2}
              >
                {isSubmittingActivity ? "Logging activity..." : "Log activity"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
