import type { BackgroundJob, BackgroundJobsResponse } from "@crm/types";

interface JobMonitorConfig {
  workersEnabled: boolean;
}

// Phase 29 background-job monitoring placeholder. The platform does not yet run a
// worker runtime (Redis/queue is a placeholder), so this service publishes the
// catalog of background jobs the system is designed to run together with their
// current status. Once a worker runtime is introduced, these entries become live,
// reporting real schedules, last-run timestamps, and outcomes.
const JOB_CATALOG: Array<Omit<BackgroundJob, "status" | "lastRunAt" | "lastStatus">> = [
  {
    key: "audit_retention_purge",
    name: "Audit & log retention purge",
    description: "Deletes audit, AI, and export logs past the per-tenant retention windows.",
    schedule: "daily @ 02:00 (planned)"
  },
  {
    key: "ai_embedding_backfill",
    name: "AI embedding backfill",
    description: "Generates and refreshes vector embeddings for knowledge chunks.",
    schedule: "continuous (planned)"
  },
  {
    key: "workflow_scheduler",
    name: "Workflow scheduler",
    description: "Evaluates time-based and SLA workflow triggers (date reached, SLA breached, renewal approaching).",
    schedule: "every 5 minutes (planned)"
  },
  {
    key: "notification_dispatch",
    name: "Notification dispatcher",
    description: "Delivers queued notifications across in-app and external channels.",
    schedule: "continuous (planned)"
  },
  {
    key: "dashboard_cache_warm",
    name: "Dashboard cache warmer",
    description: "Pre-computes and caches expensive dashboard metrics in Redis.",
    schedule: "every 10 minutes (planned)"
  }
];

export class JobMonitorService {
  constructor(private readonly config: JobMonitorConfig) {}

  getJobs(): BackgroundJobsResponse {
    const jobs: BackgroundJob[] = JOB_CATALOG.map((job) => ({
      ...job,
      status: this.config.workersEnabled ? "idle" : "deferred",
      schedule: this.config.workersEnabled ? job.schedule : null,
      lastRunAt: null,
      lastStatus: null
    }));

    return {
      generatedAt: new Date().toISOString(),
      workerRuntime: {
        enabled: this.config.workersEnabled,
        backend: this.config.workersEnabled ? "redis" : "none",
        message: this.config.workersEnabled
          ? "Worker runtime is enabled."
          : "No worker runtime is running yet; background jobs are deferred until the cache/queue phase enables workers."
      },
      jobs
    };
  }
}
