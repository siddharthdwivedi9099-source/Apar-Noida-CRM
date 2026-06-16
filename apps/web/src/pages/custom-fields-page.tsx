import { useEffect, useState } from "react";
import type {
  CustomFieldDataType,
  CustomFieldDefinition,
  CustomFormLayoutDefinition,
  CustomFormLayoutsResponse,
  CustomFieldsResponse,
  PermissionModuleKey,
  TenantOptionSet,
  TenantOptionSetsResponse
} from "@crm/types";
import { customFieldDataTypes, permissionModuleLabels, permissionModuleKeys } from "@crm/types";
import { Layers3, LayoutTemplate, Trash2 } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-message";
import { apiRequest } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { useTenantConfig } from "@/providers/tenant-config-provider";

const selectClassName =
  "flex h-11 w-full rounded-[1.25rem] border border-input bg-background px-4 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface FieldFormState {
  moduleKey: PermissionModuleKey;
  entityKey: string;
  fieldKey: string;
  label: string;
  description: string;
  dataType: CustomFieldDataType;
  placeholder: string;
  optionSetKey: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

const defaultFieldFormState: FieldFormState = {
  moduleKey: "leads",
  entityKey: "lead",
  fieldKey: "",
  label: "",
  description: "",
  dataType: "text",
  placeholder: "",
  optionSetKey: "",
  isRequired: false,
  isActive: true,
  sortOrder: 0
};

function buildFieldFormState(field: CustomFieldDefinition): FieldFormState {
  return {
    moduleKey: field.moduleKey,
    entityKey: field.entityKey,
    fieldKey: field.fieldKey,
    label: field.label,
    description: field.description ?? "",
    dataType: field.dataType,
    placeholder: field.placeholder ?? "",
    optionSetKey: field.optionSetKey ?? "",
    isRequired: field.isRequired,
    isActive: field.isActive,
    sortOrder: field.sortOrder
  };
}

