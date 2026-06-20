import { describe, expect, it } from "vitest";
import { customerQueryEscalationReasons } from "@crm/types";
import { buildAnswer, classifyLevel, computeConfidence } from "../../src/modules/customer-query/customer-query.service";

describe("Customer query: severity classification", () => {
  it("classifies critical/security/billing keywords as level 3 (always escalated)", () => {
    expect(classifyLevel("We have a total outage and data loss")).toBe(3);
    expect(classifyLevel("There may be a security breach")).toBe(3);
    expect(classifyLevel("I need a refund for an incorrect invoice")).toBe(3);
  });

  it("classifies troubleshooting keywords as level 2", () => {
    expect(classifyLevel("My dashboard is not working")).toBe(2);
    expect(classifyLevel("I get access denied on a workflow")).toBe(2);
  });

  it("classifies general questions as level 1", () => {
    expect(classifyLevel("How do I add a new contact?")).toBe(1);
  });

  it("exposes the canonical escalation reasons", () => {
    expect(customerQueryEscalationReasons).toContain("level_3");
    expect(customerQueryEscalationReasons).toContain("low_confidence");
    expect(customerQueryEscalationReasons).toContain("no_answer");
  });
});

describe("Customer query: confidence + answer construction", () => {
  it("returns zero confidence with no citations", () => {
    expect(computeConfidence([])).toBe(0);
  });

  it("increases confidence with stronger, more numerous citations", () => {
    const weak = computeConfidence([{ snippet: "a", score: 1 } as never]);
    const strong = computeConfidence([
      { snippet: "a", score: 5 } as never,
      { snippet: "b", score: 4 } as never,
      { snippet: "c", score: 3 } as never
    ]);
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(1);
  });

  it("falls back to an escalation message when there are no approved citations", () => {
    expect(buildAnswer([], true)).toMatch(/escalated it to our team/i);
  });

  it("includes a routed-to-team note when an answer is escalated", () => {
    const answer = buildAnswer([{ snippet: "Reset from settings", sourceName: "KB", score: 5 } as never], true);
    expect(answer).toMatch(/Based on our approved knowledge sources/i);
    expect(answer).toMatch(/routed it to our team/i);
  });
});
