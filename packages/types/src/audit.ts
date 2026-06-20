// ============================================================================
// Phase 27: Audit Logs, Security Hardening and Data Governance
// ============================================================================

export const auditLogStatuses = ["success", "failure", "denied", "error"] as const;
export type AuditLogStatus = (typeof auditLogStatuses)[number];

export interface AuditLogEntry {
  id: string;
  eventType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  status: AuditLogStatus;
  actorUserId: string | null;
  actorName: string | null;
  ipAddress: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogListQuery {
  eventType?: string;
  action?: string;
  actorUserId?: string;
  resourceType?: string;
  status?: string;
  category?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Named log categories required by the governance program, each mapped to an
// audit-log filter. These cover the comprehensive audit surface.
export const auditLogCategoryKeys = [
  "user_activity",
  "authentication",
  "data_access",
  "role_change",
  "permission_change",
  "ai_usage",
  "exports",
  "failed_access",
  "sensitive_action"
] as const;
export type AuditLogCategoryKey = (typeof auditLogCategoryKeys)[number];

export interface AuditLogCategory {
  key: AuditLogCategoryKey;
  label: string;
  description: string;
  count: number;
}

export interface AuditSummaryResponse {
  totalEvents: number;
  windowDays: number;
  eventTypeDistribution: Array<{ eventType: string; count: number }>;
  statusDistribution: Array<{ status: AuditLogStatus; count: number }>;
  failedAccessCount: number;
  sensitiveActionCount: number;
  categories: AuditLogCategory[];
}

export interface AuditExportResponse {
  exportedAt: string;
  count: number;
  filter: AuditLogListQuery;
  rows: AuditLogEntry[];
}

// ----------------------------------------------------------------------------
// Data governance settings (retention + upload validation placeholders)
// ----------------------------------------------------------------------------

export interface DataGovernanceSettings {
  auditLogRetentionDays: number;
  aiLogRetentionDays: number;
  exportLogRetentionDays: number;
  piiRedactionEnabled: boolean;
  failedAccessLoggingEnabled: boolean;
  fileUploadMaxMb: number;
  allowedFileTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DataGovernanceSettingsResponse {
  settings: DataGovernanceSettings;
}

export interface UpdateDataGovernanceSettingsRequestBody {
  auditLogRetentionDays?: number;
  aiLogRetentionDays?: number;
  exportLogRetentionDays?: number;
  piiRedactionEnabled?: boolean;
  failedAccessLoggingEnabled?: boolean;
  fileUploadMaxMb?: number;
  allowedFileTypes?: string[];
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Security review checklist (surfaced to admins)
// ----------------------------------------------------------------------------

export interface SecurityReviewItem {
  area: string;
  control: string;
  status: "enforced" | "configured" | "deferred";
}

export const securityReviewChecklist: SecurityReviewItem[] = [
  { area: "Auth flows", control: "JWT access tokens, rotating refresh sessions, failed-login lockout, login rate limiting.", status: "enforced" },
  { area: "RBAC enforcement", control: "Per-route permission middleware; per-action checks in services.", status: "enforced" },
  { area: "Tenant isolation", control: "Every query is tenant-scoped; cross-tenant access returns not-found.", status: "enforced" },
  { area: "AI permission checks", control: "AI Gateway, prompt/agent registries, and module AI actions check permissions and log usage.", status: "enforced" },
  { area: "Customer portal access", control: "Portal profile gate, account-scoped data, customer-visible knowledge only.", status: "enforced" },
  { area: "API authorization", control: "Authentication + authorization middleware on all protected routes.", status: "enforced" },
  { area: "Error messages", control: "Structured AppError responses; no stack traces or internal details leaked.", status: "enforced" },
  { area: "Rate limiting", control: "Global per-client API rate limiter plus strict limits on sensitive endpoints.", status: "enforced" },
  { area: "Secure headers", control: "Helmet security headers and x-powered-by disabled.", status: "enforced" },
  { area: "CORS", control: "Credentialed origin allowlist from configuration.", status: "configured" },
  { area: "Failed access logging", control: "Permission denials are written to the audit log.", status: "enforced" },
  { area: "Data retention", control: "Per-tenant retention windows configured; automated purge deferred.", status: "deferred" },
  { area: "File upload validation", control: "Max size and allowed types configured; upload pipeline deferred.", status: "deferred" }
];

export interface SecurityReviewResponse {
  checklist: SecurityReviewItem[];
}
