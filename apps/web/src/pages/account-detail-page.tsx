import { useEffect, useState } from "react";
import type {
  AccountResponse,
  CreateCrmActivityRequestBody
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

export function AccountDetailPage() {
  const { accountId } = useParams();
  const { accessToken, hasAnyPermission } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const accountLabel = getModuleLabel("accounts", "singular");
  const contactLabel = getModuleLabel("contacts", "singular");
  const [data, setData] = useState<AccountResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = hasAnyPermission(["accounts.edit", "accounts.configure"]);
  const canDelete = hasAnyPermission(["accounts.delete", "accounts.configure"]);
  const canWriteTimeline = hasAnyPermission(["accounts.create", "accounts.edit", "accounts.assign", "accounts.configure"]);

  async function loadAccount() {
    if (!accessToken || !accountId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      setData(
        await apiRequest<AccountResponse>(`/accounts/${accountId}`, {
          method: "GET",
          accessToken
        })
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, [accessToken, accountId]);

  async function handleAddNote(body: string) {
    if (!accessToken || !accountId) {
      return;
    }

    await apiRequest(`/accounts/${accountId}/notes`, {
      method: "POST",
      accessToken,
      body: {
        body
      }
    });
    await loadAccount();
  }

  async function handleAddActivity(payload: CreateCrmActivityRequestBody) {
    if (!accessToken || !accountId) {
      return;
    }

    await apiRequest(`/accounts/${accountId}/activities`, {
      method: "POST",
      accessToken,
      body: payload
    });
    await loadAccount();
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={`Loading ${accountLabel.toLowerCase()} detail`}
        description="The page is fetching the full account record, relationships, and timeline."
      />
    );
  }

  const account = data?.account;

  if (!account) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8">
          <p className="font-semibold">This {accountLabel.toLowerCase()} could not be loaded.</p>
          <p className="text-sm text-muted-foreground">{errorMessage ?? "The record is unavailable."}</p>
          <Button asChild>
            <Link to="/accounts">Back to {getModuleLabel("accounts").toLowerCase()}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Account detail"
        title={`${account.name} now anchors shared customer context in the CRM foundation.`}
        summary={`This record already supports owner assignment, related ${contactLabel.toLowerCase()} relationships, notes, activities, and a later placeholder for opportunity attachments.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/accounts">Back to list</Link>
            </Button>
            {canEdit ? (
              <Button asChild>
                <Link to={`/accounts/${account.id}/edit`}>Edit {accountLabel}</Link>
              </Button>
            ) : null}
            {canDelete ? <Badge variant="muted">Soft delete available from list view</Badge> : null}
          </>
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard
              label="Account type"
              value={account.accountType?.label ?? "Open"}
              description={`This ${accountLabel.toLowerCase()} can carry tenant-configured customer classifications.`}
            />
            <CrmMetricCard
              label="Health placeholder"
              value={account.healthStatus?.label ?? "Not set"}
              description="Health values are ready for later customer-success and support signals."
            />
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{account.name}</CardTitle>
            <CardDescription>
              Shared customer record, owner assignment, and related contact visibility for downstream modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Website</p>
              <p className="mt-2 font-semibold">{account.website ?? "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Industry</p>
              <p className="mt-2 font-semibold">{account.industry ?? "Not provided"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
              <p className="mt-2 font-semibold">{account.owner?.displayName ?? "Unassigned"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Relationship coverage</p>
              <p className="mt-2 font-semibold">{account.contactCount} related contacts</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foundation summary</CardTitle>
            <CardDescription>
              These cards show what is already live for this account before opportunity management lands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audit-safe timestamps</p>
              <p className="mt-2 text-sm leading-6">
                Created {formatShortDate(account.createdAt)} and last updated {formatDateTime(account.updatedAt)}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Timeline coverage</p>
              <p className="mt-2 text-sm leading-6">
                {account.noteCount} notes and {account.activityCount} activities are already attached to this {accountLabel.toLowerCase()}.
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-background/75 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Related opportunities placeholder</p>
              <p className="mt-2 text-sm leading-6">{account.relatedOpportunitiesPlaceholder.message}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Related {getModuleLabel("contacts").toLowerCase()}</CardTitle>
            <CardDescription>
              These relationships are tenant-isolated and will later feed the broader account graph.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {account.relatedContacts.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No related {getModuleLabel("contacts").toLowerCase()} have been attached to this {accountLabel.toLowerCase()} yet.
              </div>
            ) : (
              account.relatedContacts.map((contact) => (
                <div key={contact.id} className="rounded-[1.25rem] bg-background/75 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {contact.role ? <Badge>{contact.role.label}</Badge> : null}
                    <p className="font-semibold">{contact.fullName}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{contact.email ?? "No email provided"}</p>
                  <Button className="mt-3" variant="outline" asChild>
                    <Link to={`/contacts/${contact.id}`}>Open {contactLabel}</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What comes next</CardTitle>
            <CardDescription>
              This record is already prepared for later opportunity, support, and success attachments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Opportunity relationships will attach here in a later revenue phase.",
              "Support and customer-success stages can reuse this shared account identity without duplication.",
              "Custom fields and layouts from the tenant configuration engine can extend account forms next."
            ].map((message) => (
              <div key={message} className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                {message}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <CrmTimeline
        entityLabel={accountLabel}
        notes={account.notes}
        activities={account.activities}
        canWrite={canWriteTimeline}
        onAddNote={handleAddNote}
        onAddActivity={handleAddActivity}
      />
    </div>
  );
}
