import { describe, expect, it } from "vitest";
import { bugSeverities, bugSyncStatuses, isRcaRequired } from "@crm/types";

describe("isRcaRequired", () => {
  it("requires RCA for critical/urgent incidents only", () => {
    expect(isRcaRequired("urgent")).toBe(true);
    expect(isRcaRequired("critical")).toBe(true);
    expect(isRcaRequired("high")).toBe(false);
    expect(isRcaRequired("medium")).toBe(false);
    expect(isRcaRequired(null)).toBe(false);
  });
});

describe("bug enums", () => {
  it("expose severity + sync-status vocabularies", () => {
    expect(bugSeverities).toContain("critical");
    expect(bugSyncStatuses).toContain("fixed");
    expect(bugSyncStatuses).toContain("wont_fix");
  });
});
