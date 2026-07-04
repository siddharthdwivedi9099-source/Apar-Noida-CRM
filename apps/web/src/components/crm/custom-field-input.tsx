import type { CrmFieldDefinition, CrmOptionValueSummary } from "@crm/types";
import { Input } from "@/components/ui/input";
import { selectClassName, textareaClassName } from "@/lib/crm";
import {
  getCustomFieldOptions,
  type CrmCustomFieldFormValue,
  type CrmCustomFieldOptionsCarrier
} from "@/lib/crm-custom-fields";

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

/**
 * Renders a single tenant-defined custom field as a labelled form control.
 *
 * Entity-agnostic: it consumes the shared `fieldDefinitions` + custom-field-options
 * contract returned by every CRM options endpoint, so any entity form can render its
 * active custom fields without bespoke markup.
 */
export function CustomFieldInput({
  field,
  value,
  options,
  onChange
}: {
  field: CrmFieldDefinition;
  value: CrmCustomFieldFormValue;
  options: CrmCustomFieldOptionsCarrier | null;
  onChange: (value: CrmCustomFieldFormValue) => void;
}) {
  const fieldOptions = getCustomFieldOptions(options, field);
  const labelClassName =
    field.dataType === "textarea" || field.dataType === "multiselect" ? "space-y-2 md:col-span-2" : "space-y-2";
  const placeholder = field.placeholder ?? "";

  if (field.dataType === "textarea") {
    return (
      <label className={labelClassName}>
        <span className="text-sm font-medium">{field.label}</span>
        <textarea
          className={textareaClassName}
          rows={4}
          required={field.isRequired}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder || undefined}
        />
        {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
      </label>
    );
  }

  if (field.dataType === "select") {
    return (
      <label className={labelClassName}>
        <span className="text-sm font-medium">{field.label}</span>
        <select
          className={selectClassName}
          required={field.isRequired}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
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
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={labelClassName}>
        <span className="text-sm font-medium">{field.label}</span>
        <MultiSelect
          options={fieldOptions}
          selected={selected}
          onToggle={(optionKey) => onChange(toggleValue(selected, optionKey))}
        />
        {field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null}
      </div>
    );
  }

  if (field.dataType === "boolean") {
    return (
      <label className={labelClassName}>
        <span className="text-sm font-medium">{field.label}</span>
        <select
          className={selectClassName}
          required={field.isRequired}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
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
    <label className={labelClassName}>
      <span className="text-sm font-medium">{field.label}</span>
      <Input
        type={inputType}
        required={field.isRequired}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || undefined}
      />
      {field.description ? <span className="text-xs text-muted-foreground">{field.description}</span> : null}
    </label>
  );
}
