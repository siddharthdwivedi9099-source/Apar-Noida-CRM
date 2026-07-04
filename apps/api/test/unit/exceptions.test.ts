import { describe, expect, it } from "vitest";
import {
  aggregateStakeholderEngagement,
  checkStageRegression,
  computeMarginRisk,
  detectDuplicateCampaignLead,
  emailDomain,
  matchExistingCustomer
} from "@crm/types";

describe("detectDuplicateCampaignLead (EXC-001)", () => {
  const candidate = { id: "c1", email: "jane@acme.com", firstName: "Jane", lastName: "Doe", companyName: "Acme" };
  it("matches by email and by name+company", () => {
    const matches = detectDuplicateCampaignLead(candidate, [
      { id: "e1", email: "JANE@acme.com", firstName: "J", lastName: "D", companyName: "X" },
      { id: "e2", email: "other@x.com", firstName: "Jane", lastName: "Doe", companyName: "Acme" },
      { id: "e3", email: "nomatch@x.com", firstName: "Bob", lastName: "Roe", companyName: "Beta" }
    ]);
    expect(matches.find((m) => m.id === "e1")?.reason).toBe("email");
    expect(matches.find((m) => m.id === "e2")?.reason).toBe("name_company");
    expect(matches.find((m) => m.id === "e3")).toBeUndefined();
  });
});

describe("matchExistingCustomer (EXC-002)", () => {
  it("matches a lead email domain to an account", () => {
    const accounts = [{ accountId: "a1", ownerId: "o1", domain: "acme.com" }, { accountId: "a2", ownerId: null, domain: "beta.io" }];
    expect(matchExistingCustomer("jane@acme.com", accounts)?.accountId).toBe("a1");
    expect(matchExistingCustomer("x@nowhere.com", accounts)).toBeNull();
    expect(matchExistingCustomer("no-at", accounts)).toBeNull();
    expect(emailDomain("a@b.com")).toBe("b.com");
  });
});

describe("aggregateStakeholderEngagement (EXC-003)", () => {
  it("groups multi-stakeholder orgs and aggregates engagement", () => {
    const groups = aggregateStakeholderEngagement([
      { id: "1", companyName: "Acme", ownerId: "o1", engagement: 40 },
      { id: "2", companyName: "Acme", ownerId: null, engagement: 60 },
      { id: "3", companyName: "Solo", ownerId: "o2", engagement: 30 }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].organization).toBe("Acme");
    expect(groups[0].stakeholderCount).toBe(2);
    expect(groups[0].totalEngagement).toBe(100);
    expect(groups[0].averageEngagement).toBe(50);
    expect(groups[0].ownerId).toBe("o1");
  });
});

describe("checkStageRegression (EXC-005)", () => {
  it("detects backward moves and requires approval for late-stage regression", () => {
    expect(checkStageRegression("proposal", "qualification")).toMatchObject({ isRegression: true, requiresApproval: true });
    expect(checkStageRegression("qualification", "discovery")).toMatchObject({ isRegression: true, requiresApproval: false });
    expect(checkStageRegression("discovery", "proposal")).toMatchObject({ isRegression: false, requiresApproval: false });
  });
});

describe("computeMarginRisk (EXC-009)", () => {
  it("computes margin after discount and flags high-risk for senior approval", () => {
    const healthy = computeMarginRisk(1000, 500, 10); // net 900, margin 400/900 = 44%
    expect(healthy.netPrice).toBe(900);
    expect(healthy.marginPct).toBe(44);
    expect(healthy.riskLevel).toBe("healthy");
    expect(healthy.requiresSeniorApproval).toBe(false);

    const risky = computeMarginRisk(1000, 800, 30); // net 700, margin -100/700 = -14%
    expect(risky.marginPct).toBeLessThan(15);
    expect(risky.riskLevel).toBe("high_risk");
    expect(risky.requiresSeniorApproval).toBe(true);
  });
});
