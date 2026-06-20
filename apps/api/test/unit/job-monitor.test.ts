import { describe, expect, it } from "vitest";
import { JobMonitorService } from "../../src/platform/jobs/job-monitor.service";

describe("Background job monitor (placeholder)", () => {
  it("reports all jobs as deferred when no worker runtime is enabled", () => {
    const response = new JobMonitorService({ workersEnabled: false }).getJobs();
    expect(response.workerRuntime.enabled).toBe(false);
    expect(response.jobs.length).toBeGreaterThanOrEqual(5);
    for (const job of response.jobs) {
      expect(job.status).toBe("deferred");
      expect(job.schedule).toBeNull();
      expect(job.lastRunAt).toBeNull();
    }
  });

  it("publishes a unique catalog of background jobs", () => {
    const response = new JobMonitorService({ workersEnabled: false }).getJobs();
    const keys = response.jobs.map((job) => job.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(["audit_retention_purge", "workflow_scheduler", "dashboard_cache_warm"]));
  });

  it("marks jobs idle and schedules them once a worker runtime is enabled", () => {
    const response = new JobMonitorService({ workersEnabled: true }).getJobs();
    expect(response.workerRuntime.enabled).toBe(true);
    for (const job of response.jobs) {
      expect(job.status).toBe("idle");
      expect(job.schedule).toBeTruthy();
    }
  });
});
