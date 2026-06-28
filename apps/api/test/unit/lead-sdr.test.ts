import { describe, expect, it } from "vitest";
import {
  evaluateDiscovery,
  evaluateIcpFit,
  isDiscoveryReadyForConversion,
  type LeadDiscoveryFieldDefinition,
  type LeadIcpAttributes
} from "@crm/types";

function attributes(overrides: Partial<LeadIcpAttributes> = {}): LeadIcpAttributes {
  return {
    industry: null,
    segment: null,
    size: null,
    geography: null,
    useCase: null,
    budget: null,
    strategicValue: null,
    ...overrides
  };
}

describe("evaluateIcpFit", () => {
  it("returns low fit for an empty profile", () => {
    const result = evaluateIcpFit(attributes());
    expect(result.score).toBe(0);
    expect(result.band).toBe("low");
  });

  it("returns high fit for a fully captured, strategically valuable account", () => {
    const result = evaluateIcpFit(
      attributes({
        industry: "SaaS",
        segment: "Enterprise",
        size: "500-1000",
        geography: "IN",
        useCase: "Automation",
        budget: "$200k",
        strategicValue: "high"
      })
    );
    expect(result.score).toBe(100);
    expect(result.band).toBe("high");
    expect(result.explanation.every((entry) => entry.satisfied)).toBe(true);
  });

  it("grades strategic value (medium contributes partially)", () => {
    const high = evaluateIcpFit(attributes({ industry: "SaaS", strategicValue: "high" }));
    const medium = evaluateIcpFit(attributes({ industry: "SaaS", strategicValue: "medium" }));
    expect(high.score).toBeGreaterThan(medium.score);
  });

  it("lands mid profiles in the medium band", () => {
    const result = evaluateIcpFit(
      attributes({ industry: "SaaS", segment: "Mid", size: "200", strategicValue: "low" })
    );
    expect(result.band).toBe("medium");
  });
});

const discoveryFields: LeadDiscoveryFieldDefinition[] = [
  { key: "pain", label: "Pain", description: null, required: true, sortOrder: 0 },
  { key: "budget", label: "Budget", description: null, required: true, sortOrder: 1 },
  { key: "risks", label: "Risks", description: null, required: false, sortOrder: 2 }
];

describe("evaluateDiscovery", () => {
  it("counts completed + required completeness", () => {
    const result = evaluateDiscovery(discoveryFields, { pain: "Manual process", risks: "Budget freeze" });
    expect(result.total).toBe(3);
    expect(result.completionCount).toBe(2);
    expect(result.requiredCount).toBe(2);
    expect(result.requiredComplete).toBe(false);
  });

  it("treats whitespace-only answers as incomplete", () => {
    const result = evaluateDiscovery(discoveryFields, { pain: "   ", budget: "$50k" });
    expect(result.items.find((item) => item.key === "pain")?.completed).toBe(false);
    expect(result.requiredComplete).toBe(false);
  });

  it("is conversion-ready once required fields are captured", () => {
    expect(isDiscoveryReadyForConversion(discoveryFields, { pain: "Manual", budget: "$50k" })).toBe(true);
  });

  it("does not block conversion when no discovery fields are configured", () => {
    expect(isDiscoveryReadyForConversion([], {})).toBe(true);
  });
});
