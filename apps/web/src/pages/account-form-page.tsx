import { useEffect, useState } from "react";
import type {
  CrmFieldDefinition,
  CrmOptionValueSummary,
  AccountOptionsResponse,
  AccountResponse,
  CreateAccountRequestBody,
  UpdateAccountRequestBody
} from "@crm/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmHero, CrmLoadingState } from "@/components/crm/crm-shell";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import {
  getActiveCustomFieldDefinitions,
  getCustomFieldOptions,
  normalizeCustomFieldFormValue,
  serializeCustomFieldFormValue,
  type CrmCustomFieldFormValue
} from "@/lib/crm-custom-fields";
import { selectClassName, textareaClassName } from "@/lib/crm";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";
import { Link, useNavigate, useParams } from "react-router-dom";

interface AccountFormState {
  name: string;
  website: string;
  industry: string;
  accountTypeKey: string;
  healthStatusKey: string;
  ownerId: string;
  customFields: Record<string, CrmCustomFieldFormValue>;
}

const defaultFormState: AccountFormState = {
  name: "",
  website: "",
  industry: "",
  accountTypeKey: "",
  healthStatusKey: "",
  ownerId: "",
  customFields: {}
};

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

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

export function AccountFormPage() {
  const { accountId } = useParams();
  const isEditMode = Boolean(accountId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const accountLabel = getModuleLabel("accounts", "singular");
  const [options, setOptions] = useState<AccountOptionsResponse | null>(null);
  const [formState, setFormState] = useState<AccountFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const customFieldDefinitions = getActiveCustomFieldDefinitions(options);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      try {
        const optionsResponse = await apiRequest<AccountOptionsResponse>("/accounts/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        if (!isEditMode || !accountId) {
          setFormState((currentValue) => ({
            ...currentValue,
            accountTypeKey: optionsResponse.accountTypes.find((option) => option.isDefault)?.key ?? "",
            healthStatusKey: optionsResponse.healthStatuses.find((option) => option.isDefault)?.key ?? ""
          }));
          return;
        }

        const accountResponse = await apiRequest<AccountResponse>(`/accounts/${accountId}`, {
          method: "GET",
          accessToken
        });
        const { account } = accountResponse;

        setFormState({
          name: account.name,
          website: account.website ?? "",
          industry: account.industry ?? "",
          accountTypeKey: account.accountType?.key ?? "",
          healthStatusKey: account.healthStatus?.key ?? "",
          ownerId: account.owner?.id ?? "",
          customFields: Object.fromEntries(
            getActiveCustomFieldDefinitions(optionsResponse).map((field) => [
              field.fieldKey,
              normalizeCustomFieldFormValue(field, account.customFields[field.fieldKey])
            ])
          )
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, accountId, isEditMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const customFields =
      customFieldDefinitions.length > 0
        ? Object.fromEntries(
            customFieldDefinitions.map((field) => [
              field.fieldKey,
              serializeCustomFieldFormValue(field, getCustomFieldValue(field))
            ])
          )
        : undefined;

    const payload = {
      name: formState.name,
      website: formState.website || null,
      industry: formState.industry || null,
      accountTypeKey: formState.accountTypeKey || null,
      healthStatusKey: formState.healthStatusKey || null,
      ownerId: formState.ownerId || null,
      customFields
    } satisfies CreateAccountRequestBody & UpdateAccountRequestBody;

    try {
      const response = isEditMode && accountId
        ? await apiRequest<AccountResponse>(`/accounts/${accountId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<AccountResponse>("/accounts", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/accounts/${response.account.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={isEditMode ? `Loading ${accountLabel.toLowerCase()} for editing` : `Preparing ${accountLabel.toLowerCase()} form`}
        description="The page is loading tenant-backed owners and account dropdown values."
      />
    );
  }

  function getCustomFieldValue(field: CrmFieldDefinition): CrmCustomFieldFormValue {
    const value = formState.customFields[field.fieldKey];
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      return value;
    }
    return field.dataType === "multiselect" ? [] : "";
  }

  function updateCustomFieldValue(fieldKey: string, value: CrmCustomFieldFormValue) {
    setFormState((currentValue) => ({
      ...currentValue,
      customFields: {
        ...currentValue.customFields,
        [fieldKey]: value
      }
    }));
  }

  function renderCustomField(field: CrmFieldDefinition) {
    const value = getCustomFieldValue(field);
    const fieldOptions = getCustomFieldOptions(options, field);
    const labelClassName = field.dataType === "textarea" || field.dataType === "multiselect" ? "space-y-2 md:col-span-2" : "space-y-2";
    const placeholder = field.placeholder ?? "";

    if (field.dataType === "textarea") {
      return (
        <label key={field.fieldKey} className={labelClassName}>
          <span className="text-sm font-medium">{field.label}</span>
          <textarea
            className={textareaClassName}
            rows={4}
            required={field.isRequired}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateCustomFieldValue(field.fieldKey, event.target.value)}
            placeholder={placeholder || undefined}
          />
          {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
        </label>
      );
    }

    if (field.dataType === "select") {
      return (
        <label key={field.fieldKey} className={labelClassName}>
          <span className="text-sm font-medium">{field.label}</span>
          <select
            className={selectClassName}
            required={field.isRequired}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateCustomFieldValue(field.fieldKey, event.target.value)}
          >
            <option value="">{placeholder || `Select ${field.label.toLowerCase()}`}</option>
            {fieldOptions.map((option) => (
              <option key={option.id} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
        </label>
      );
    }

    if (field.dataType === "multiselect") {
      return (
        <div key={field.fieldKey} className={labelClassName}>
          <span className="text-sm font-medium">{field.label}</span>
          <MultiSelect
            options={fieldOptions}
            selected={Array.isArray(value) ? value : []}
            onToggle={(optionKey) =>
              updateCustomFieldValue(field.fieldKey, toggleValue(Array.isArray(value) ? value : [], optionKey))
            }
          />
          {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
        </div>
      );
    }

    if (field.dataType === "boolean") {
      return (
        <label key={field.fieldKey} className={labelClassName}>
          <span className="text-sm font-medium">{field.label}</span>
          <select
            className={selectClassName}
            required={field.isRequired}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => updateCustomFieldValue(field.fieldKey, event.target.value)}
          >
            <option value="">{placeholder || "Not set"}</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
        </label>
      );
    }

    const inputType =
      field.dataType === "email"
        ? "email"
        : field.dataType === "url"
          ? "url"
          : field.dataType === "phone"
            ? "tel"
            : field.dataType === "date"
              ? "date"
              : field.dataType === "datetime"
                ? "datetime-local"
                : field.dataType === "number"
                  ? "number"
                  : "text";

    return (
      <label key={field.fieldKey} className={labelClassName}>
        <span className="text-sm font-medium">{field.label}</span>
        <Input
          type={inputType}
          required={field.isRequired}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => updateCustomFieldValue(field.fieldKey, event.target.value)}
          placeholder={placeholder || undefined}
        />
        {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
      </label>
    );
  }

  return (
    <div className="space-y-6">
      <CrmHero
        eyebrow={isEditMode ? "Account maintenance" : "Account creation"}
        title={isEditMode ? `Update this ${accountLabel.toLowerCase()} while keeping tenant isolation and audit history intact.` : `Create a new ${accountLabel.toLowerCase()} with owner, industry, and relationship metadata from the start.`}
        summary="This form attaches records to the shared customer context layer that later revenue, support, and success modules will reuse."
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && accountId ? `/accounts/${accountId}` : "/accounts"}>{isEditMode ? "Back to detail" : "Back to list"}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${accountLabel}` : `Create ${accountLabel}`}</CardTitle>
          <CardDescription>
            Establish the customer record, owner, and placeholder health model that downstream modules can extend later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Account name</span>
              <Input
                required
                value={formState.name}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, name: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Website</span>
              <Input
                type="url"
                value={formState.website}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, website: event.target.value }))}
                placeholder="https://example.com"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Industry</span>
              <Input
                value={formState.industry}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, industry: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Account type</span>
              <select
                className={selectClassName}
                value={formState.accountTypeKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, accountTypeKey: event.target.value }))}
              >
                <option value="">No type yet</option>
                {options?.accountTypes.map((option) => (
                  <option key={option.id} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Health placeholder</span>
              <select
                className={selectClassName}
                value={formState.healthStatusKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, healthStatusKey: event.target.value }))}
              >
                <option value="">No health state yet</option>
                {options?.healthStatuses.map((option) => (
                  <option key={option.id} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
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

            {customFieldDefinitions.length > 0 ? (
              <div className="space-y-2 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Tenant-defined fields</p>
                  <p className="text-sm text-muted-foreground">
                    These extra fields come from your workspace configuration and are saved with the account record.
                  </p>
                </div>
              </div>
            ) : null}

            {customFieldDefinitions.map((field) => renderCustomField(field))}

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? `Save ${accountLabel}` : `Create ${accountLabel}`}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
