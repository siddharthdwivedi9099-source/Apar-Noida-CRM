// ============================================================================
// Phase 29: Observability, Logging and Performance Readiness
// ============================================================================

// Readiness reports whether the service can serve traffic right now (its
// dependencies are reachable), as opposed to liveness (the process is up).
export interface ReadinessCheck {
  name: string;
  status: "pass" | "fail";
  detail: string;
}

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  service: string;
  timestamp: string;
  checks: ReadinessCheck[];
}

// Lightweight runtime metrics. This is a placeholder for a full Prometheus /
// OpenTelemetry exporter; it exposes process and cache counters as JSON today.
export interface RuntimeMetricsResponse {
  service: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  process: {
    pid: number;
    nodeVersion: string;
    memoryRssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    cpuUserMs: number;
    cpuSystemMs: number;
  };
  cache: CacheStatus;
  note: string;
}

export interface CacheStatus {
  enabled: boolean;
  backend: string;
  ttlSeconds: number;
  hits: number;
  misses: number;
  hitRate: number;
  message: string;
}

export const backgroundJobStatuses = ["deferred", "scheduled", "idle", "running", "failed"] as const;
export type BackgroundJobStatus = (typeof backgroundJobStatuses)[number];

export interface BackgroundJob {
  key: string;
  name: string;
  description: string;
  status: BackgroundJobStatus;
  schedule: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
}

export interface BackgroundJobsResponse {
  generatedAt: string;
  workerRuntime: {
    enabled: boolean;
    backend: string;
    message: string;
  };
  jobs: BackgroundJob[];
}
