import { useEffect, useMemo, useState } from "react";
import type {
  BdTargetAccountDetail,
  BdTargetAccountOptionsResponse,
  BdTargetAccountSummary,
  BdTargetAccountsResponse,
  CreateBdTargetAccountRequestBody
} from "@crm/types";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

interface CreateFormState {
  name: string;
  tierKey: string;
  stageKey: string;
  partnershipTypeKey: string;
  accountId: string;
  ownerId: string;
  industry: string;
  region: string;
  annualRevenue: string;
  executiveSponsor: string;
  marketOpportunityNotes: string;
  nextStep: string;
  isPartnership: boolean;
}

function buildInitialFormState(options: BdTargetAccountOptionsResponse | null): CreateFormState {
  return {
    name: "",
    tierKey: options?.tiers.find((tier) => tier.isDefault)?.key ?? options?.tiers[0]?.key ?? "",
    stageKey: options?.stages.find((stage) => stage.isDefault)?.key ?? options?.stages[0]?.key ?? "",
    partnershipTypeKey: "",
    accountId: "",
    ownerId: "",
    industry: "",
    region: "",
    annualRevenue: "",
    executiveSponsor: "",
    marketOpportunityNotes: "",
    nextStep: "",
    isPartnership: false
  };
}

export function BusinessDevelopmentPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [options, setOptions] = useState<BdTargetAccountOptionsResponse | null>(null);
  const [data, setData] = useState<BdTargetAccountsResponse | null>(null);
  const [detail, setDetail] = useState<BdTargetAccountDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<CreateFormState>(buildInitialFormState(null));
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = hasAnyPermission(["business_development.create", "business_development.configure"]);

  const targetAccounts = useMemo(() => data?.targetAccounts ?? [], [data?.targetAccounts]);
  const dashboard = useMemo(() => {
    const partnerships = targetAccounts.filter((account) => account.isPartnership).length;
    const committed = targetAccounts.filter((account) => account.stage?.key === "committed").length;
    const executiveCoverage = targetAccounts.filter((account) => account.executiveStakeholderCount > 0).length;
    return { total: data?.pagination.total ?? targetAccounts.length, partnerships, committed, executiveCoverage };
  }, [targetAccounts, data?.pagination.total]);

  async function loadList() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, listResponse] = await Promise.all([
        apiRequest<BdTargetAccountOptionsResponse>("/business-development/options", { method: "GET", accessToken }),
        apiRequest<BdTargetAccountsResponse>("/business-development?pageSize=100", { method: "GET", accessToken })
      ]);
      setOptions(optionsResponse);
      setData(listResponse);
      setFormState((current) => (current.tierKey ? current : buildInitialFormState(optionsResponse)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [accessToken]);

  useEffect(() => {
    if (targetAccounts.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) =>
      current && targetAccounts.some((account) => account.id === current) ? current : targetAccounts[0].id
    );
  }, [targetAccounts]);

  useEffect(() => {
    if (!accessToken || !selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    apiRequest<{ targetAccount: BdTargetAccountDetail }>(`/business-development/${selectedId}`, {
      method: "GET",
      accessToken
    })
      .then((response) => {
        if (!cancelled) {
          setDetail(response.targetAccount);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setFormError(null);

    const payload: CreateBdTargetAccountRequestBody = {
      name: formState.name.trim(),
      tierKey: formState.tierKey,
      stageKey: formState.stageKey,
      partnershipTypeKey: formState.partnershipTypeKey || null,
      accountId: formState.accountId || null,
      ownerId: formState.ownerId || null,
      industry: formState.industry.trim() || null,
      region: formState.region.trim() || null,
      annualRevenue: formState.annualRevenue ? Number(formState.annualRevenue) : null,
      executiveSponsor: formState.executiveSponsor.trim() || null,
      marketOpportunityNotes: formState.marketOpportunityNotes.trim() || null,
      nextStep: formState.nextStep.trim() || null,
      isPartnership: formState.isPartnership
    };

    try {
      const response = await apiRequest<{ targetAccount: BdTargetAccountDetail }>("/business-development", {
        method: "POST",
        accessToken,
        body: payload
      });
      setIsCreating(false);
      setFormState(buildInitialFormState(options));
      await loadList();
      setSelectedId(response.targetAccount.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title="Loading business development workspace"
        description="Strategic target accounts, BD pipeline, and relationship mapping are loading from the tenant-safe API."
      />
    );
  }

  if (!data || !options) {
    return (
      <CrmEmptyState
        title="The business development workspace could not be loaded."
        description={errorMessage ?? "The current tenant session could not load target accounts."}
        action={
          <Button variant="outline" onClick={() => void loadList()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Business development"
        title="Strategic account targeting, relationship mapping, and BD pipeline now run from one workspace."
        summary="Target accounts keep tiering, BD pipeline stage, executive engagement, and partnership tracking connected to the same tenant-aware account records used across the CRM."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating((current) => !current)}>
              {isCreating ? "Close form" : "Add target account"}
            </Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Target accounts" value={String(dashboard.total)} description="Strategic accounts in the BD list." />
            <CrmMetricCard label="Committed" value={String(dashboard.committed)} description="Accounts in the committed BD stage." />
            <CrmMetricCard
              label="Executive coverage"
              value={String(dashboard.executiveCoverage)}
              description="Accounts with at least one executive stakeholder mapped."
            />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      {isCreating && canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New target account</CardTitle>
            <CardDescription>Capture the strategic account profile and BD pipeline position.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Account name</span>
                <Input
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  required
                  minLength={2}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Tier</span>
                <select
                  className={selectClassName}
                  value={formState.tierKey}
                  onChange={(event) => setFormState((current) => ({ ...current, tierKey: event.target.value }))}
                >
                  {options.tiers.map((tier) => (
                    <option key={tier.id} value={tier.key}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">BD pipeline stage</span>
                <select
                  className={selectClassName}
                  value={formState.stageKey}
                  onChange={(event) => setFormState((current) => ({ ...current, stageKey: event.target.value }))}
                >
                  {options.stages.map((stage) => (
                    <option key={stage.id} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Linked account</span>
                <select
                  className={selectClassName}
                  value={formState.accountId}
                  onChange={(event) => setFormState((current) => ({ ...current, accountId: event.target.value }))}
                >
                  <option value="">No linked account</option>
                  {options.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Owner</span>
                <select
                  className={selectClassName}
                  value={formState.ownerId}
                  onChange={(event) => setFormState((current) => ({ ...current, ownerId: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Partnership type</span>
                <select
                  className={selectClassName}
                  value={formState.partnershipTypeKey}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      partnershipTypeKey: event.target.value,
                      isPartnership: event.target.value ? true : current.isPartnership
                    }))
                  }
                >
                  <option value="">Not a partnership</option>
                  {options.partnershipTypes.map((type) => (
                    <option key={type.id} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Industry</span>
                <Input
                  value={formState.industry}
                  onChange={(event) => setFormState((current) => ({ ...current, industry: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Region</span>
                <Input
                  value={formState.region}
                  onChange={(event) => setFormState((current) => ({ ...current, region: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Annual revenue</span>
                <Input
                  type="number"
                  min={0}
                  value={formState.annualRevenue}
                  onChange={(event) => setFormState((current) => ({ ...current, annualRevenue: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Executive sponsor</span>
                <Input
                  value={formState.executiveSponsor}
                  onChange={(event) => setFormState((current) => ({ ...current, executiveSponsor: event.target.value }))}
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Market opportunity notes</span>
                <textarea
                  className={textareaClassName}
                  rows={3}
                  value={formState.marketOpportunityNotes}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, marketOpportunityNotes: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Next step</span>
                <Input
                  value={formState.nextStep}
                  onChange={(event) => setFormState((current) => ({ ...current, nextStep: event.target.value }))}
                />
              </label>
              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">Create target account</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Strategic account list</CardTitle>
            <CardDescription>Target accounts ranked for business development engagement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {targetAccounts.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                No target accounts are currently visible for this role.
              </div>
            ) : (
              targetAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedId(account.id)}
                  className={cn(
                    "w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50",
                    selectedId === account.id ? "border-primary bg-primary/5" : ""
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{account.tier?.label ?? "Tier missing"}</Badge>
                    <Badge variant="muted">{account.stage?.label ?? "Stage missing"}</Badge>
                    {account.isPartnership ? <Badge variant="muted">Partnership</Badge> : null}
                  </div>
                  <p className="mt-3 font-semibold">{account.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {account.industry ?? "Industry n/a"} • {account.region ?? "Region n/a"}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Owner {account.owner?.displayName ?? "Unassigned"} • {account.stakeholderCount} stakeholders •{" "}
                    {account.executiveStakeholderCount} executive
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <BusinessDevelopmentDetailCard detail={detail} />
      </section>
    </div>
  );
}

function BusinessDevelopmentDetailCard({ detail }: { detail: BdTargetAccountDetail | null }) {
  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account profile</CardTitle>
          <CardDescription>Select a target account to review its profile and relationship map.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            No target account selected.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{detail.name}</CardTitle>
        <CardDescription>
          {detail.tier?.label ?? "No tier"} • {detail.stage?.label ?? "No stage"}
          {detail.partnershipType ? ` • ${detail.partnershipType.label} partnership` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Annual revenue</dt>
            <dd className="font-medium">{formatCurrencyAmount(detail.annualRevenue)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Executive sponsor</dt>
            <dd className="font-medium">{detail.executiveSponsor ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Linked account</dt>
            <dd className="font-medium">
              {detail.account ? (
                <Link className="text-primary hover:underline" to={`/accounts/${detail.account.id}`}>
                  {detail.account.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next step</dt>
            <dd className="font-medium">{detail.nextStep ?? "—"}</dd>
          </div>
        </dl>

        {detail.marketOpportunityNotes ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Market opportunity notes</p>
            <p className="mt-1 leading-6 text-muted-foreground">{detail.marketOpportunityNotes}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Relationship map</p>
          {detail.stakeholders.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No stakeholders mapped yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.stakeholders.map((stakeholder) => (
                <li key={stakeholder.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{stakeholder.name}</span>
                    {stakeholder.isExecutive ? <Badge variant="muted">Executive</Badge> : null}
                    <Badge variant="muted">{stakeholder.influenceLevel}</Badge>
                    <Badge variant="muted">{stakeholder.relationshipStrength}</Badge>
                  </div>
                  {stakeholder.title ? <p className="mt-1 text-muted-foreground">{stakeholder.title}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[1rem] border border-dashed border-border/60 p-3 text-muted-foreground">
          {detail.territoryPlaceholder.message}
        </div>

        {detail.aiPlaceholders.actions.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI placeholders</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.aiPlaceholders.actions.map((action) => (
                <Button key={action.key} variant="outline" size="sm" disabled title={action.description}>
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
