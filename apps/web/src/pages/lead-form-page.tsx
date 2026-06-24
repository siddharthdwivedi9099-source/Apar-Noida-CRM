import { useEffect, useState } from "react";
import type {
  CreateLeadRequestBody,
  CrmOptionValueSummary,
  LeadClassificationMetadata,
  LeadOptionsResponse,
  LeadResponse,
  UpdateLeadRequestBody
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { selectClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

interface LeadFormState {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  statusKey: string;
  sourceKey: string;
  score: string;
  ownerId: string;
  // Lead classification
  leadFor: string;
  technologies: string[];
  products: string[];
}

const defaultFormState: LeadFormState = {
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  statusKey: "",
  sourceKey: "",
  score: "",
  ownerId: "",
  leadFor: "",
  technologies: [],
  products: []
};

const SERVICE_PROJECT_KEY = "service_project";
const PRODUCT_KEY = "product";

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

// Checkbox-based multi-select that matches the form's styling.
function MultiSelect({
  options,
  selected,
  onToggle
}: {
  options: CrmOptionValueSummary[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">No options configured. Add them in Admin → Option Sets.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isChecked = selected.includes(option.key);
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => onToggle(option.key)}
            aria-pressed={isChecked}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              isChecked
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {isChecked ? "✓ " : ""}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function LeadFormPage() {
  const { leadId } = useParams();
  const isEditMode = Boolean(leadId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const leadLabel = getModuleLabel("leads", "singular");
  const [options, setOptions] = useState<LeadOptionsResponse | null>(null);
  const [formState, setFormState] = useState<LeadFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const optionsResponse = await apiRequest<LeadOptionsResponse>("/leads/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        if (!isEditMode || !leadId) {
          setFormState((currentValue) => ({
            ...currentValue,
            statusKey: optionsResponse.statuses.find((status) => status.isDefault)?.key ?? optionsResponse.statuses[0]?.key ?? "",
            sourceKey: optionsResponse.sources.find((source) => source.isDefault)?.key ?? optionsResponse.sources[0]?.key ?? "",
            leadFor: optionsResponse.leadForOptions.find((option) => option.isDefault)?.key ?? optionsResponse.leadForOptions[0]?.key ?? ""
          }));
          return;
        }

        const leadResponse = await apiRequest<LeadResponse>(`/leads/${leadId}`, {
          method: "GET",
          accessToken
        });
        const { lead } = leadResponse;
        const classification = (lead.metadata ?? {}) as LeadClassificationMetadata;

        setFormState({
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          email: lead.email ?? "",
          phone: lead.phone ?? "",
          statusKey: lead.status?.key ?? optionsResponse.statuses[0]?.key ?? "",
          sourceKey: lead.source?.key ?? optionsResponse.sources[0]?.key ?? "",
          score: lead.score !== null ? String(lead.score) : "",
          ownerId: lead.owner?.id ?? "",
          leadFor: classification.leadFor ?? optionsResponse.leadForOptions[0]?.key ?? "",
          technologies: Array.isArray(classification.technologies) ? classification.technologies : [],
          products: Array.isArray(classification.products) ? classification.products : []
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, isEditMode, leadId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    // Only persist the technology/product list relevant to the chosen "Lead For".
    const classification: LeadClassificationMetadata = {
      leadFor: formState.leadFor || null,
      technologies: formState.leadFor === SERVICE_PROJECT_KEY ? formState.technologies : [],
      products: formState.leadFor === PRODUCT_KEY ? formState.products : []
    };

    const payload = {
      firstName: formState.firstName,
      lastName: formState.lastName,
      companyName: formState.companyName,
      email: formState.email || null,
      phone: formState.phone || null,
      statusKey: formState.statusKey,
      sourceKey: formState.sourceKey,
      score: formState.score ? Number(formState.score) : null,
      ownerId: formState.ownerId || null,
      metadata: classification as Record<string, unknown>
    } satisfies CreateLeadRequestBody & UpdateLeadRequestBody;

    try {
      const response = isEditMode && leadId
        ? await apiRequest<LeadResponse>(`/leads/${leadId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<LeadResponse>("/leads", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/leads/${response.lead.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={isEditMode ? `Loading ${leadLabel.toLowerCase()} for editing` : `Preparing ${leadLabel.toLowerCase()} form`}
        description="The page is loading tenant-backed owners, dropdown values, and the current record when needed."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow={isEditMode ? "Lead maintenance" : "Lead creation"}
        title={isEditMode ? `Update this ${leadLabel.toLowerCase()} cleanly and keep audit history intact.` : `Create a new ${leadLabel.toLowerCase()} with owner, source, and qualification context from day one.`}
        summary="Form defaults and dropdown values come from the tenant configuration engine, while every save is protected by the CRM API and audit logging."
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && leadId ? `/leads/${leadId}` : "/leads"}>{isEditMode ? "Back to detail" : "Back to list"}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${leadLabel}` : `Create ${leadLabel}`}</CardTitle>
          <CardDescription>
            Capture the owner, source, and qualification fields that power list filters and later handoff workflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2">
              <span className="text-sm font-medium">First name</span>
              <Input
                required
                value={formState.firstName}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, firstName: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Last name</span>
              <Input
                required
                value={formState.lastName}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, lastName: event.target.value }))}
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Company</span>
              <Input
                required
                value={formState.companyName}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, companyName: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Email</span>
              <Input
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, email: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Phone</span>
              <Input
                value={formState.phone}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, phone: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Status</span>
              <select
                className={selectClassName}
                value={formState.statusKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, statusKey: event.target.value }))}
              >
                {options?.statuses.map((status) => (
                  <option key={status.id} value={status.key}>
                    {status.label}
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
              <span className="text-sm font-medium">Lead score placeholder</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={formState.score}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, score: event.target.value }))}
                placeholder="Optional"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Lead For</span>
              <select
                className={selectClassName}
                value={formState.leadFor}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, leadFor: event.target.value }))}
              >
                {options?.leadForOptions.map((option) => (
                  <option key={option.id} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {formState.leadFor === SERVICE_PROJECT_KEY ? (
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Technologies (select all that apply)</span>
                <MultiSelect
                  options={options?.technologyOptions ?? []}
                  selected={formState.technologies}
                  onToggle={(value) =>
                    setFormState((currentValue) => ({ ...currentValue, technologies: toggleValue(currentValue.technologies, value) }))
                  }
                />
              </div>
            ) : null}

            {formState.leadFor === PRODUCT_KEY ? (
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Products (select all that apply)</span>
                <MultiSelect
                  options={options?.productOptions ?? []}
                  selected={formState.products}
                  onToggle={(value) =>
                    setFormState((currentValue) => ({ ...currentValue, products: toggleValue(currentValue.products, value) }))
                  }
                />
              </div>
            ) : null}

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? `Save ${leadLabel}` : `Create ${leadLabel}`}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
