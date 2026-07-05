// Bulk import (data migration): fixed CSV formats — one per entity — so legacy
// data can be uploaded in bulk. Pure helpers here are unit-tested; the API
// composes them with the existing create flows so every validation gate,
// option-set resolution, and audit log applies to imported rows too.

export const bulkImportEntities = ["lead", "account", "contact", "opportunity"] as const;
export type BulkImportEntity = (typeof bulkImportEntities)[number];

/** Hard per-request cap so imports stay inside body limits; upload larger files in chunks. */
export const maxBulkImportRows = 1000;

export interface BulkImportColumnSpec {
  key: string;
  required: boolean;
  description: string;
  example: string;
}

/**
 * The fixed format per entity. Option columns (status/source/stage/…) accept
 * either the tenant option value key or its label (case-insensitive), so
 * exports from legacy systems don't need key mapping.
 */
export const bulkImportSpecs: Record<BulkImportEntity, BulkImportColumnSpec[]> = {
  lead: [
    { key: "first_name", required: true, description: "Lead first name", example: "Asha" },
    { key: "last_name", required: true, description: "Lead last name", example: "Verma" },
    { key: "company_name", required: true, description: "Company / organization", example: "Verma Academy" },
    { key: "email", required: false, description: "Email (used for duplicate detection)", example: "asha@verma.example" },
    { key: "phone", required: false, description: "Phone number", example: "+91 98100 00000" },
    { key: "status", required: true, description: "Lead status key or label from the lead-status option set", example: "new" },
    { key: "source", required: true, description: "Lead source key or label from the lead-source option set", example: "website" },
    { key: "score", required: false, description: "Numeric score 0-100", example: "72" },
    { key: "owner_email", required: false, description: "Owner user email (defaults to the importer)", example: "sales.executive@sample-tenant.local" }
  ],
  account: [
    { key: "name", required: true, description: "Account name (unique per tenant)", example: "Sunrise Public School" },
    { key: "website", required: false, description: "Website URL", example: "https://sunrise.example" },
    { key: "industry", required: false, description: "Industry free text", example: "Education" },
    { key: "account_type", required: false, description: "Key or label from the account-type option set", example: "customer" },
    { key: "health_status", required: false, description: "Key or label from the account-health option set", example: "green" },
    { key: "owner_email", required: false, description: "Owner user email (defaults to the importer)", example: "sales.executive@sample-tenant.local" }
  ],
  contact: [
    { key: "first_name", required: true, description: "Contact first name", example: "Rohit" },
    { key: "last_name", required: true, description: "Contact last name", example: "Sharma" },
    { key: "email", required: false, description: "Email (used for duplicate detection)", example: "rohit@sunrise.example" },
    { key: "phone", required: false, description: "Phone number", example: "+91 98200 00000" },
    { key: "account_name", required: false, description: "Existing account name to link", example: "Sunrise Public School" },
    { key: "role", required: false, description: "Key or label from the contact-role option set", example: "decision_maker" },
    { key: "linkedin_url", required: false, description: "LinkedIn profile URL", example: "https://linkedin.com/in/rohit" },
    { key: "owner_email", required: false, description: "Owner user email (defaults to the importer)", example: "sales.executive@sample-tenant.local" }
  ],
  opportunity: [
    { key: "name", required: true, description: "Opportunity name", example: "Sunrise LMS rollout" },
    { key: "account_name", required: true, description: "Existing account name to link", example: "Sunrise Public School" },
    { key: "stage", required: true, description: "Key or label from the opportunity-pipeline option set", example: "qualification" },
    { key: "source", required: true, description: "Key or label from the opportunity-source option set", example: "inbound" },
    { key: "amount", required: false, description: "Deal amount (number)", example: "450000" },
    { key: "probability", required: false, description: "Win probability 0-100", example: "40" },
    { key: "expected_close_date", required: false, description: "Expected close date YYYY-MM-DD", example: "2026-09-30" },
    { key: "next_step", required: false, description: "Next step note", example: "Schedule discovery call" },
    { key: "owner_email", required: false, description: "Owner user email (defaults to the importer)", example: "sales.executive@sample-tenant.local" }
  ]
};

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The downloadable fixed-format template: header row + one example row. */
export function buildImportTemplateCsv(entity: BulkImportEntity): string {
  const spec = bulkImportSpecs[entity];
  const header = spec.map((column) => column.key).join(",");
  const example = spec.map((column) => escapeCsvCell(column.example)).join(",");
  return `${header}\n${example}\n`;
}

