import { useEffect, useState } from "react";
import type {
  CrmFieldDefinition,
  CrmOptionValueSummary,
  ContactOptionsResponse,
  ContactResponse,
  CreateContactRequestBody,
  UpdateContactRequestBody
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

interface ContactFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  roleKey: string;
  ownerId: string;
  accountId: string;
  customFields: Record<string, CrmCustomFieldFormValue>;
}

const defaultFormState: ContactFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  roleKey: "",
  ownerId: "",
  accountId: "",
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

export function ContactFormPage() {
  const { contactId } = useParams();
  const isEditMode = Boolean(contactId);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { getModuleLabel } = useTenantConfig();
  const contactLabel = getModuleLabel("contacts", "singular");
  const [options, setOptions] = useState<ContactOptionsResponse | null>(null);
  const [formState, setFormState] = useState<ContactFormState>(defaultFormState);
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
        const optionsResponse = await apiRequest<ContactOptionsResponse>("/contacts/options", {
          method: "GET",
          accessToken
        });
        setOptions(optionsResponse);

        if (!isEditMode || !contactId) {
          setFormState((currentValue) => ({
            ...currentValue,
            roleKey: optionsResponse.roles.find((option) => option.isDefault)?.key ?? ""
          }));
          return;
        }

        const contactResponse = await apiRequest<ContactResponse>(`/contacts/${contactId}`, {
          method: "GET",
          accessToken
        });
        const { contact } = contactResponse;

        setFormState({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          linkedinUrl: contact.linkedinUrl ?? "",
          roleKey: contact.role?.key ?? "",
          ownerId: contact.owner?.id ?? "",
          accountId: contact.account?.id ?? "",
          customFields: Object.fromEntries(
            getActiveCustomFieldDefinitions(optionsResponse).map((field) => [
              field.fieldKey,
              normalizeCustomFieldFormValue(field, contact.customFields[field.fieldKey])
            ])
          )
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, contactId, isEditMode]);

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
      firstName: formState.firstName,
      lastName: formState.lastName,
      email: formState.email || null,
      phone: formState.phone || null,
      linkedinUrl: formState.linkedinUrl || null,
      roleKey: formState.roleKey || null,
      ownerId: formState.ownerId || null,
      accountId: formState.accountId || null,
      customFields
    } satisfies CreateContactRequestBody & UpdateContactRequestBody;

    try {
      const response = isEditMode && contactId
        ? await apiRequest<ContactResponse>(`/contacts/${contactId}`, {
            method: "PATCH",
            accessToken,
            body: payload
          })
        : await apiRequest<ContactResponse>("/contacts", {
            method: "POST",
            accessToken,
            body: payload
          });

      navigate(`/contacts/${response.contact.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <CrmLoadingState
        title={isEditMode ? `Loading ${contactLabel.toLowerCase()} for editing` : `Preparing ${contactLabel.toLowerCase()} form`}
        description="The page is loading tenant-backed owners, roles, and account relationships."
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
        eyebrow={isEditMode ? "Contact maintenance" : "Contact creation"}
        title={isEditMode ? `Update this ${contactLabel.toLowerCase()} while keeping account relationships and audit history intact.` : `Create a new ${contactLabel.toLowerCase()} with stakeholder role, owner, and account mapping from day one.`}
        summary="This form is the bridge between individual stakeholder records and the shared account context layer."
        actions={
          <Button variant="outline" asChild>
            <Link to={isEditMode && contactId ? `/contacts/${contactId}` : "/contacts"}>{isEditMode ? "Back to detail" : "Back to list"}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? `Edit ${contactLabel}` : `Create ${contactLabel}`}</CardTitle>
          <CardDescription>
            Establish the stakeholder profile, related account, and contact role that later workflows can build on.
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
              <span className="text-sm font-medium">LinkedIn</span>
              <Input
                type="url"
                value={formState.linkedinUrl}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, linkedinUrl: event.target.value }))}
                placeholder="https://linkedin.com/in/example"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Contact role</span>
              <select
                className={selectClassName}
                value={formState.roleKey}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, roleKey: event.target.value }))}
              >
                <option value="">No role yet</option>
                {options?.roles.map((role) => (
                  <option key={role.id} value={role.key}>
                    {role.label}
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
              <span className="text-sm font-medium">Related account</span>
              <select
                className={selectClassName}
                value={formState.accountId}
                onChange={(event) => setFormState((currentValue) => ({ ...currentValue, accountId: event.target.value }))}
              >
                <option value="">No account yet</option>
                {options?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            {customFieldDefinitions.length > 0 ? (
              <div className="space-y-2 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Tenant-defined fields</p>
                  <p className="text-sm text-muted-foreground">
                    These extra fields come from your workspace configuration and are saved with the contact record.
                  </p>
                </div>
              </div>
            ) : null}

            {customFieldDefinitions.map((field) => renderCustomField(field))}

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? `Save ${contactLabel}` : `Create ${contactLabel}`}
              </Button>
              {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
