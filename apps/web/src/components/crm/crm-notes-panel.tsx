import { useState, type FormEvent } from "react";
import type {
  CreateCrmNoteRequestBody,
  CrmNoteSummary,
  UpdateCrmNoteRequestBody
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/error-message";
import { formatDateTime, textareaClassName } from "@/lib/crm";

interface CrmNotesPanelProps {
  entityLabel: string;
  notes: CrmNoteSummary[];
  canWrite: boolean;
  onAddNote: (payload: CreateCrmNoteRequestBody) => Promise<void>;
  onUpdateNote: (noteId: string, payload: UpdateCrmNoteRequestBody) => Promise<void>;
}

export function CrmNotesPanel({
  entityLabel,
  notes,
  canWrite,
  onAddNote,
  onUpdateNote
}: CrmNotesPanelProps) {
  const [noteBody, setNoteBody] = useState("");
  const [isCustomerFacing, setIsCustomerFacing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingCustomerFacing, setEditingCustomerFacing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onAddNote({
        body: noteBody,
        isCustomerFacing
      });
      setNoteBody("");
      setIsCustomerFacing(false);
      setMessage(`${entityLabel} note saved.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingNoteId) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onUpdateNote(editingNoteId, {
        body: editingBody,
        isCustomerFacing: editingCustomerFacing
      });
      setEditingNoteId(null);
      setEditingBody("");
      setEditingCustomerFacing(false);
      setMessage(`${entityLabel} note updated.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Internal and customer-facing context stays attached to this {entityLabel.toLowerCase()} with edit history in
          the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Saved notes</h4>
            <Badge variant="muted">{notes.length} captured</Badge>
          </div>

          {notes.length === 0 ? (
            <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
              No notes have been saved for this record yet.
            </div>
          ) : (
            notes.map((note) => {
              const isEditing = editingNoteId === note.id;

              return (
                <div key={note.id} className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={note.isCustomerFacing ? "success" : "muted"}>
                      {note.isCustomerFacing ? "Customer-facing" : "Internal"}
                    </Badge>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {note.author?.displayName ?? "System"} • {formatDateTime(note.updatedAt)}
                    </p>
                  </div>

                  {isEditing ? (
                    <form className="mt-4 space-y-4" onSubmit={handleUpdateNote}>
                      <textarea
                        className={textareaClassName}
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        disabled={isSubmitting}
                      />
                      <label className="flex items-center gap-3 text-sm text-muted-foreground">
                        <input
                          checked={editingCustomerFacing}
                          className="h-4 w-4 rounded border border-border"
                          disabled={isSubmitting}
                          onChange={(event) => setEditingCustomerFacing(event.target.checked)}
                          type="checkbox"
                        />
                        Mark as customer-facing note
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <Button type="submit" disabled={isSubmitting || editingBody.trim().length < 2}>
                          {isSubmitting ? "Saving..." : "Save changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditingBody("");
                            setEditingCustomerFacing(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="mt-3 text-sm leading-6">{note.body}</p>
                      {canWrite ? (
                        <Button
                          className="mt-4"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingBody(note.body);
                            setEditingCustomerFacing(note.isCustomerFacing);
                            setMessage(null);
                            setErrorMessage(null);
                          }}
                        >
                          Edit note
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {canWrite ? (
          <form className="space-y-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-5" onSubmit={handleCreateNote}>
            <div className="space-y-2">
              <h4 className="font-semibold">Add note</h4>
              <p className="text-sm text-muted-foreground">
                Capture handoff context, customer details, or internal decisions for this {entityLabel.toLowerCase()}.
              </p>
            </div>
            <textarea
              className={textareaClassName}
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder={`Add a note for this ${entityLabel.toLowerCase()}...`}
              disabled={isSubmitting}
            />
            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <input
                checked={isCustomerFacing}
                className="h-4 w-4 rounded border border-border"
                disabled={isSubmitting}
                onChange={(event) => setIsCustomerFacing(event.target.checked)}
                type="checkbox"
              />
              Mark as customer-facing note
            </label>
            <Button type="submit" disabled={isSubmitting || noteBody.trim().length < 2}>
              {isSubmitting ? "Saving note..." : "Save note"}
            </Button>
          </form>
        ) : (
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            You can review notes here, but note creation and edits require additional permissions.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
