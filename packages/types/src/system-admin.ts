// Persona 29 (System Administrator) pure resolvers + API contract.
// Integration monitoring (SYS-001), environment management (SYS-003), and backup/recovery
// (SYS-004). Audit logging (SYS-002) is served by the existing audit module. Deterministic
// helpers are unit-tested.

// ---- SYS-001: integration monitoring -----------------------------------------------------------

export const integrationConnectionStatuses = ["active", "paused", "error"] as const;
export type IntegrationConnectionStatus = (typeof integrationConnectionStatuses)[number];

export const integrationSyncStatuses = ["running", "success", "failed"] as const;
export type IntegrationSyncStatus = (typeof integrationSyncStatuses)[number];

export const integrationDirections = ["inbound", "outbound"] as const;
export type IntegrationDirection = (typeof integrationDirections)[number];

export interface SyncRunFact {
  status: IntegrationSyncStatus;
  latencyMs: number | null;
  startedAtMs: number;
  isRetry: boolean;
  resolved: boolean;
}

export interface IntegrationHealth {
  totalRuns: number;
  failures: number;
  unresolvedFailures: number;
  retries: number;
  successRate: number;
  avgLatencyMs: number | null;
  lastSyncAtMs: number | null;
  health: "healthy" | "degraded" | "down";
}

/** SYS-001: aggregate a connection's recent sync runs into a health summary. */
export function computeIntegrationHealth(runs: SyncRunFact[]): IntegrationHealth {
  const totalRuns = runs.length;
  const failures = runs.filter((run) => run.status === "failed").length;
  const unresolvedFailures = runs.filter((run) => run.status === "failed" && !run.resolved).length;
  const retries = runs.filter((run) => run.isRetry).length;
  const completed = runs.filter((run) => run.status === "success" || run.status === "failed").length;
  const successRate = completed > 0 ? Math.round(((completed - failures) / completed) * 100) : 100;
  const latencies = runs.map((run) => run.latencyMs).filter((value): value is number => typeof value === "number");
  const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null;
  const lastSyncAtMs = runs.length > 0 ? Math.max(...runs.map((run) => run.startedAtMs)) : null;
  const health: IntegrationHealth["health"] = unresolvedFailures === 0 ? "healthy" : successRate >= 50 ? "degraded" : "down";
  return { totalRuns, failures, unresolvedFailures, retries, successRate, avgLatencyMs, lastSyncAtMs, health };
}

// ---- SYS-003: environment management -----------------------------------------------------------

export const environmentKinds = ["dev", "test", "staging", "production"] as const;
export type EnvironmentKind = (typeof environmentKinds)[number];

export const deploymentStatuses = ["pending", "pending_approval", "approved", "deployed", "rolled_back", "rejected"] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

/** SYS-003: production (or explicitly production-flagged) environments require deployment approval. */
export function requiresDeploymentApproval(kind: EnvironmentKind, isProduction: boolean): boolean {
  return isProduction || kind === "production";
}

/** SYS-003: a deployment can only be marked deployed once approvals (where required) are satisfied. */
export function canDeploy(status: DeploymentStatus, requiresApproval: boolean): boolean {
  if (requiresApproval) {
    return status === "approved";
  }
  return status === "pending" || status === "approved";
}

// ---- SYS-004: backup & recovery ----------------------------------------------------------------

export const backupRunTypes = ["backup", "restore_test"] as const;
export type BackupRunType = (typeof backupRunTypes)[number];

export const backupRunStatuses = ["running", "success", "failed"] as const;
export type BackupRunStatus = (typeof backupRunStatuses)[number];

export interface BackupRunFact {
  runType: BackupRunType;
  status: BackupRunStatus;
  startedAtMs: number;
  finishedAtMs: number | null;
}

export interface BackupStatus {
  lastBackupAtMs: number | null;
  lastRestoreTestAtMs: number | null;
  lastBackupStatus: BackupRunStatus | null;
  failureCount: number;
  rpoMinutes: number;
  rtoMinutes: number;
  rpoBreached: boolean;
}

