import type {
  CrmActivityType,
  CrmTaskPriority,
  CrmTaskStatus,
  CrmTimelineFilterKind,
  CrmTimelineItemKind
} from "@crm/types";

export const selectClassName =
  "flex h-11 w-full cursor-pointer appearance-none rounded-[1.25rem] border border-input bg-background bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat px-4 py-2 pr-10 text-sm shadow-sm transition-all duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const textareaClassName =
  "flex min-h-[132px] w-full rounded-[1.25rem] border border-input bg-background px-4 py-3 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const pageSizeOptions = [12, 24, 48] as const;

export function buildQueryString<T extends object>(input: T) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatShortDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function formatDateOnly(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const normalizedValue = value.includes("T") ? value : `${value}T12:00:00`;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(normalizedValue));
}

export function formatCurrencyAmount(value: number | null, currency = "USD") {
  if (value === null) {
    return "Not set";
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function getCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function toTitleCaseLabel(value: string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatDateTimeInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetInMinutes = date.getTimezoneOffset();
  const normalizedDate = new Date(date.getTime() - offsetInMinutes * 60_000);
  return normalizedDate.toISOString().slice(0, 16);
}

export function getCrmActivityTypeLabel(value: CrmActivityType) {
  return toTitleCaseLabel(value);
}

export function getCrmTaskPriorityLabel(value: CrmTaskPriority) {
  return toTitleCaseLabel(value);
}

export function getCrmTaskStatusLabel(value: CrmTaskStatus) {
  return toTitleCaseLabel(value);
}

export function getCrmTimelineKindLabel(value: CrmTimelineFilterKind | CrmTimelineItemKind) {
  return value === "all" ? "All touchpoints" : toTitleCaseLabel(value);
}
