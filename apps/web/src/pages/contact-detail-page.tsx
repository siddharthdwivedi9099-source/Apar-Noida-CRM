import { useEffect, useState } from "react";
import type {
  ContactResponse,
  ContactOptionsResponse,
  CreateCrmActivityRequestBody,
  CreateCrmNoteRequestBody,
  CreateCrmTaskRequestBody,
  CrmLookupUserSummary,
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
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, formatShortDate } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useParams } from "react-router-dom";

export function ContactDetailPage() {
  const { contactId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const contactLabel = getModuleLabel("contacts", "singular");
  const accountLabel = getModuleLabel("accounts", "singular");
  const [data, setData] = useState<ContactResponse | null>(null);
  const [owners, setOwners] = useState<CrmLookupUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission(["contacts.edit", "contacts.configure"]);
  const canDelete = hasAnyPermission(["contacts.delete", "contacts.configure"]);
  const canManageProductivity = hasAnyPermission(["contacts.create", "contacts.edit", "contacts.assign", "contacts.configure"]);

  async function loadContact() {
    if (!accessToken || !contactId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [detailResponse, optionsResponse] = await Promise.all([
        apiRequest<ContactResponse>(`/contacts/${contactId}`, {
          method: "GET",
          accessToken
        }),
        apiRequest<ContactOptionsResponse>("/contacts/options", {
          method: "GET",
          accessToken
        })
      ]);
      setData(detailResponse);
      setOwners(optionsResponse.owners);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContact();
  }, [accessToken, contactId]);

  async function handleAddNote(payload: CreateCrmNoteRequestBody) {
    if (!accessToken || !contactId) {
      return;
    }

    await apiRequest(`/records/contact/${contactId}/notes`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadContact();
  }

  async function handleUpdateNote(noteId: string, payload: UpdateCrmNoteRequestBody) {
    if (!accessToken || !contactId) {
      return;
    }

    await apiRequest(`/records/contact/${contactId}/notes/${noteId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadContact();
  }

  async function handleAddActivity(payload: CreateCrmActivityRequestBody) {
    if (!accessToken || !contactId) {
      return;
    }

    await apiRequest(`/records/contact/${contactId}/activities`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadContact();
  }

  async function handleAddTask(payload: CreateCrmTaskRequestBody) {
    if (!accessToken || !contactId) {
      return;
    }

    await apiRequest(`/records/contact/${contactId}/tasks`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadContact();
  }

  async function handleUpdateTask(taskId: string, payload: UpdateCrmTaskRequestBody) {
    if (!accessToken || !contactId) {
      return;
    }

    await apiRequest(`/records/contact/${contactId}/tasks/${taskId}`, {
      method: "PATCH",
      accessToken,
      body: payload
    });
    await loadContact();
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${contactLabel.toLowerCase()} detail`}
        description="The page is fetching the stakeholder profile, shared tasks, notes, activities, and timeline."
      />
    );
  }

  const contact = data?.contact;

  if (!contact) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">This {contactLabel.toLowerCase()} could not be loaded.</p>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "The record is unavailable."}</p>
          <Button asChild>
            <Link to="/contacts">Back to {getModuleLabel("contacts").toLowerCase()}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Contact detail"
        title={`${contact.fullName} is now mapped into the shared stakeholder layer.`}
        summary={`This record already supports account relationships, owner assignment, notes, activities, task tracking, and the tenant-safe identity fields that future workflows can build on.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/contacts">Back to list</Link>
            </Button>
            {canEdit ? (
              <Button asChild>
                <Link to={`/contacts/${contact.id}/edit`}>Edit {contactLabel}</Link>
              </Button>
            ) : null}
            {canDelete ? <Badge variant="muted">Soft delete available from list view</Badge> : null}
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Role"
              value={contact.role?.label ?? "Open"}
              description={`This ${contactLabel.toLowerCase()} can carry tenant-configured stakeholder roles.`}
            />
            <CrmMetricCard
              label="Related account"
              value={contact.account?.name ?? "Not linked"}
              description="Account relationships are part of the core CRM graph from the beginning."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{contact.fullName}</CardTitle>
            <CardDescription>
              Stakeholder identity, communication fields, and account relationship for this record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</p>
              <p className="mt-2 font-semibold">{contact.email ?? "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
              <p className="mt-2 font-semibold">{contact.phone ?? "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">LinkedIn</p>
              <p className="mt-2 font-semibold">{contact.linkedinUrl ?? "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
              <p className="mt-2 font-semibold">{contact.owner?.displayName ?? "Unassigned"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Related account</p>
              <p className="mt-2 font-semibold">
                {contact.account ? (
                  <Link className="text-primary underline-offset-4 hover:underline" to={`/accounts/${contact.account.id}`}>
                    {contact.account.name}
                  </Link>
                ) : (
                  `No ${accountLabel.toLowerCase()} linked yet`
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foundation summary</CardTitle>
            <CardDescription>
              These cards show the cross-cutting behavior already attached to this stakeholder record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audit-safe timestamps</p>
              <p className="mt-2 text-sm leading-6">
                Created {formatShortDate(contact.createdAt)} and last updated {formatDateTime(contact.updatedAt)}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline coverage</p>
              <p className="mt-2 text-sm leading-6">
                {contact.noteCount} notes, {contact.activityCount} activities, and {contact.tasks.length} tasks are already attached to this{" "}
                {contactLabel.toLowerCase()}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account graph readiness</p>
              <p className="mt-2 text-sm leading-6">
                This record can already participate in account relationships, ownership filters, and tenant-configured stakeholder role vocabularies.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <CrmNotesPanel
          entityLabel={contactLabel}
          notes={contact.notes}
          canWrite={canManageProductivity}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
        />
        <CrmActivityPanel
          entityLabel={contactLabel}
          activities={contact.activities}
          owners={owners}
          canWrite={canManageProductivity}
          onAddActivity={handleAddActivity}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <CrmTaskList
          entityLabel={contactLabel}
          tasks={contact.tasks}
          owners={owners}
          canWrite={canManageProductivity}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
        />
        <CrmTimeline entityLabel={contactLabel} items={contact.timeline} />
      </section>
    </div>
  );
}
