import { describe, expect, it } from "vitest";
import { estimateIntegrationEffortDays, evaluateTechnicalDiscovery, summarizeDeliveryRisk } from "@crm/types";

describe("evaluateTechnicalDiscovery", () => {
  it("flags every empty field and reports completeness", () => {
    const status = evaluateTechnicalDiscovery({ systems: "SAP", apis: "REST", security: "  " });
    expect(status.totalCount).toBe(12);
    expect(status.capturedCount).toBe(2);
    expect(status.complete).toBe(false);
    expect(status.missingFields).toContain("authentication");
    expect(status.missingFields).toContain("security");
    expect(status.missingFields).not.toContain("systems");
  });

  it("is complete when all fields are captured", () => {
    const all = {
      systems: "a", integrations: "a", apis: "a", authentication: "a", dataMigration: "a", hosting: "a",
      security: "a", compliance: "a", users: "a", concurrency: "a", reporting: "a", customWorkflows: "a"
    };
    const status = evaluateTechnicalDiscovery(all);
    expect(status.complete).toBe(true);
    expect(status.missingFields).toHaveLength(0);
  });
});

describe("summarizeDeliveryRisk", () => {
  it("is high (needs leadership approval) when any dimension is high", () => {
    const summary = summarizeDeliveryRisk({ timelineRisk: "high", security: "low" });
    expect(summary.overall).toBe("high");
    expect(summary.requiresLeadershipApproval).toBe(true);
  });

  it("is high when two or more dimensions are medium", () => {
    expect(summarizeDeliveryRisk({ scopeAmbiguity: "medium", customization: "medium" }).overall).toBe("high");
  });

  it("is medium for a single medium, low when nothing is flagged", () => {
    expect(summarizeDeliveryRisk({ scopeAmbiguity: "medium" }).overall).toBe("medium");
    expect(summarizeDeliveryRisk({}).overall).toBe("low");
    expect(summarizeDeliveryRisk({}).requiresLeadershipApproval).toBe(false);
  });
});

describe("estimateIntegrationEffortDays", () => {
  it("scales with complexity", () => {
    expect(estimateIntegrationEffortDays("low")).toBe(3);
    expect(estimateIntegrationEffortDays("medium")).toBe(8);
    expect(estimateIntegrationEffortDays("high")).toBe(20);
  });
});