/** SYS-004: derive backup posture — last successful backup age vs. RPO, restore tests, failures. */
export function computeBackupStatus(
  runs: BackupRunFact[],
  policy: { rpoMinutes: number; rtoMinutes: number },
  nowMs: number
): BackupStatus {
  const backups = runs.filter((run) => run.runType === "backup").sort((a, b) => b.startedAtMs - a.startedAtMs);
  const restoreTests = runs.filter((run) => run.runType === "restore_test").sort((a, b) => b.startedAtMs - a.startedAtMs);
  const lastSuccessfulBackup = backups.find((run) => run.status === "success") ?? null;
  const lastBackupAtMs = lastSuccessfulBackup ? lastSuccessfulBackup.startedAtMs : null;
  const rpoWindowMs = policy.rpoMinutes * 60_000;
  const rpoBreached = lastBackupAtMs === null || nowMs - lastBackupAtMs > rpoWindowMs;
  return {
    lastBackupAtMs,
    lastRestoreTestAtMs: restoreTests[0]?.startedAtMs ?? null,
    lastBackupStatus: backups[0]?.status ?? null,
    failureCount: runs.filter((run) => run.status === "failed").length,
    rpoMinutes: policy.rpoMinutes,
    rtoMinutes: policy.rtoMinutes,
    rpoBreached
  };
}

// ---- API contract ------------------------------------------------------------------------------

export interface IntegrationConnectionSummary {
  id: string;
  name: string;
  provider: string;
  status: IntegrationConnectionStatus;
  health: IntegrationHealth;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncRunSummary {
  id: string;
  connectionId: string;
  direction: IntegrationDirection;
  status: IntegrationSyncStatus;
  recordsProcessed: number;
  latencyMs: number | null;
  errorMessage: string | null;
  isRetry: boolean;
  resolved: boolean;
  startedAt: string;
  finishedAt: string | null;
}

export interface IntegrationMonitoringResponse {
  connections: IntegrationConnectionSummary[];
}

export interface IntegrationRunsResponse {
  runs: IntegrationSyncRunSummary[];
}

export interface EnvironmentSummary {
  id: string;
  label: string;
  kind: EnvironmentKind;
  isProduction: boolean;
  notes: string | null;
  active: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentDeploymentSummary {
  id: string;
  environmentId: string;
  configurationVersionId: string | null;
  status: DeploymentStatus;
  rollbackPlan: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  deployedAt: string | null;
  createdAt: string;
}

export interface EnvironmentsResponse {
  environments: EnvironmentSummary[];
}

export interface EnvironmentDeploymentsResponse {
  deployments: EnvironmentDeploymentSummary[];
}

export interface BackupPolicySummary {
  id: string;
  name: string;
  scheduleCron: string;
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays: number;
  enabled: boolean;
  updatedAt: string;
}

export interface BackupRunSummary {
  id: string;
  runType: BackupRunType;
  status: BackupRunStatus;
  sizeBytes: number | null;
  errorMessage: string | null;
  notes: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface BackupStatusResponse {
  policy: BackupPolicySummary | null;
  status: BackupStatus;
  runs: BackupRunSummary[];
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface CreateIntegrationConnectionRequestBody {
  name: string;
  provider: string;
  status?: IntegrationConnectionStatus;
  config?: Record<string, unknown>;
}

export interface RecordSyncRunRequestBody {
  direction?: IntegrationDirection;
  status: IntegrationSyncStatus;
  recordsProcessed?: number;
  latencyMs?: number | null;
  errorMessage?: string | null;
}

export interface CreateEnvironmentRequestBody {
  label: string;
  kind: EnvironmentKind;
  isProduction?: boolean;
  notes?: string | null;
}

export interface CreateDeploymentRequestBody {
  configurationVersionId?: string | null;
  rollbackPlan?: string | null;
  notes?: string | null;
}

export interface DeploymentDecisionRequestBody {
  decision: "approve" | "reject" | "deploy" | "rollback";
  rollbackPlan?: string | null;
}

export interface UpsertBackupPolicyRequestBody {
  name?: string;
  scheduleCron: string;
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays?: number;
  enabled?: boolean;
}

export interface RecordBackupRunRequestBody {
  runType: BackupRunType;
  status: BackupRunStatus;
  sizeBytes?: number | null;
  errorMessage?: string | null;
  notes?: string | null;
}
