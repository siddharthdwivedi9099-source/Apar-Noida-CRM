import type {
  CrmActivityType,
  CrmTaskPriority,
  CrmTaskStatus,
  CrmTimelineFilterKind,
  CrmTimelineItemKind
} from "@crm/types";

export const selectClassName =
  "flex h-11 w-full rounded-[1.25rem] border border-input bg-background px-4 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const textareaClassName =
  "flex min-h-[132px] w-full rounded-[1.25rem] border border-input bg-background px-4 py-3 text-sm shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
