import { describe, expect, it } from "vitest";
import {
  roleAccessExpectations,
  evaluateRoleAccessExpectation,
  findRoleAccessExpectation,
  defaultRoleTemplateDefinitions
} from "@crm/types";

const templateBySlug = new Map(defaultRoleTemplateDefinitions.map((t) => [t.slug, t]));

describe("Section 15: role-based access expectations", () => {
  it("defines all 14 required role groups", () => {
    expect(roleAccessExpectations.length).toBe(14);
    const roles = roleAccessExpectations.map((r) => r.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it("maps every expectation to an existing seeded role template", () => {
    for (const expectation of roleAccessExpectations) {
      expect(templateBySlug.has(expectation.templateSlug), `missing template ${expectation.templateSlug}`).toBe(true);
    }
  });

  it("each role template grants everything Section 15 requires and denies everything it forbids", () => {
    const failures: string[] = [];
    for (const expectation of roleAccessExpectations) {
      const template = templateBySlug.get(expectation.templateSlug)!;
      const result = evaluateRoleAccessExpectation(template.permissionCodes, expectation);
      if (!result.satisfied) {
        failures.push(`${expectation.role} (${expectation.templateSlug}) missing=[${result.missing.join(", ")}] violations=[${result.violations.join(", ")}]`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("enforces the headline denial: Marketing cannot close opportunities", () => {
    const marketing = findRoleAccessExpectation("Marketing")!;
    const template = templateBySlug.get(marketing.templateSlug)!;
    expect(template.permissionCodes).not.toContain("opportunities.approve");
    expect(template.permissionCodes).not.toContain("opportunities.edit");
  });

  it("keeps external roles (Partner, Customer Portal User) out of admin and the sales pipeline", () => {
    for (const role of ["Partner", "Customer Portal User"]) {
      const expectation = findRoleAccessExpectation(role)!;
      const template = templateBySlug.get(expectation.templateSlug)!;
      const result = evaluateRoleAccessExpectation(template.permissionCodes, expectation);
      expect(result.satisfied).toBe(true);
      expect(expectation.recordScope).toBe("own");
    }
  });
});
