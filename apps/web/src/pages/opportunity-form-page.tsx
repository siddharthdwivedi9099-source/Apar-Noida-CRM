import { useEffect, useMemo, useState } from "react";
import type {
  CreateOpportunityRequestBody,
  OpportunityOptionsResponse,
  OpportunityResponse,
  UpdateOpportunityRequestBody
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-message";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

interface OpportunityFormState {
  name: string;
  accountId: string;
  primaryContactId: string;
  ownerId: string;
  stageKey: string;
  amount: string;
  probability: string;
  expectedCloseDate: string;
  sourceKey: string;
  competitor: string;
  stakeholderContactIds: string[];
  nextStep: string;
  outcomeStatusKey: string;
  outcomeReason: string;
}

const defaultFormState: OpportunityFormState = {
  name: "",
  accountId: "",
  primaryContactId: "",
  ownerId: "",
  stageKey: "",
  amount: "",
  probability: "",
  expectedCloseDate: "",
  sourceKey: "",
  competitor: "",
  stakeholderContactIds: [],
  nextStep: "",
  outcomeStatusKey: "",
  outcomeReason: ""
};

function resolveOutcomeFromStage(stageKey: string, currentOutcomeStatusKey: string) {
  if (stageKey === "closed_won") {
    return "won";
  }

  if (stageKey === "closed_lost") {
    return "lost";
  }

  if (currentOutcomeStatusKey === "won" || currentOutcomeStatusKey === "lost") {
    return "open";
  }

  return currentOutcomeStatusKey || "open";
}

export function OpportunityFormPage() {
  const { opportunityId } = useParams();
  const isEditMode = Boolean(opportunityId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const opportunityLabel = getModuleLabel("opportunities", "singular");
  const [options, setOptions] = useState<OpportunityOptionsResponse | null>(null);
  const [formState, setFormState] = useState<OpportunityFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    return options?.contacts ?? [];
  }, [options]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const optionsResponse = await apiRequest<OpportunityOptionsResponse>("/opportunities/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        const defaultStageKey =
          optionsResponse.stages.find((stage) => stage.isDefault)?.key ?? optionsResponse.stages[0]?.key ?? "";
        const defaultSourceKey =
          optionsResponse.sources.find((source) => source.isDefault)?.key ?? optionsResponse.sources[0]?.key ?? "";
        const defaultOutcomeKey =
          optionsResponse.outcomeStatuses.find((status) => status.isDefault)?.key ?? optionsResponse.outcomeStatuses[0]?.key ?? "open";

        if (!isEditMode || !opportunityId) {
          setFormState((currentValue) => ({
            ...currentValue,
            stageKey: defaultStageKey,
            sourceKey: defaultSourceKey,
            outcomeStatusKey: resolveOutcomeFromStage(defaultStageKey, defaultOutcomeKey)
          }));
          return;
        }

        const opportunityResponse = await apiRequest<OpportunityResponse>(`/opportunities/${opportunityId}`, {
          method: "GET",
          accessToken
        });
        const { opportunity } = opportunityResponse;

        setFormState({
          name: opportunity.name,
          accountId: opportunity.account?.id ?? "",
          primaryContactId: opportunity.primaryContact?.id ?? "",
          ownerId: opportunity.owner?.id ?? "",
          stageKey: opportunity.stage?.key ?? defaultStageKey,
          amount: opportunity.amount !== null ? String(opportunity.amount) : "",
          probability: opportunity.probability !== null ? String(opportunity.probability) : "",
          expectedCloseDate: opportunity.expectedCloseDate ?? "",
          sourceKey: opportunity.source?.key ?? defaultSourceKey,
          competitor: opportunity.competitor ?? "",
          stakeholderContactIds: opportunity.stakeholders.map((stakeholder) => stakeholder.id),
          nextStep: opportunity.nextStep ?? "",
          outcomeStatusKey: opportunity.outcomeStatus?.key ?? defaultOutcomeKey,
          outcomeReason: opportunity.winLossReason ?? ""
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, isEditMode, opportunityId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload = {
      name: formState.name,
      accountId: formState.accountId || null,
      primaryContactId: formState.primaryContactId || null,
      ownerId: formState.ownerId || null,
      stageKey: formState.stageKey,
      amount: formState.amount ? Number(formState.amount) : null,
      probability: formState.probability ? Number(formState.probability) : null,
      expectedCloseDate: formState.expectedCloseDate || null,
      sourceKey: formState.sourceKey,
      competitor: formState.competitor || null,
      stakeholderContactIds: formState.stakeholderContactIds,
      nextStep: formState.nextStep || null,
      outcomeStatusKey: formState.outcomeStatusKey || null,
      outcomeReason: formState.outcomeReason || null
    } satisfies CreateOpportunityRequestBody & UpdateOpportunityRequestBody;

    try {
      const response = isEditMode && opportunityId
        ? await apiRequest<OpportunityResponse>(`/opportunities/${opportunityId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<OpportunityResponse>("/opportunities", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/opportunities/${response.opportunity.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={
          isEditMode
            ? `Loading ${opportunityLabel.toLowerCase()} for editing`
            : `Preparing ${opportunityLabel.toLowerCase()} form`
        }
        description="The page is loading tenant-backed owners, relationship candidates, and pipeline defaults."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow={isEditMode ? "Opportunity maintenance" : "Opportunity creation"}
        title={
          isEditMode
            ? `Update this ${opportunityLabel.toLowerCase()} cleanly and keep stage history intact.`
            : `Create a new ${opportunityLabel.toLowerCase()} with pipeline, owner, and stakeholder context from day one.`
        }
        summary="Form defaults and pipeline catalogs come from the tenant configuration engine, while saves are protected by RBAC, audit logging, and tenant-aware relationship validation."
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && opportunityId ? `/opportunities/${opportunityId}` : "/opportunities"}>
              {isEditMode ? "Back to detail" : "Back to list"}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${opportunityLabel}` : `Create ${opportunityLabel}`}</CardTitle>
          <CardDescription>
            Capture commercial, relationship, and pipeline fields that power list filters, Kanban views, and stage audits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Opportunity name</span>
              <Input
                required
                value={formState.name}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, name: event.target.value }))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Account</span>
              <select
                className={selectClassName}
                value={formState.accountId}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    accountId: event.target.value,
                    primaryContactId: "",
                    stakeholderContactIds: []
                  }))
                }
              >
                <option value="">No linked account</option>
                {options?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Primary contact</span>
              <select
                className={selectClassName}
                value={formState.primaryContactId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, primaryContactId: event.target.value }))}
              >
                <option value="">No primary contact</option>
                {filteredContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Owner</span>
              <select
                className={selectClassName}
                value={formState.ownerId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, ownerId: event.target.value }))}
              >
                <option value="">Unassigned</option>
                {options?.owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Stage</span>
              <select
                className={selectClassName}
                value={formState.stageKey}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    stageKey: event.target.value,
                    outcomeStatusKey: resolveOutcomeFromStage(event.target.value, currentValue.outcomeStatusKey)
                  }))
                }
              >
                {options?.stages.map((stage) => (
                  <option key={stage.id} value={stage.key}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Source</span>
              <select
                className={selectClassName}
                value={formState.sourceKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, sourceKey: event.target.value }))}
              >
                {options?.sources.map((source) => (
                  <option key={source.id} value={source.key}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Outcome status</span>
              <select
                className={selectClassName}
                value={formState.outcomeStatusKey}
                onChange={(event) =>
                  setFormState((currentValue) => ({
                    ...currentValue,
                    outcomeStatusKey: event.target.value
                  }))
                }
              >
                {options?.outcomeStatuses.map((status) => (
                  <option key={status.id} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Amount</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formState.amount}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, amount: event.target.value }))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Probability</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={formState.probability}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, probability: event.target.value }))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Expected close date</span>
              <Input
                type="date"
                value={formState.expectedCloseDate}
                onChange={(event) =>
                  setFormState((currentValue) => ({ ...currentValue, expectedCloseDate: event.target.value }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Competitor</span>
              <Input
                value={formState.competitor}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, competitor: event.target.value }))}
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Next step</span>
              <textarea
                className={textareaClassName}
                value={formState.nextStep}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, nextStep: event.target.value }))}
                placeholder="Capture the next agreed follow-up, commercial milestone, or proposal action."
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Win/loss reason</span>
              <textarea
                className={textareaClassName}
                value={formState.outcomeReason}
                onChange={(event) =>
                  setFormState((currentValue) => ({ ...currentValue, outcomeReason: event.target.value }))
                }
                placeholder="Capture the commercial reason for won/lost outcomes when relevant."
              />
            </label>

            <fieldset className="space-y-3 md:col-span-2">
              <legend className="text-sm font-medium">Stakeholders</legend>
              <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/70 p-4 md:grid-cols-2">
                {filteredContacts.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No contacts are currently available for stakeholder selection.
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <label key={contact.id} className="flex items-start gap-3 rounded-[1rem] bg-secondary/40 p-3">
                      <input
                        type="checkbox"
                        checked={formState.stakeholderContactIds.includes(contact.id)}
                        onChange={(event) =>
                          setFormState((currentValue) => ({
                            ...currentValue,
                            stakeholderContactIds: event.target.checked
                              ? [...currentValue.stakeholderContactIds, contact.id]
                              : currentValue.stakeholderContactIds.filter((contactId) => contactId !== contact.id)
                          }))
                        }
                      />
                      <div className="space-y-1">
                        <p className="font-medium">{contact.fullName}</p>
                        <p className="text-sm text-muted-foreground">{contact.email ?? "No email provided"}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            {errorMessage ? <p className="md:col-span-2 text-sm text-rose-600">{errorMessage}</p> : null}

            <div className="flex gap-3 md:col-span-2">
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : isEditMode ? `Save ${opportunityLabel}` : `Create ${opportunityLabel}`}
              </Button>
              <Button variant="outline" asChild>
                <Link to={isEditMode && opportunityId ? `/opportunities/${opportunityId}` : "/opportunities"}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
