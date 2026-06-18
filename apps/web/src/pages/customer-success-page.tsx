import { useEffect, useMemo, useState } from "react";
import type {
  CreateCustomerSuccessAccountRequestBody,
  CsEnterpriseWorkspaceResponse,
  CsOnboardingWorkspaceResponse,
  CsScaledWorkspaceResponse,
  CustomerSuccessAccountDetail,
  CustomerSuccessAccountSummary,
  CustomerSuccessDashboardResponse,
  CustomerSuccessOptionsResponse
} from "@crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, formatDateOnly, selectClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

type WorkspaceTab = "onboarding" | "scaled" | "enterprise";

function buildAccountForm(options: CustomerSuccessOptionsResponse | null) {
  return {
    accountId: "",
    csmOwnerId: "",
    segmentKey: options?.segments.find((entry) => entry.isDefault)?.key ?? options?.segments[0]?.key ?? "",
    lifecycleStageKey: options?.lifecycleStages.find((entry) => entry.isDefault)?.key ?? options?.lifecycleStages[0]?.key ?? "",
    riskStatusKey: options?.riskStatuses.find((entry) => entry.isDefault)?.key ?? options?.riskStatuses[0]?.key ?? "",
    contractValue: ""
  };
}

export function CustomerSuccessPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [options, setOptions] = useState<CustomerSuccessOptionsResponse | null>(null);
  const [dashboard, setDashboard] = useState<CustomerSuccessDashboardResponse | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("onboarding");
  const [onboarding, setOnboarding] = useState<CsOnboardingWorkspaceResponse | null>(null);
  const [scaled, setScaled] = useState<CsScaledWorkspaceResponse | null>(null);
  const [enterprise, setEnterprise] = useState<CsEnterpriseWorkspaceResponse | null>(null);
  const [detail, setDetail] = useState<CustomerSuccessAccountDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [accountForm, setAccountForm] = useState(buildAccountForm(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState("");
  const [renewalDate, setRenewalDate] = useState("");

  const canCreate = hasAnyPermission(["customer_success.create", "customer_success.configure"]);
  const canEdit = hasAnyPermission(["customer_success.edit", "customer_success.create", "customer_success.configure", "customer_success.manage_workflow"]);

  const accounts = useMemo<CustomerSuccessAccountSummary[]>(() => {
    if (tab === "onboarding") return onboarding?.accounts ?? [];
    if (tab === "scaled") return scaled?.accounts ?? [];
    return enterprise?.accounts ?? [];
  }, [tab, onboarding, scaled, enterprise]);

  async function loadWorkspaces() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, dashboardResponse, onboardingResponse, scaledResponse, enterpriseResponse] = await Promise.all([
        apiRequest<CustomerSuccessOptionsResponse>("/customer-success/options", { method: "GET", accessToken }),
        apiRequest<CustomerSuccessDashboardResponse>("/customer-success/dashboard", { method: "GET", accessToken }),
        apiRequest<CsOnboardingWorkspaceResponse>("/customer-success/workspaces/onboarding", { method: "GET", accessToken }),
        apiRequest<CsScaledWorkspaceResponse>("/customer-success/workspaces/scaled", { method: "GET", accessToken }),
        apiRequest<CsEnterpriseWorkspaceResponse>("/customer-success/workspaces/enterprise", { method: "GET", accessToken })
      ]);
      setOptions(optionsResponse);
      setDashboard(dashboardResponse);
      setOnboarding(onboardingResponse);
      setScaled(scaledResponse);
      setEnterprise(enterpriseResponse);
      setAccountForm((current) => (current.segmentKey ? current : buildAccountForm(optionsResponse)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaces();
  }, [accessToken]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && accounts.some((account) => account.id === current) ? current : accounts[0].id));
  }, [accounts]);

  async function loadDetail(id: string) {
    if (!accessToken) {
      return;
    }
    try {
      const response = await apiRequest<{ customerSuccessAccount: CustomerSuccessAccountDetail }>(`/customer-success/accounts/${id}`, { method: "GET", accessToken });
      setDetail(response.customerSuccessAccount);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [accessToken, selectedId]);

  async function handleCreateAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !accountForm.accountId) {
      setFormError("Select an account to onboard.");
      return;
    }
    setFormError(null);
    const payload: CreateCustomerSuccessAccountRequestBody = {
      accountId: accountForm.accountId,
      csmOwnerId: accountForm.csmOwnerId || null,
      segmentKey: accountForm.segmentKey,
      lifecycleStageKey: accountForm.lifecycleStageKey,
      riskStatusKey: accountForm.riskStatusKey,
      contractValue: accountForm.contractValue ? Number(accountForm.contractValue) : null
    };
    try {
      const response = await apiRequest<{ customerSuccessAccount: CustomerSuccessAccountDetail }>("/customer-success/accounts", { method: "POST", accessToken, body: payload });
      setIsCreating(false);
      setAccountForm(buildAccountForm(options));
      await loadWorkspaces();
      setSelectedId(response.customerSuccessAccount.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function handleRecordHealth(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !detail || !healthScore) {
      return;
    }
    try {
      await apiRequest(`/customer-success/accounts/${detail.id}/health-scores`, { method: "POST", accessToken, body: { score: Number(healthScore) } });
      setHealthScore("");
      await loadDetail(detail.id);
      await loadWorkspaces();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleAddRenewal(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !detail || !renewalDate) {
      return;
    }
    try {
      await apiRequest(`/customer-success/accounts/${detail.id}/renewals`, { method: "POST", accessToken, body: { renewalDate } });
      setRenewalDate("");
      await loadDetail(detail.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title="Loading customer success workspace"
        description="Customer success dashboard, onboarding, scaled, and enterprise workspaces are loading from the tenant-safe API."
      />
    );
  }

  if (!options || !dashboard) {
    return (
      <CrmEmptyState
        title="The customer success workspace could not be loaded."
        description={errorMessage ?? "The current tenant session could not load customer success accounts."}
        action={<Button variant="outline" onClick={() => void loadWorkspaces()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow="Customer success"
        title="Onboarding, scaled, and enterprise customer success run from one workspace."
        summary="Customer success accounts keep segment, lifecycle stage, health and adoption scores, renewals, QBR/EBR cadence, escalations, and success plans connected to the same tenant-aware accounts used across the CRM."
        actions={canCreate ? <Button onClick={() => setIsCreating((current) => !current)}>{isCreating ? "Close form" : "Add CS account"}</Button> : null}
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="CS accounts" value={String(dashboard.totalAccounts)} description="Customer success accounts in scope." />
            <CrmMetricCard label="At risk" value={String(dashboard.atRiskCount)} description="Accounts in at-risk or critical status." />
            <CrmMetricCard label="Renewals due" value={String(dashboard.renewalsDueCount)} description="Accounts with a renewal within 90 days." />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="Avg health" value={dashboard.averageHealthScore === null ? "—" : String(dashboard.averageHealthScore)} description="Average health score in scope." />
        <CrmMetricCard label="Avg adoption" value={dashboard.averageAdoptionScore === null ? "—" : String(dashboard.averageAdoptionScore)} description="Average adoption score." />
        <CrmMetricCard label="Open escalations" value={String(dashboard.openEscalationCount)} description="Open escalations across accounts." />
        <CrmMetricCard label="Contract value" value={formatCurrencyAmount(dashboard.totalContractValue)} description="Total contract value in scope." />
      </section>

      {isCreating && canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New customer success account</CardTitle>
            <CardDescription>Bring an existing account into the customer success motion.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateAccount}>
              <label className="space-y-2">
                <span className="text-sm font-medium">Account</span>
                <select className={selectClassName} value={accountForm.accountId} onChange={(event) => setAccountForm((current) => ({ ...current, accountId: event.target.value }))} required>
                  <option value="">Select account…</option>
                  {options.accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">CSM owner</span>
                <select className={selectClassName} value={accountForm.csmOwnerId} onChange={(event) => setAccountForm((current) => ({ ...current, csmOwnerId: event.target.value }))}>
                  <option value="">Unassigned</option>
                  {options.owners.map((owner) => (<option key={owner.id} value={owner.id}>{owner.displayName}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Segment</span>
                <select className={selectClassName} value={accountForm.segmentKey} onChange={(event) => setAccountForm((current) => ({ ...current, segmentKey: event.target.value }))}>
                  {options.segments.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Lifecycle stage</span>
                <select className={selectClassName} value={accountForm.lifecycleStageKey} onChange={(event) => setAccountForm((current) => ({ ...current, lifecycleStageKey: event.target.value }))}>
                  {options.lifecycleStages.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Risk status</span>
                <select className={selectClassName} value={accountForm.riskStatusKey} onChange={(event) => setAccountForm((current) => ({ ...current, riskStatusKey: event.target.value }))}>
                  {options.riskStatuses.map((entry) => (<option key={entry.id} value={entry.key}>{entry.label}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Contract value</span>
                <Input type="number" min={0} value={accountForm.contractValue} onChange={(event) => setAccountForm((current) => ({ ...current, contractValue: event.target.value }))} />
              </label>
              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">Create CS account</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["onboarding", "scaled", "enterprise"] as WorkspaceTab[]).map((value) => (
          <Button key={value} variant={tab === value ? "default" : "outline"} size="sm" onClick={() => setTab(value)}>
            {value.charAt(0).toUpperCase() + value.slice(1)} workspace
          </Button>
        ))}
      </div>

      <WorkspaceMetrics tab={tab} onboarding={onboarding} scaled={scaled} enterprise={enterprise} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{tab.charAt(0).toUpperCase() + tab.slice(1)} accounts</CardTitle>
            <CardDescription>Customer success accounts in the {tab} segment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">No accounts in this segment for your scope.</div>
            ) : (
              accounts.map((account) => (
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
                    <Badge>{account.segment?.label ?? "Segment missing"}</Badge>
                    <Badge variant="muted">{account.lifecycleStage?.label ?? "Stage missing"}</Badge>
                    <Badge variant="muted">{account.riskStatus?.label ?? "Risk missing"}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{account.account?.name ?? "Account"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Health {account.healthScore ?? "—"} • Adoption {account.adoptionScore ?? "—"} • Renewal {formatDateOnly(account.renewalDate)}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    CSM {account.csmOwner?.displayName ?? "Unassigned"} • {account.openEscalationCount} open escalations • {account.qbrCount} QBRs
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <CsAccountDetailCard
          detail={detail}
          canEdit={canEdit}
          healthScore={healthScore}
          setHealthScore={setHealthScore}
          renewalDate={renewalDate}
          setRenewalDate={setRenewalDate}
          onRecordHealth={handleRecordHealth}
          onAddRenewal={handleAddRenewal}
        />
      </section>
    </div>
  );
}

function WorkspaceMetrics({
  tab,
  onboarding,
  scaled,
  enterprise
}: {
  tab: WorkspaceTab;
  onboarding: CsOnboardingWorkspaceResponse | null;
  scaled: CsScaledWorkspaceResponse | null;
  enterprise: CsEnterpriseWorkspaceResponse | null;
}) {
  if (tab === "onboarding" && onboarding) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="New customers" value={String(onboarding.newCustomerCount)} description="Accounts in the onboarding lifecycle." />
        <CrmMetricCard label="In onboarding" value={String(onboarding.inOnboardingCount)} description="Accounts with active onboarding plans." />
        <CrmMetricCard label="Training complete" value={String(onboarding.completedOnboardingCount)} description="Accounts with completed training." />
        <CrmMetricCard label="At risk" value={String(onboarding.atRiskCount)} description="At-risk onboarding accounts." />
      </section>
    );
  }
  if (tab === "scaled" && scaled) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="Portfolio" value={String(scaled.portfolioCount)} description="Scaled accounts in scope." />
        <CrmMetricCard label="Healthy" value={String(scaled.healthyCount)} description="Healthy scaled accounts." />
        <CrmMetricCard label="At risk" value={String(scaled.atRiskCount)} description="At-risk scaled accounts." />
        <CrmMetricCard label="Renewals due" value={String(scaled.renewalsDueCount)} description="Renewals within 90 days." />
      </section>
    );
  }
  if (tab === "enterprise" && enterprise) {
    return (
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="Accounts" value={String(enterprise.accountCount)} description="Enterprise accounts in scope." />
        <CrmMetricCard label="Open escalations" value={String(enterprise.openEscalationCount)} description="Open enterprise escalations." />
        <CrmMetricCard label="QBR/EBR" value={String(enterprise.upcomingQbrCount)} description="Tracked QBR/EBR sessions." />
        <CrmMetricCard label="Expansion" value={String(enterprise.expansionOpportunityCount)} description="Accounts with expansion potential." />
      </section>
    );
  }
  return null;
}

interface CsAccountDetailCardProps {
  detail: CustomerSuccessAccountDetail | null;
  canEdit: boolean;
  healthScore: string;
  setHealthScore: React.Dispatch<React.SetStateAction<string>>;
  renewalDate: string;
  setRenewalDate: React.Dispatch<React.SetStateAction<string>>;
  onRecordHealth: (event: React.FormEvent) => void;
  onAddRenewal: (event: React.FormEvent) => void;
}

function CsAccountDetailCard({ detail, canEdit, healthScore, setHealthScore, renewalDate, setRenewalDate, onRecordHealth, onAddRenewal }: CsAccountDetailCardProps) {
  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account detail</CardTitle>
          <CardDescription>Select a customer success account to review health, renewals, and QBRs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">No account selected.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{detail.account?.name ?? "Customer success account"}</CardTitle>
        <CardDescription>
          {detail.segment?.label ?? "No segment"} • {detail.lifecycleStage?.label ?? "No stage"} • {detail.riskStatus?.label ?? "No risk"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Health</dt><dd className="font-medium">{detail.healthScore ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Adoption</dt><dd className="font-medium">{detail.adoptionScore ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">CSM owner</dt><dd className="font-medium">{detail.csmOwner?.displayName ?? "Unassigned"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contract value</dt><dd className="font-medium">{formatCurrencyAmount(detail.contractValue)}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Expansion</dt><dd className="font-medium">{detail.expansionPotential?.label ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next action</dt><dd className="font-medium">{detail.nextAction ?? "—"}</dd></div>
        </dl>

        <DetailSection title={`Onboarding plans (${detail.onboardingPlans.length})`}>
          {detail.onboardingPlans.map((plan) => (
            <li key={plan.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{plan.name}</span><Badge variant="muted">{plan.status}</Badge><Badge variant="muted">{plan.completedMilestoneCount}/{plan.milestoneCount} milestones</Badge></div>
            </li>
          ))}
        </DetailSection>

        <DetailSection title={`Health scores (${detail.healthScores.length})`}>
          {detail.healthScores.slice(0, 5).map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2"><span className="font-medium">{entry.score}</span>{entry.riskStatus ? <Badge variant="muted">{entry.riskStatus.label}</Badge> : null}<span className="text-xs text-muted-foreground">{formatDateOnly(entry.recordedAt)}</span></li>
          ))}
        </DetailSection>

        <DetailSection title={`Renewals (${detail.renewals.length})`}>
          {detail.renewals.map((renewal) => (
            <li key={renewal.id} className="flex flex-wrap items-center gap-2"><span className="font-medium">{formatDateOnly(renewal.renewalDate)}</span><Badge variant="muted">{renewal.status?.label ?? "—"}</Badge><span className="text-xs text-muted-foreground">{formatCurrencyAmount(renewal.forecastValue)}</span></li>
          ))}
        </DetailSection>

        <DetailSection title={`QBR / EBR (${detail.qbrs.length})`}>
          {detail.qbrs.map((qbr) => (
            <li key={qbr.id} className="flex flex-wrap items-center gap-2"><span className="font-medium">{qbr.title}</span><Badge variant="muted">{qbr.qbrType.toUpperCase()}</Badge><Badge variant="muted">{qbr.status}</Badge></li>
          ))}
        </DetailSection>

        <DetailSection title={`Escalations (${detail.escalations.length})`}>
          {detail.escalations.map((escalation) => (
            <li key={escalation.id} className="flex flex-wrap items-center gap-2"><span className="font-medium">{escalation.title}</span><Badge variant="muted">{escalation.severity}</Badge><Badge variant="muted">{escalation.status}</Badge></li>
          ))}
        </DetailSection>

        <DetailSection title={`Success plans (${detail.successPlans.length})`}>
          {detail.successPlans.map((plan) => (
            <li key={plan.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{plan.name}</span><Badge variant="muted">{plan.status}</Badge><Badge variant="muted">{plan.stakeholders.length} stakeholders</Badge></div></li>
          ))}
        </DetailSection>

        {canEdit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <form className="flex gap-2" onSubmit={onRecordHealth}>
              <Input type="number" min={0} max={100} placeholder="Health score" value={healthScore} onChange={(event) => setHealthScore(event.target.value)} />
              <Button type="submit" variant="outline">Record health</Button>
            </form>
            <form className="flex gap-2" onSubmit={onAddRenewal}>
              <Input type="date" value={renewalDate} onChange={(event) => setRenewalDate(event.target.value)} />
              <Button type="submit" variant="outline">Add renewal</Button>
            </form>
          </div>
        ) : null}

        {detail.aiPlaceholders.actions.length > 0 ? (
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">AI placeholders</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.aiPlaceholders.actions.map((action) => (
                <Button key={action.key} variant="outline" size="sm" disabled title={action.description}>{action.label}</Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {items.length === 0 || (Array.isArray(children) && children.length === 0) ? (
        <p className="mt-1 text-muted-foreground">None recorded.</p>
      ) : (
        <ul className="mt-2 space-y-1">{children}</ul>
      )}
    </div>
  );
}
