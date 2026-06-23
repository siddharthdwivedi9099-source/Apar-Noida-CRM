import type { CrmPagination } from "@crm/types";

// Shared pagination helpers used by module services for list endpoints.
// Centralized in the Phase 33 review to remove duplicated copies across services.

// Clamp a requested page/pageSize-style value into a sane range, falling back
// when the value is missing or below 1 and capping at the supplied maximum.
export function getPositiveNumber(value: number | undefined, fallback: number, maximum: number): number {
  if (!value || value < 1) {
    return fallback;
  }

  return Math.min(value, maximum);
}

// Build a standard CrmPagination envelope from the resolved page/size/total.
// An empty result set reports zero total pages.
export function buildPagination(page: number, pageSize: number, total: number): CrmPagination {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}
