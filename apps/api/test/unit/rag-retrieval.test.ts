import { describe, expect, it } from "vitest";
import { defaultKnowledgeSources, knowledgeAccessScopes, knowledgeArticleStatuses } from "@crm/types";

describe("RAG: knowledge source baseline", () => {
  it("seeds knowledge sources with unique keys", () => {
    expect(defaultKnowledgeSources.length).toBeGreaterThan(0);
    const keys = defaultKnowledgeSources.map((source) => source.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("models tenant-wide vs restricted access scopes", () => {
    expect(knowledgeAccessScopes).toContain("tenant");
    expect(knowledgeAccessScopes).toContain("restricted");
  });

  it("attaches a required permission to every restricted source and none to tenant-wide ones", () => {
    for (const source of defaultKnowledgeSources) {
      if (source.accessScope === "restricted") {
        expect(source.requiredPermission, `${source.key} should gate restricted access`).toBeTruthy();
      } else {
        expect(source.requiredPermission).toBeNull();
      }
    }
  });

  it("exposes a customer-safe retrieval surface (tenant-scope, no required permission)", () => {
    // The customer query bot only retrieves from approved articles in tenant-scoped
    // sources that require no internal permission. There must be at least one.
    const customerSafe = defaultKnowledgeSources.filter(
      (source) => source.accessScope === "tenant" && source.requiredPermission === null
    );
    expect(customerSafe.length).toBeGreaterThan(0);
  });

  it("publishes an 'approved' article status used by customer-safe retrieval", () => {
    expect(knowledgeArticleStatuses).toContain("approved");
  });
});
