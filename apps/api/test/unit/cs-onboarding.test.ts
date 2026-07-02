import { describe, expect, it } from "vitest";
import {
  computeGoLiveReadiness,
  generateKickoffAgenda,
  goLiveChecklistItems,
  mandatoryHandoverFields,
  onboardingImplementationTypes,
  resolveOnboardingTemplate,
  validateHandover
} from "@crm/types";

describe("validateHandover", () => {
  it("flags every empty field and gates on the mandatory ones", () => {
    const result = validateHandover({ contract: "MSA-123" });
    expect(result.complete).toBe(false);
    expect(result.missingFields).toContain("scope");
    expect(result.missingMandatory).not.toContain("contract");
    expect(result.missingMandatory).toContain("successCriteria");
  });

  it("is complete once all mandatory fields have text", () => {
    const full: Record<string, string> = {};
    for (const field of mandatoryHandoverFields) {
      full[field] = "provided";
    }
    const result = validateHandover(full);
    expect(result.complete).toBe(true);
    expect(result.missingMandatory).toEqual([]);
    // Optional fields still surface as missing but do not block.
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  it("treats whitespace-only as missing", () => {
    expect(validateHandover({ contract: "   " }).missingMandatory).toContain("contract");
  });
});

describe("resolveOnboardingTemplate", () => {
  it("returns the standard milestone set by default", () => {
    const t = resolveOnboardingTemplate(null);
    expect(t.implementationType).toBe("standard");
    expect(t.milestones).toContain("Kickoff");
    expect(t.milestones).toContain("Go-live");
  });

  it("adds enterprise milestones for enterprise type or segment", () => {
    expect(resolveOnboardingTemplate("enterprise").milestones).toContain("UAT / testing");
    expect(resolveOnboardingTemplate("standard", "Enterprise").milestones).toContain("Executive sign-off");
  });

  it("collapses steps for quick_start and exposes the type vocabulary", () => {
    expect(resolveOnboardingTemplate("quick_start").milestones).toContain("Setup & configuration");
    expect(onboardingImplementationTypes).toContain("quick_start");
  });

  it("adds integration build for integration-heavy products, without duplicates", () => {
    const t = resolveOnboardingTemplate("standard", null, "Platform API integration");
    expect(t.milestones.filter((m) => m === "Integration build")).toHaveLength(1);
  });
});

describe("computeGoLiveReadiness", () => {
  it("scores completion and gates on critical items", () => {
    const r = computeGoLiveReadiness({ configuration: "done", training: "done" });
    expect(r.total).toBe(goLiveChecklistItems.length);
    expect(r.completed).toBe(2);
    expect(r.canComplete).toBe(false);
    expect(r.criticalPending).toContain("data_migration");
  });

  it("passes when every critical item is done or n/a", () => {
    const statuses = { data_migration: "done", access: "na", testing: "done", sign_off: "done" } as const;
    const r = computeGoLiveReadiness(statuses);
    expect(r.canComplete).toBe(true);
    expect(r.criticalPending).toEqual([]);
  });

  it("empty checklist is 0% and blocked", () => {
    const r = computeGoLiveReadiness({});
    expect(r.score).toBe(0);
    expect(r.canComplete).toBe(false);
  });
});

describe("generateKickoffAgenda", () => {
  it("produces a non-empty agenda naming the customer", () => {
    const agenda = generateKickoffAgenda("Acme Corp");
    expect(agenda.length).toBeGreaterThan(3);
    expect(agenda.some((line) => line.includes("Acme Corp"))).toBe(true);
  });
});