/**
 * Small RFC-4180-style CSV parser (quoted cells, escaped quotes, CR/LF) —
 * dependency-free so it stays unit-testable in @crm/types.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop rows that are entirely empty (trailing newlines, blank lines).
  return rows.filter((cells) => cells.some((value) => value.trim().length > 0));
}

export interface ParsedImportRows {
  /** Problems with the header/shape; when non-empty, no rows are returned. */
  formatErrors: string[];
  /** One record per data row, keyed by the fixed column keys. */
  rows: Array<Record<string, string>>;
}

/**
 * Validate the fixed format (exact column set, any order, case-insensitive)
 * and return each data row keyed by column. Required-cell checks happen here;
 * value-level validation (option keys, lookups) happens server-side per row.
 */
export function parseImportRows(entity: BulkImportEntity, csvText: string): ParsedImportRows {
  const spec = bulkImportSpecs[entity];
  const parsed = parseCsv(csvText);

  if (parsed.length === 0) {
    return { formatErrors: ["The file is empty."], rows: [] };
  }

  const header = parsed[0].map((cell) => cell.trim().toLowerCase());
  const expected = spec.map((column) => column.key);
  // Required columns must be present; optional template columns may be omitted.
  const missing = spec.filter((column) => column.required && !header.includes(column.key)).map((column) => column.key);
  const unknown = header.filter((key) => !expected.includes(key));
  const formatErrors: string[] = [];

  if (missing.length > 0) {
    formatErrors.push(`Missing required column(s): ${missing.join(", ")}. Download the ${entity} template for the fixed format.`);
  }
  if (unknown.length > 0) {
    formatErrors.push(`Unknown column(s): ${unknown.join(", ")}. Only the fixed ${entity} template columns are accepted.`);
  }

  const dataRows = parsed.slice(1);
  if (dataRows.length === 0) {
    formatErrors.push("The file has a header but no data rows.");
  }
  if (dataRows.length > maxBulkImportRows) {
    formatErrors.push(`Too many rows (${dataRows.length}). Upload at most ${maxBulkImportRows} rows per file.`);
  }

  if (formatErrors.length > 0) {
    return { formatErrors, rows: [] };
  }

  const rows = dataRows.map((cells) => {
    const record: Record<string, string> = {};
    for (const key of expected) {
      record[key] = "";
    }
    header.forEach((key, columnIndex) => {
      record[key] = (cells[columnIndex] ?? "").trim();
    });
    return record;
  });

  return { formatErrors: [], rows };
}

// ---- API contract ------------------------------------------------------------------------------

export interface BulkImportRequestBody {
  csv: string;
  /** Validate everything without creating records. */
  dryRun?: boolean;
  /** Import rows whose email already exists instead of skipping them (leads/contacts). */
  allowDuplicates?: boolean;
}

export interface BulkImportRowError {
  /** 1-based data-row number (row 1 = first row under the header). */
  row: number;
  message: string;
}

export interface BulkImportResponse {
  entity: BulkImportEntity;
  dryRun: boolean;
  total: number;
  created: number;
  skippedDuplicates: number;
  failed: number;
  errors: BulkImportRowError[];
}

export interface BulkImportTemplateResponse {
  entity: BulkImportEntity;
  columns: BulkImportColumnSpec[];
  csv: string;
}
