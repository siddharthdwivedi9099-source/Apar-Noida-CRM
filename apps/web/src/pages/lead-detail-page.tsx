import { useEffect, useState } from "react";
import type {
  CreateCrmActivityRequestBody,
  LeadResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { CrmTimeline } from "@/components/crm/crm-timeline";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, formatShortDate } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useParams } from "react-router-dom";

export function LeadDetailPage() {
  const { leadId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const leadLabel = getModuleLabel("leads", "singular");
  const [data, setData] = useState<LeadResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission(["leads.edit", "leads.configure"]);
  const canDelete = hasAnyPermission(["leads.delete", "leads.configure"]);
  const canWriteTimeline = hasAnyPermission(["leads.create", "leads.edit", "leads.assign", "leads.configure"]);

  async function loadLead() {
    if (!accessToken || !leadId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<LeadResponse>(`/leads/${leadId}`, {
        method: "GET",
        accessToken
      });
      setData(response);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLead();
  }, [accessToken, leadId]);

  async function handleAddNote(body: string) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/leads/${leadId}/notes`, {
      method: "POST",
      accessToken,
      body: {
        body
      }
    });
    await loadLead();
  }

  async function handleAddActivity(payload: CreateCrmActivityRequestBody) {
    if (!accessToken || !leadId) {
      return;
    }

    await apiRequest(`/leads/${leadId}/activities`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadLead();
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${leadLabel.toLowerCase()} detail`}
        description="The page is fetching the full tenant-safe record, notes, and activity timeline."
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

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Lead detail"
        title={`${lead.companyName} is now tracked as a live ${leadLabel.toLowerCase()} record.`}
        summary={`${lead.fullName} sits inside the authenticated CRM foundation with source tracking, ownership, notes, activities, and a conversion placeholder for a later opportunity phase.`}
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
              <p className="mt-2 font-semibold">{lead.email ?? "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
              <p className="mt-2 font-semibold">{lead.phone ?? "Not provided"}</p>
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
                {lead.noteCount} notes and {lead.activityCount} activities are attached to this {leadLabel.toLowerCase()}.
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

      <CrmTimeline
        entityLabel={leadLabel}
        notes={lead.notes}
        activities={lead.activities}
        canWrite={canWriteTimeline}
        onAddNote={handleAddNote}
        onAddActivity={handleAddActivity}
      />
    </div>
  );
}
