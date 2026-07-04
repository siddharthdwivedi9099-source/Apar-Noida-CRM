import { describe, expect, it } from "vitest";
import { computeQueueWeight, rankKnowledgeArticles, suggestTicketClassification } from "@crm/types";

describe("suggestTicketClassification", () => {
  it("flags urgent outages and technical/billing/access categories", () => {
    expect(suggestTicketClassification("Production is down", "Critical outage")).toMatchObject({ urgency: "urgent", categoryKey: "technical" });
    expect(suggestTicketClassification("Invoice wrong", "billing charge dispute")).toMatchObject({ categoryKey: "billing" });
    expect(suggestTicketClassification("Cannot access the system", "password reset")).toMatchObject({ urgency: "urgent", categoryKey: "access" });
    expect(suggestTicketClassification("How to export", "question about documentation")).toMatchObject({ urgency: "low", categoryKey: "general" });
  });
  it("defaults to medium with no strong signal", () => {
    expect(suggestTicketClassification("Hello", "general note").urgency).toBe("medium");
  });
});

describe("rankKnowledgeArticles", () => {
  it("ranks by token overlap, ignoring stopwords", () => {
    const ranked = rankKnowledgeArticles("password reset login problem", [
      { id: "a1", title: "Reset your password", body: "login password steps" },
      { id: "a2", title: "Billing FAQ", body: "invoice payment" },
      { id: "a3", title: "Login problem troubleshooting", body: "login problem" }
    ]);
    expect(ranked[0].id).toBe("a1");
    expect(ranked.find((entry) => entry.id === "a2")).toBeUndefined();
    expect(ranked.map((entry) => entry.id)).toContain("a3");
  });
});

describe("computeQueueWeight", () => {
  it("orders breached + urgent first", () => {
    expect(computeQueueWeight("breached", "urgent")).toBeLessThan(computeQueueWeight("at_risk", "urgent"));
    expect(computeQueueWeight("on_track", "urgent")).toBeLessThan(computeQueueWeight("on_track", "low"));
    expect(computeQueueWeight("breached", "low")).toBeLessThan(computeQueueWeight("at_risk", "urgent"));
  });
});
