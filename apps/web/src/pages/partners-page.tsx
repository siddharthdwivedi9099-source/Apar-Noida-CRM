import { useEffect, useMemo, useState } from "react";
import type {
  CreatePartnerDealRegistrationRequestBody,
  CreatePartnerRequestBody,
  PartnerDashboardResponse,
  PartnerDetail,
  PartnerOnboardingTaskInput,
  PartnerOnboardingTaskStatus,
  PartnerOptionsResponse,
  PartnersResponse
} from "@crm/types";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmEmptyState, CrmHero, CrmLoadingState, CrmMetricCard } from "@/components/crm/crm-shell";
import { apiRequest } from "@/lib/api-client";
import { formatCurrencyAmount, formatDateOnly, selectClassName, textareaClassName } from "@/lib/crm";
import { getErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

const ONBOARDING_NEXT_STATUS: Record<PartnerOnboardingTaskStatus, PartnerOnboardingTaskStatus> = {
  pending: "in_progress",
  in_progress: "completed",
  completed: "pending",
  blocked: "pending"
};

interface PartnerFormState {
  name: string;
  typeKey: string;
  tierKey: string;
  statusKey: string;
  onboardingStatusKey: string;
  accountId: string;
  ownerId: string;
  region: string;
  territory: string;
  agreementReference: string;
  onboardingTasks: string;
}

interface DealFormState {
  name: string;
  stageKey: string;
  customerName: string;
  amount: string;
  opportunityId: string;
}

function buildPartnerFormState(options: PartnerOptionsResponse | null): PartnerFormState {
  return {
    name: "",
    typeKey: options?.types.find((entry) => entry.isDefault)?.key ?? options?.types[0]?.key ?? "",
    tierKey: options?.tiers.find((entry) => entry.isDefault)?.key ?? options?.tiers[0]?.key ?? "",
    statusKey: options?.statuses.find((entry) => entry.isDefault)?.key ?? options?.statuses[0]?.key ?? "",
    onboardingStatusKey:
      options?.onboardingStatuses.find((entry) => entry.isDefault)?.key ?? options?.onboardingStatuses[0]?.key ?? "",
    accountId: "",
    ownerId: "",
    region: "",
    territory: "",
    agreementReference: "",
    onboardingTasks: ""
  };
}

export function PartnersPage() {
  const { accessToken, hasAnyPermission } = useAuth();
  const [options, setOptions] = useState<PartnerOptionsResponse | null>(null);
  const [dashboard, setDashboard] = useState<PartnerDashboardResponse | null>(null);
  const [data, setData] = useState<PartnersResponse | null>(null);
  const [detail, setDetail] = useState<PartnerDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<PartnerFormState>(buildPartnerFormState(null));
  const [formError, setFormError] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState<DealFormState>({ name: "", stageKey: "", customerName: "", amount: "", opportunityId: "" });

  const canCreate = hasAnyPermission(["partners.create", "partners.configure"]);
  const canEdit = hasAnyPermission(["partners.edit", "partners.assign", "partners.configure", "partners.manage_workflow"]);
  const canRegisterDeal = hasAnyPermission(["partners.create", "partners.edit", "partners.configure"]);

  const partners = useMemo(() => data?.partners ?? [], [data?.partners]);

  // Client-side search / filter / sort over the loaded partner list.
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "deals" | "onboarding">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const visiblePartners = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = partners.filter((partner) => {
      if (statusFilter && partner.status?.key !== statusFilter) return false;
      if (tierFilter && partner.tier?.key !== tierFilter) return false;
      if (term) {
        const haystack = `${partner.name} ${partner.region ?? ""} ${partner.territory ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    const direction = sortOrder === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "deals") return (a.dealCount - b.dealCount) * direction;
      if (sortBy === "onboarding") return (a.completedOnboardingTaskCount - b.completedOnboardingTaskCount) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [partners, search, statusFilter, tierFilter, sortBy, sortOrder]);

  async function loadList() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [optionsResponse, dashboardResponse, listResponse] = await Promise.all([
        apiRequest<PartnerOptionsResponse>("/partners/options", { method: "GET", accessToken }),
        apiRequest<PartnerDashboardResponse>("/partners/dashboard", { method: "GET", accessToken }),
        apiRequest<PartnersResponse>("/partners?pageSize=100", { method: "GET", accessToken })
      ]);
      setOptions(optionsResponse);
      setDashboard(dashboardResponse);
      setData(listResponse);
      setFormState((current) => (current.typeKey ? current : buildPartnerFormState(optionsResponse)));
      setDealForm((current) => ({ ...current, stageKey: current.stageKey || optionsResponse.dealStages[0]?.key || "" }));
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
    if (partners.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) => (current && partners.some((partner) => partner.id === current) ? current : partners[0].id));
  }, [partners]);

  async function loadDetail(partnerId: string) {
    if (!accessToken) {
      return;
    }

    try {
      const response = await apiRequest<{ partner: PartnerDetail }>(`/partners/${partnerId}`, { method: "GET", accessToken });
      setDetail(response.partner);
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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setFormError(null);

    const onboardingTasks: PartnerOnboardingTaskInput[] = formState.onboardingTasks
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((label) => ({ label }));

    const payload: CreatePartnerRequestBody = {
      name: formState.name.trim(),
      typeKey: formState.typeKey,
      tierKey: formState.tierKey,
      statusKey: formState.statusKey,
      onboardingStatusKey: formState.onboardingStatusKey,
      accountId: formState.accountId || null,
      ownerId: formState.ownerId || null,
      region: formState.region.trim() || null,
      territory: formState.territory.trim() || null,
      agreementReference: formState.agreementReference.trim() || null,
      onboardingTasks: onboardingTasks.length > 0 ? onboardingTasks : undefined
    };

    try {
      const response = await apiRequest<{ partner: PartnerDetail }>("/partners", { method: "POST", accessToken, body: payload });
      setIsCreating(false);
      setFormState(buildPartnerFormState(options));
      await loadList();
      setSelectedId(response.partner.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function handleAdvanceOnboardingTask(taskId: string) {
    if (!accessToken || !detail || !canEdit) {
      return;
    }

    const onboardingTasks: PartnerOnboardingTaskInput[] = detail.onboardingTasks.map((task) => ({
      label: task.label,
      status: task.id === taskId ? ONBOARDING_NEXT_STATUS[task.status] : task.status,
      sortOrder: task.sortOrder,
      dueDate: task.dueDate,
      notes: task.notes
    }));

    try {
      await apiRequest(`/partners/${detail.id}`, {
        method: "PATCH",
        accessToken,
        body: { onboardingTasks }
      });
      await loadDetail(detail.id);
      await loadList();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function handleRegisterDeal(event: React.FormEvent) {
    event.preventDefault();

    if (!accessToken || !detail) {
      return;
    }

    const payload: CreatePartnerDealRegistrationRequestBody = {
      name: dealForm.name.trim(),
      stageKey: dealForm.stageKey || undefined,
      customerName: dealForm.customerName.trim() || null,
      amount: dealForm.amount ? Number(dealForm.amount) : null,
      opportunityId: dealForm.opportunityId || null
    };

    try {
      await apiRequest(`/partners/${detail.id}/deals`, { method: "POST", accessToken, body: payload });
      setDealForm({ name: "", stageKey: options?.dealStages[0]?.key ?? "", customerName: "", amount: "", opportunityId: "" });
      await loadDetail(detail.id);
      await loadList();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title="Loading partner channel workspace"
        description="Partner dashboard, partner list, onboarding, and deal registrations are loading from the tenant-safe API."
      />
    );
  }

  if (!data || !options || !dashboard) {
    return (
      <CrmEmptyState
        title="The partner channel workspace could not be loaded."
        description={errorMessage ?? "The current tenant session could not load partners."}
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
        eyebrow="Partner channel"
        title="Partner profiles, onboarding, deal registration, and channel performance now run from one workspace."
        summary="Partner records keep type, tier, status, onboarding, contacts, agreements, and registered deals connected to the same tenant-aware accounts and opportunities used across the CRM."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating((current) => !current)}>{isCreating ? "Close form" : "Add partner"}</Button>
          ) : null
        }
        aside={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <CrmMetricCard label="Partners" value={String(dashboard.totalPartners)} description="Total partners in scope." />
            <CrmMetricCard label="Active" value={String(dashboard.activePartners)} description="Partners in active status." />
            <CrmMetricCard
              label="Registered deals"
              value={String(dashboard.registeredDealCount)}
              description={`${formatCurrencyAmount(dashboard.registeredDealValue)} registered value`}
            />
          </div>
        }
      />

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CrmMetricCard label="Onboarding in progress" value={String(dashboard.onboardingInProgress)} description="Partners actively onboarding." />
        <CrmMetricCard label="Won deals" value={String(dashboard.wonDealCount)} description="Registered deals marked won." />
        <CrmMetricCard label="Tiers" value={String(dashboard.tierDistribution.length)} description="Distinct partner tiers in scope." />
        <CrmMetricCard label="Scope" value={dashboard.scope} description="Visibility scope for this role." />
      </section>

      {isCreating && canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New partner</CardTitle>
            <CardDescription>Capture the partner profile, classification, and onboarding checklist.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Partner name</span>
                <Input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} required minLength={2} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Type</span>
                <select className={selectClassName} value={formState.typeKey} onChange={(event) => setFormState((current) => ({ ...current, typeKey: event.target.value }))}>
                  {options.types.map((entry) => (
                    <option key={entry.id} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Tier</span>
                <select className={selectClassName} value={formState.tierKey} onChange={(event) => setFormState((current) => ({ ...current, tierKey: event.target.value }))}>
                  {options.tiers.map((entry) => (
                    <option key={entry.id} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Status</span>
                <select className={selectClassName} value={formState.statusKey} onChange={(event) => setFormState((current) => ({ ...current, statusKey: event.target.value }))}>
                  {options.statuses.map((entry) => (
                    <option key={entry.id} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Onboarding status</span>
                <select className={selectClassName} value={formState.onboardingStatusKey} onChange={(event) => setFormState((current) => ({ ...current, onboardingStatusKey: event.target.value }))}>
                  {options.onboardingStatuses.map((entry) => (
                    <option key={entry.id} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Linked account</span>
                <select className={selectClassName} value={formState.accountId} onChange={(event) => setFormState((current) => ({ ...current, accountId: event.target.value }))}>
                  <option value="">No linked account</option>
                  {options.accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Partner owner</span>
                <select className={selectClassName} value={formState.ownerId} onChange={(event) => setFormState((current) => ({ ...current, ownerId: event.target.value }))}>
                  <option value="">Unassigned</option>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.displayName}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Region</span>
                <Input value={formState.region} onChange={(event) => setFormState((current) => ({ ...current, region: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Territory</span>
                <Input value={formState.territory} onChange={(event) => setFormState((current) => ({ ...current, territory: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Agreement reference</span>
                <Input value={formState.agreementReference} onChange={(event) => setFormState((current) => ({ ...current, agreementReference: event.target.value }))} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Onboarding checklist (one task per line)</span>
                <textarea className={textareaClassName} rows={3} value={formState.onboardingTasks} onChange={(event) => setFormState((current) => ({ ...current, onboardingTasks: event.target.value }))} />
              </label>
              {formError ? <p className="text-sm text-rose-600 md:col-span-2">{formError}</p> : null}
              <div className="flex gap-3 md:col-span-2">
                <Button type="submit">Create partner</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Partner list</CardTitle>
            <CardDescription>Channel partners with type, tier, status, and onboarding progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Search name, region, territory..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="sm:col-span-2"
              />
              <select className={selectClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {options.statuses.map((entry) => (
                  <option key={entry.id} value={entry.key}>{entry.label}</option>
                ))}
              </select>
              <select className={selectClassName} value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
                <option value="">All tiers</option>
                {options.tiers.map((entry) => (
                  <option key={entry.id} value={entry.key}>{entry.label}</option>
                ))}
              </select>
              <select className={selectClassName} value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="name">Sort: Name</option>
                <option value="deals">Sort: Deal count</option>
                <option value="onboarding">Sort: Onboarding progress</option>
              </select>
              <select className={selectClassName} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{visiblePartners.length} of {partners.length} partners</p>
            {visiblePartners.length === 0 ? (
              <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                {partners.length === 0 ? "No partners are currently visible for this role." : "No partners match the current filters."}
              </div>
            ) : (
              visiblePartners.map((partner) => (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => setSelectedId(partner.id)}
                  className={cn(
                    "w-full rounded-[1.25rem] border border-border/70 bg-background/75 p-4 text-left shadow-sm transition hover:border-primary/50",
                    selectedId === partner.id ? "border-primary bg-primary/5" : ""
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{partner.tier?.label ?? "Tier missing"}</Badge>
                    <Badge variant="muted">{partner.type?.label ?? "Type missing"}</Badge>
                    <Badge variant="muted">{partner.status?.label ?? "Status missing"}</Badge>
                  </div>
                  <p className="mt-3 font-semibold">{partner.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{partner.region ?? "Region n/a"} • {partner.territory ?? "Territory n/a"}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Owner {partner.owner?.displayName ?? "Unassigned"} • {partner.completedOnboardingTaskCount}/{partner.onboardingTaskCount} onboarding • {partner.dealCount} deals
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <PartnerDetailCard
          detail={detail}
          dealStages={options.dealStages}
          opportunities={options.opportunities}
          canEdit={canEdit}
          canRegisterDeal={canRegisterDeal}
          dealForm={dealForm}
          setDealForm={setDealForm}
          onAdvanceTask={handleAdvanceOnboardingTask}
          onRegisterDeal={handleRegisterDeal}
        />
      </section>
    </div>
  );
}

interface PartnerDetailCardProps {
  detail: PartnerDetail | null;
  dealStages: PartnerOptionsResponse["dealStages"];
  opportunities: PartnerOptionsResponse["opportunities"];
  canEdit: boolean;
  canRegisterDeal: boolean;
  dealForm: DealFormState;
  setDealForm: React.Dispatch<React.SetStateAction<DealFormState>>;
  onAdvanceTask: (taskId: string) => void;
  onRegisterDeal: (event: React.FormEvent) => void;
}

function PartnerDetailCard({
  detail,
  dealStages,
  opportunities,
  canEdit,
  canRegisterDeal,
  dealForm,
  setDealForm,
  onAdvanceTask,
  onRegisterDeal
}: PartnerDetailCardProps) {
  if (!detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Partner detail</CardTitle>
          <CardDescription>Select a partner to review its profile, onboarding, and deals.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.25rem] bg-background/75 p-4 text-sm leading-6 text-muted-foreground">No partner selected.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{detail.name}</CardTitle>
        <CardDescription>
          {detail.type?.label ?? "No type"} • {detail.tier?.label ?? "No tier"} • {detail.status?.label ?? "No status"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Owner</dt>
            <dd className="font-medium">{detail.owner?.displayName ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Onboarding</dt>
            <dd className="font-medium">{detail.onboardingStatus?.label ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Linked account</dt>
            <dd className="font-medium">
              {detail.account ? (
                <Link className="text-primary hover:underline" to={`/accounts/${detail.account.id}`}>{detail.account.name}</Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Agreement</dt>
            <dd className="font-medium">{detail.agreementReference ?? "—"}</dd>
          </div>
        </dl>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Partner contacts</p>
          {detail.contacts.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No partner contacts captured.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {detail.contacts.map((contact) => (
                <li key={contact.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{contact.name}</span>
                  {contact.isPrimary ? <Badge variant="muted">Primary</Badge> : null}
                  {contact.title ? <span className="text-muted-foreground">{contact.title}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Onboarding checklist ({detail.performance.completedOnboardingTaskCount}/{detail.performance.onboardingTaskCount})
          </p>
          {detail.onboardingTasks.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No onboarding tasks yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.onboardingTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-[1rem] border border-border/60 bg-background/75 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-medium", task.status === "completed" ? "line-through text-muted-foreground" : "")}>{task.label}</span>
                    <Badge variant="muted">{task.status}</Badge>
                  </div>
                  {canEdit ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onAdvanceTask(task.id)}>
                      Advance
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Registered deals ({detail.deals.length})</p>
          {detail.deals.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No deals registered yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {detail.deals.map((deal) => (
                <li key={deal.id} className="rounded-[1rem] border border-border/60 bg-background/75 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{deal.name}</span>
                    <Badge variant="muted">{deal.stage?.label ?? "Stage missing"}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {deal.customerName ?? "No customer"} • {formatCurrencyAmount(deal.amount)} • Close {formatDateOnly(deal.expectedCloseDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canRegisterDeal ? (
            <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={onRegisterDeal}>
              <Input placeholder="Deal name" value={dealForm.name} onChange={(event) => setDealForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} />
              <select className={selectClassName} value={dealForm.stageKey} onChange={(event) => setDealForm((current) => ({ ...current, stageKey: event.target.value }))}>
                {dealStages.map((stage) => (
                  <option key={stage.id} value={stage.key}>{stage.label}</option>
                ))}
              </select>
              <Input placeholder="Customer name" value={dealForm.customerName} onChange={(event) => setDealForm((current) => ({ ...current, customerName: event.target.value }))} />
              <Input type="number" min={0} placeholder="Amount" value={dealForm.amount} onChange={(event) => setDealForm((current) => ({ ...current, amount: event.target.value }))} />
              <select className={cn(selectClassName, "sm:col-span-2")} value={dealForm.opportunityId} onChange={(event) => setDealForm((current) => ({ ...current, opportunityId: event.target.value }))}>
                <option value="">No linked opportunity</option>
                {opportunities.map((opportunity) => (
                  <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>
                ))}
              </select>
              <Button type="submit" className="sm:col-span-2">Register deal</Button>
            </form>
          ) : null}
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
