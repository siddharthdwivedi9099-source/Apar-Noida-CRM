import { describe, expect, it } from "vitest";
import {
  canDeploy,
  computeBackupStatus,
  computeIntegrationHealth,
  environmentKinds,
  requiresDeploymentApproval,
  type BackupRunFact,
  type SyncRunFact
} from "@crm/types";

describe("computeIntegrationHealth", () => {
  const at = (min: number): number => 1_000_000 + min * 60_000;

  it("aggregates failures, retries, latency and last sync", () => {
    const runs: SyncRunFact[] = [
      { status: "success", latencyMs: 100, startedAtMs: at(0), isRetry: false, resolved: false },
      { status: "failed", latencyMs: 300, startedAtMs: at(5), isRetry: false, resolved: false },
      { status: "success", latencyMs: 200, startedAtMs: at(10), isRetry: true, resolved: false }
    ];
    const h = computeIntegrationHealth(runs);
    expect(h.totalRuns).toBe(3);
    expect(h.failures).toBe(1);
    expect(h.unresolvedFailures).toBe(1);
    expect(h.retries).toBe(1);
    expect(h.avgLatencyMs).toBe(200);
    expect(h.lastSyncAtMs).toBe(at(10));
    expect(h.health).toBe("degraded");
  });

  it("is healthy when all failures are resolved", () => {
    const h = computeIntegrationHealth([
      { status: "success", latencyMs: 100, startedAtMs: at(0), isRetry: false, resolved: false },
      { status: "failed", latencyMs: null, startedAtMs: at(1), isRetry: false, resolved: true }
    ]);
    expect(h.unresolvedFailures).toBe(0);
    expect(h.health).toBe("healthy");
  });

  it("is down when unresolved failures dominate", () => {
    const h = computeIntegrationHealth([
      { status: "failed", latencyMs: null, startedAtMs: at(0), isRetry: false, resolved: false },
      { status: "failed", latencyMs: null, startedAtMs: at(1), isRetry: false, resolved: false }
    ]);
    expect(h.health).toBe("down");
    expect(h.successRate).toBe(0);
  });

  it("empty is healthy 100%", () => {
    const h = computeIntegrationHealth([]);
    expect(h.successRate).toBe(100);
    expect(h.health).toBe("healthy");
    expect(h.lastSyncAtMs).toBeNull();
  });
});

describe("requiresDeploymentApproval / canDeploy", () => {
  it("production requires approval; lower environments do not", () => {
    expect(requiresDeploymentApproval("production", false)).toBe(true);
    expect(requiresDeploymentApproval("dev", true)).toBe(true); // explicit production flag
    expect(requiresDeploymentApproval("staging", false)).toBe(false);
    expect(environmentKinds).toContain("staging");
  });

  it("prod can only deploy from approved; non-prod from pending", () => {
    expect(canDeploy("approved", true)).toBe(true);
    expect(canDeploy("pending_approval", true)).toBe(false);
    expect(canDeploy("pending", false)).toBe(true);
  });
});

describe("computeBackupStatus", () => {
  const now = 10_000_000;
  const minsAgo = (m: number): number => now - m * 60_000;

  it("flags RPO breach when last successful backup is too old", () => {
    const runs: BackupRunFact[] = [
      { runType: "backup", status: "success", startedAtMs: minsAgo(2000), finishedAtMs: minsAgo(1999) },
      { runType: "restore_test", status: "success", startedAtMs: minsAgo(100), finishedAtMs: minsAgo(99) }
    ];
    const s = computeBackupStatus(runs, { rpoMinutes: 1440, rtoMinutes: 240 }, now);
    expect(s.rpoBreached).toBe(true);
    expect(s.lastBackupAtMs).toBe(minsAgo(2000));
    expect(s.lastRestoreTestAtMs).toBe(minsAgo(100));
  });

  it("is within RPO when a recent backup succeeded", () => {
    const s = computeBackupStatus([{ runType: "backup", status: "success", startedAtMs: minsAgo(60), finishedAtMs: minsAgo(59) }], { rpoMinutes: 1440, rtoMinutes: 240 }, now);
    expect(s.rpoBreached).toBe(false);
    expect(s.failureCount).toBe(0);
  });

  it("counts failures and breaches RPO with no successful backup", () => {
    const s = computeBackupStatus([{ runType: "backup", status: "failed", startedAtMs: minsAgo(10), finishedAtMs: minsAgo(9) }], { rpoMinutes: 1440, rtoMinutes: 240 }, now);
    expect(s.failureCount).toBe(1);
    expect(s.lastBackupAtMs).toBeNull();
    expect(s.rpoBreached).toBe(true);
  });
});