export function CustomFieldsPage() {
  const { accessToken } = useAuth();
  const { reload } = useTenantConfig();
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [optionSets, setOptionSets] = useState<TenantOptionSet[]>([]);
  const [formLayouts, setFormLayouts] = useState<CustomFormLayoutDefinition[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [createFormState, setCreateFormState] = useState<FieldFormState>(defaultFieldFormState);
  const [editFormState, setEditFormState] = useState<FieldFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;
  const relevantOptionSets = optionSets.filter(
    (optionSet) =>
      optionSet.moduleKey === createFormState.moduleKey ||
      optionSet.moduleKey === editFormState?.moduleKey ||
      optionSet.moduleKey === null
  );

  async function loadWorkspaceMetadata() {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [fieldsResponse, optionSetsResponse, layoutsResponse] = await Promise.all([
        apiRequest<CustomFieldsResponse>("/tenant-config/custom-fields", {
          method: "GET",
          accessToken
        }),
        apiRequest<TenantOptionSetsResponse>("/tenant-config/option-sets", {
          method: "GET",
          accessToken
        }),
        apiRequest<CustomFormLayoutsResponse>("/tenant-config/form-layouts", {
          method: "GET",
          accessToken
        })
      ]);

      setFields(fieldsResponse.fields);
      setOptionSets(optionSetsResponse.optionSets);
      setFormLayouts(layoutsResponse.layouts);
      setSelectedFieldId((currentValue) =>
        currentValue && fieldsResponse.fields.some((field) => field.id === currentValue)
          ? currentValue
          : fieldsResponse.fields[0]?.id ?? null
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspaceMetadata();
  }, [accessToken]);

  useEffect(() => {
    setEditFormState(selectedField ? buildFieldFormState(selectedField) : null);
  }, [selectedFieldId, fields]);

  async function handleCreateField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<{ field: CustomFieldDefinition }>("/tenant-config/custom-fields", {
        method: "POST",
        accessToken,
        body: {
          moduleKey: createFormState.moduleKey,
          entityKey: createFormState.entityKey,
          fieldKey: createFormState.fieldKey || undefined,
          label: createFormState.label,
          description: createFormState.description || undefined,
          dataType: createFormState.dataType,
          placeholder: createFormState.placeholder || undefined,
          optionSetKey: createFormState.optionSetKey || null,
          isRequired: createFormState.isRequired,
          isActive: createFormState.isActive,
          sortOrder: createFormState.sortOrder
        }
      });
      await loadWorkspaceMetadata();
      await reload();
      setCreateFormState(defaultFieldFormState);
      setSelectedFieldId(response.field.id);
      setSuccessMessage(`Created custom field "${response.field.label}".`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveField() {
    if (!accessToken || !selectedField || !editFormState) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<{ field: CustomFieldDefinition }>(
        `/tenant-config/custom-fields/${selectedField.id}`,
        {
          method: "PATCH",
          accessToken,
          body: {
            label: editFormState.label,
            description: editFormState.description || null,
            placeholder: editFormState.placeholder || null,
            optionSetKey: editFormState.optionSetKey || null,
            isRequired: editFormState.isRequired,
            isActive: editFormState.isActive,
            sortOrder: editFormState.sortOrder
          }
        }
      );
      await loadWorkspaceMetadata();
      await reload();
      setSelectedFieldId(response.field.id);
      setSuccessMessage(`Updated custom field "${response.field.label}".`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteField() {
    if (!accessToken || !selectedField) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await apiRequest(`/tenant-config/custom-fields/${selectedField.id}`, {
        method: "DELETE",
        accessToken
      });
      await loadWorkspaceMetadata();
      await reload();
      setSuccessMessage(`Deleted custom field "${selectedField.label}".`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel overflow-hidden rounded-[2rem] p-8 lg:p-10">
        <Badge>Custom Field Foundation</Badge>
        <div className="mt-5 space-y-3">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Manage metadata for future custom fields, option sets, and form layouts.
          </h2>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            This is intentionally a foundation page. It proves CRUD, soft delete, option-set linkage, and layout
            readiness before full business forms land in later phases.
          </p>
        </div>
      </section>

      <AdminNav />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create custom field</CardTitle>
            <CardDescription>
              Add field metadata now so future CRM forms can pick it up without another schema migration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateField}>
              <label className="space-y-2">
                <span className="text-sm font-medium">Module</span>
                <select
                  className={selectClassName}
                  value={createFormState.moduleKey}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      moduleKey: event.target.value as PermissionModuleKey
                    }))
                  }
                >
                  {permissionModuleKeys.map((moduleKey) => (
                    <option key={moduleKey} value={moduleKey}>
                      {permissionModuleLabels[moduleKey]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Entity key</span>
                <Input
                  value={createFormState.entityKey}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      entityKey: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Field label</span>
                <Input
                  value={createFormState.label}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      label: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Field key</span>
                <Input
                  value={createFormState.fieldKey}
                  placeholder="auto-generated if blank"
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      fieldKey: event.target.value
                    }))
                  }
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Data type</span>
                <select
                  className={selectClassName}
                  value={createFormState.dataType}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      dataType: event.target.value as CustomFieldDataType
                    }))
                  }
                >
                  {customFieldDataTypes.map((dataType) => (
                    <option key={dataType} value={dataType}>
                      {dataType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Option set</span>
                <select
                  className={selectClassName}
                  value={createFormState.optionSetKey}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      optionSetKey: event.target.value
                    }))
                  }
                >
                  <option value="">None</option>
                  {relevantOptionSets.map((optionSet) => (
                    <option key={optionSet.id} value={optionSet.setKey}>
                      {optionSet.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium">Placeholder</span>
                <Input
                  value={createFormState.placeholder}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      placeholder: event.target.value
                    }))
                  }
                />
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="create-required"
                  type="checkbox"
                  checked={createFormState.isRequired}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      isRequired: event.target.checked
                    }))
                  }
                />
                <label htmlFor="create-required" className="text-sm font-medium">
                  Required field
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="create-active"
                  type="checkbox"
                  checked={createFormState.isActive}
                  onChange={(event) =>
                    setCreateFormState((currentValue) => ({
                      ...currentValue,
                      isActive: event.target.checked
                    }))
                  }
                />
                <label htmlFor="create-active" className="text-sm font-medium">
                  Active field
                </label>
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Create field"}
                </Button>
                {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
                {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration assets</CardTitle>
            <CardDescription>
              Seeded option sets and form layouts are already available for the next CRM phases to consume.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <div className="flex items-center gap-3">
                  <Layers3 className="h-4 w-4 text-primary" />
                  <p className="font-semibold">{optionSets.length} option sets</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Dropdowns, pipelines, ticket statuses, and customer-success stages are tenant-configurable.
                </p>
              </div>
              <div className="rounded-[1.25rem] bg-background/75 p-4">
                <div className="flex items-center gap-3">
                  <LayoutTemplate className="h-4 w-4 text-primary" />
                  <p className="font-semibold">{formLayouts.length} form layouts</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Layout metadata is seeded for future lead, account, and contact forms.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {optionSets.slice(0, 5).map((optionSet) => (
                <div key={optionSet.id} className="rounded-[1.25rem] bg-background/75 p-4">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{optionSet.name}</p>
                    <Badge variant="muted">{optionSet.kind}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {optionSet.values.map((value) => value.label).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Existing custom fields</CardTitle>
            <CardDescription>
              Review, update, or soft delete the field metadata currently defined for this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading custom fields...</p>
            ) : fields.length === 0 ? (
              <div className="rounded-[1.5rem] bg-background/75 p-6 text-sm leading-6 text-muted-foreground">
                No custom fields exist yet. Create one above to verify the metadata and soft-delete flow.
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => setSelectedFieldId(field.id)}
                    className={`w-full rounded-[1.25rem] p-4 text-left transition ${
                      selectedFieldId === field.id
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-background/75 hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{field.label}</p>
                      <Badge variant="muted">{field.dataType}</Badge>
                      {field.isRequired ? <Badge variant="success">Required</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {permissionModuleLabels[field.moduleKey]} · {field.entityKey} · {field.fieldKey}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit selected field</CardTitle>
            <CardDescription>
              Use this placeholder editor to verify update and soft-delete behavior on field metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedField || !editFormState ? (
              <div className="rounded-[1.5rem] bg-background/75 p-6 text-sm leading-6 text-muted-foreground">
                Select a field from the list to edit or delete it.
              </div>
            ) : (
              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Label</span>
                  <Input
                    value={editFormState.label}
                    onChange={(event) =>
                      setEditFormState((currentValue) =>
                        currentValue
                          ? {
                              ...currentValue,
                              label: event.target.value
                            }
                          : currentValue
                      )
                    }
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Placeholder</span>
                  <Input
                    value={editFormState.placeholder}
                    onChange={(event) =>
                      setEditFormState((currentValue) =>
                        currentValue
                          ? {
                              ...currentValue,
                              placeholder: event.target.value
                            }
                          : currentValue
                      )
                    }
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Option set</span>
                  <select
                    className={selectClassName}
                    value={editFormState.optionSetKey}
                    onChange={(event) =>
                      setEditFormState((currentValue) =>
                        currentValue
                          ? {
                              ...currentValue,
                              optionSetKey: event.target.value
                            }
                          : currentValue
                      )
                    }
                  >
                    <option value="">None</option>
                    {optionSets.map((optionSet) => (
                      <option key={optionSet.id} value={optionSet.setKey}>
                        {optionSet.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="edit-required"
                    type="checkbox"
                    checked={editFormState.isRequired}
                    onChange={(event) =>
                      setEditFormState((currentValue) =>
                        currentValue
                          ? {
                              ...currentValue,
                              isRequired: event.target.checked
                            }
                          : currentValue
                      )
                    }
                  />
                  <label htmlFor="edit-required" className="text-sm font-medium">
                    Required
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="edit-active"
                    type="checkbox"
                    checked={editFormState.isActive}
                    onChange={(event) =>
                      setEditFormState((currentValue) =>
                        currentValue
                          ? {
                              ...currentValue,
                              isActive: event.target.checked
                            }
                          : currentValue
                      )
                    }
                  />
                  <label htmlFor="edit-active" className="text-sm font-medium">
                    Active
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void handleSaveField()} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save field"}
                  </Button>
                  <Button variant="outline" onClick={() => void handleDeleteField()} disabled={isSaving}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Soft delete
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
