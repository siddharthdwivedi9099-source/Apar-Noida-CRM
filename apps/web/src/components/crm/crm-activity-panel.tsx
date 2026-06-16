import { useState, type FormEvent } from "react";
import type {
  CreateCrmActivityRequestBody,
  CrmActivitySummary,
  CrmLookupUserSummary
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import {
  formatDateTime,
  formatDateTimeInputValue,
  getCrmActivityTypeLabel,
  selectClassName,
  textareaClassName
} from "@/lib/crm";

const manualActivityTypes: CreateCrmActivityRequestBody["activityType"][] = [
  "call",
  "email",
  "meeting",
  "chat",
  "social",
  "demo",
  "training",
  "support",
  "renewal"
];

interface CrmActivityPanelProps {
  entityLabel: string;
  activities: CrmActivitySummary[];
  owners: CrmLookupUserSummary[];
  canWrite: boolean;
  onAddActivity: (payload: CreateCrmActivityRequestBody) => Promise<void>;
}

export function CrmActivityPanel({
  entityLabel,
  activities,
  owners,
  canWrite,
  onAddActivity
}: CrmActivityPanelProps) {
  const [activityType, setActivityType] = useState<CreateCrmActivityRequestBody["activityType"]>("call");
  const [subject, setSubject] = useState("");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(formatDateTimeInputValue(new Date().toISOString()));
  const [ownerId, setOwnerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onAddActivity({
        activityType,
        subject,
        outcome: outcome || null,
        notes: notes || null,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        ownerId: ownerId || null
      });

      setActivityType("call");
      setSubject("");
      setOutcome("");
      setNotes("");
      setOccurredAt(formatDateTimeInputValue(new Date().toISOString()));
      setOwnerId("");
      setMessage(`${entityLabel} activity logged.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activities</CardTitle>
        <CardDescription>
          Calls, emails, demos, support touches, and other touchpoints stay linked to this {entityLabel.toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
                  <Badge variant="muted">{getCrmActivityTypeLabel(activity.activityType)}</Badge>
                  <p className="font-semibold">{activity.subject}</p>
                </div>
                {activity.outcome ? (
                  <p className="mt-2 text-sm leading-6">
                    <span className="font-medium">Outcome:</span> {activity.outcome}
                  </p>
                ) : null}
                {activity.notes ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{activity.notes}</p>
                ) : null}
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Owner {activity.owner?.displayName ?? "Unassigned"} • Logged by {activity.author?.displayName ?? "System"} •{" "}
                  {formatDateTime(activity.occurredAt)}
                </p>
              </div>
            ))
          )}
        </div>

        {canWrite ? (
          <form className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <h4 className="font-semibold">Log activity</h4>
              <p className="text-sm text-muted-foreground">
                Capture the touchpoint, owner, outcome, and notes that happened around this {entityLabel.toLowerCase()}.
              </p>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">Activity type</span>
              <select
                className={selectClassName}
                value={activityType}
                onChange={(event) => setActivityType(event.target.value as CreateCrmActivityRequestBody["activityType"])}
                disabled={isSubmitting}
              >
                {manualActivityTypes.map((value) => (
                  <option key={value} value={value}>
                    {getCrmActivityTypeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Subject</span>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Discovery call completed"
                disabled={isSubmitting}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
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
                <span className="text-sm font-medium">Occurred at</span>
                <Input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">Outcome</span>
              <Input
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="Next demo booked for Friday"
                disabled={isSubmitting}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Notes</span>
              <textarea
                className={textareaClassName}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Capture context, questions, blockers, or the next step."
                disabled={isSubmitting}
              />
            </label>
            <Button type="submit" disabled={isSubmitting || subject.trim().length < 2}>
              {isSubmitting ? "Logging activity..." : "Log activity"}
            </Button>
          </form>
        ) : (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            You can review activities here, but logging new touchpoints requires additional permissions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
