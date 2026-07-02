// Persona 31 (Data Quality Manager) pure resolvers + API contract.
// Data quality dashboard (DQM-001), import validation (DQM-002), enrichment queue (DQM-003), and
// merge workflow (DQM-004). Deterministic helpers are unit-tested; AI cleanup-priority and
// enrichment-value suggestions stay governed placeholders.

// ---- Validation primitives ---------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{6,19}$/;

export function isValidEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

export function isValidPhone(phone: string | null | undefined): boolean {
  if (typeof phone !== "string") {
    return false;
  }
  const digits = phone.replace(/[^0-9]/g, "");
  return PHONE_RE.test(phone.trim()) && digits.length >= 7 && digits.length <= 15;
}

/** DQM-001: field completeness for a record against a required-field list. */
export function computeCompleteness(record: Record<string, unknown>, requiredFields: string[]): { filled: number; total: number; pct: number; missing: string[] } {
  const missing = requiredFields.filter((field) => {
    const value = record[field];
    return value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);
  });
  const total = requiredFields.length;
  const filled = total - missing.length;
  return { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 100, missing };
}

/** DQM-001: a record is stale when its last activity is older than the threshold. */
export function isStale(lastActivityIso: string | null | undefined, nowMs: number, staleDays: number): boolean {
  if (!lastActivityIso) {
    return true;
  }
  const ms = Date.parse(lastActivityIso);
  if (Number.isNaN(ms)) {
    return true;
  }
  return nowMs - ms > staleDays * 86_400_000;
}

// ---- DQM-002: import validation ----------------------------------------------------------------

export const importErrorCodes = ["missing_mandatory", "invalid_email", "invalid_phone", "invalid_value", "duplicate_in_batch", "consent_missing"] as const;
export type ImportErrorCode = (typeof importErrorCodes)[number];

export interface ImportRowError {
  field: string | null;
  code: ImportErrorCode;
  message: string;
}

export interface ImportRowResult {
  rowIndex: number;
  valid: boolean;
  errors: ImportRowError[];
}

export interface ImportValidationOptions {
  mandatoryFields: string[];
  requireConsent?: boolean;
  allowedValues?: Record<string, string[]>;
}

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ImportRowResult[];
}

/** DQM-002: validate import rows for mandatory fields, format, allowed values, consent, and duplicates. */
export function validateImportRows(rows: Array<Record<string, unknown>>, options: ImportValidationOptions): ImportValidationSummary {
  const seenEmails = new Map<string, number>();
  const results: ImportRowResult[] = rows.map((row, rowIndex) => {
    const errors: ImportRowError[] = [];
    for (const field of options.mandatoryFields) {
      const value = row[field];
      if (value === null || value === undefined || (typeof value === "string" && value.trim().length === 0)) {
        errors.push({ field, code: "missing_mandatory", message: `${field} is required.` });
      }
    }
    const email = typeof row.email === "string" ? row.email.trim() : null;
    if (email && !isValidEmail(email)) {
      errors.push({ field: "email", code: "invalid_email", message: `"${email}" is not a valid email.` });
    }
    if (typeof row.phone === "string" && row.phone.trim() && !isValidPhone(row.phone)) {
      errors.push({ field: "phone", code: "invalid_phone", message: `"${row.phone}" is not a valid phone number.` });
    }
    for (const [field, allowed] of Object.entries(options.allowedValues ?? {})) {
      const value = row[field];
      if (typeof value === "string" && value.trim() && !allowed.includes(value.trim())) {
        errors.push({ field, code: "invalid_value", message: `"${value}" is not an allowed value for ${field}.` });
      }
    }
    if (options.requireConsent) {
      const consent = typeof row.consent === "string" ? row.consent.trim().toLowerCase() : "";
      if (consent !== "granted" && consent !== "true" && consent !== "yes") {
        errors.push({ field: "consent", code: "consent_missing", message: "Consent is missing or not granted." });
      }
    }
    if (email) {
      const key = email.toLowerCase();
      const firstSeen = seenEmails.get(key);
      if (firstSeen !== undefined) {
        errors.push({ field: "email", code: "duplicate_in_batch", message: `Duplicate email of row ${firstSeen + 1}.` });
      } else {
        seenEmails.set(key, rowIndex);
      }
    }
    return { rowIndex, valid: errors.length === 0, errors };
  });
  const validRows = results.filter((row) => row.valid).length;
  return { totalRows: rows.length, validRows, errorRows: rows.length - validRows, rows: results };
}

// ---- DQM-004: field-level merge ----------------------------------------------------------------

export const mergeableLeadFields = ["firstName", "lastName", "companyName", "email", "phone", "ownerId", "sourceKey"] as const;
export type MergeableLeadField = (typeof mergeableLeadFields)[number];

/**
 * DQM-004: build the merged record. For each field, "duplicate" takes the duplicate's value, else
 * the master's value is kept. Empty selections default to the master.
 */
export function resolveMergedRecord<T extends Record<string, unknown>>(master: T, duplicate: T, selections: Record<string, "master" | "duplicate">): T {
  const merged: Record<string, unknown> = { ...master };
  for (const [field, choice] of Object.entries(selections)) {
    if (choice === "duplicate" && field in duplicate) {
      merged[field] = duplicate[field];
    }
  }
  return merged as T;
}

// ---- DQM-003: enrichment -----------------------------------------------------------------------

export const enrichmentStatuses = ["pending", "accepted", "rejected", "edited"] as const;
export type EnrichmentStatus = (typeof enrichmentStatuses)[number];

// ---- API contract ------------------------------------------------------------------------------

export interface DqSignal {
  key: string;
  label: string;
  count: number;
  sampleIds: string[];
}

export interface DataQualityDashboardResponse {
  entity: "lead";
  totalRecords: number;
  completenessPct: number;
  signals: DqSignal[];
  cleanupPriorities: string[];
  aiPlaceholder: { available: false; message: string };
}

export interface DqEnrichmentEntry {
  id: string;
  entityType: "lead" | "contact" | "account";
  entityId: string;
  missingFields: string[];
  suggestions: Record<string, string>;
  status: EnrichmentStatus;
  source: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface DqEnrichmentQueueResponse {
  entries: DqEnrichmentEntry[];
}

export interface DqMergeLogEntry {
  id: string;
  entityType: "lead" | "contact" | "account";
  masterId: string;
  duplicateId: string;
  reason: string;
  createdAt: string;
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface ValidateImportRequestBody {
  entityType?: "lead";
  rows: Array<Record<string, unknown>>;
  requireConsent?: boolean;
}

export interface CommitImportRequestBody {
  rows: Array<Record<string, unknown>>;
  requireConsent?: boolean;
}

export interface ResolveEnrichmentRequestBody {
  decision: "accept" | "reject" | "edit";
  values?: Record<string, string>;
}

export interface MergeRecordsRequestBody {
  entityType?: "lead";
  masterId: string;
  duplicateId: string;
  fieldSelections?: Record<string, "master" | "duplicate">;
  reason: string;
}
