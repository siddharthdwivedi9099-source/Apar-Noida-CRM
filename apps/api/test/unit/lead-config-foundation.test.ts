import { describe, expect, it } from "vitest";
import { defaultCoreCrmConfigurationDefinitions, defaultCoreCrmStandardPicklistDefinitions } from "@crm/types";

interface FieldShape {
  key: string;
  type: string;
  optionSetKey?: string;
  sensitive?: boolean;
  aiUsable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
}

const leadObject = defaultCoreCrmConfigurationDefinitions.find(
  (def) => def.definitionType === "object" && def.definitionKey === "lead"
);
const fields = ((leadObject?.definition.keyFields as FieldShape[] | undefined) ?? []);
const fieldKeys = new Set(fields.map((field) => field.key));
const picklistKeys = new Set(defaultCoreCrmStandardPicklistDefinitions.map((set) => set.setKey));

describe("lead configuration foundation", () => {
  it("registers the lead object definition", () => {
    expect(leadObject).toBeDefined();
    expect(fields.length).toBeGreaterThan(30);
  });

  it("includes the full PROMPT-05 lead field catalog", () => {
    const expected = [
      "firstName", "lastName", "designation", "department", "website",
      "industry", "region", "segment", "productInterest",
      "captureSource", "leadSource", "subSource", "campaign",
      "utmSource", "utmMedium", "utmCampaign", "firstTouchSource", "latestTouchSource",
      "consentStatus", "leadScore", "fitScore", "engagementScore", "intentScore", "aiScore",
      "leadGrade", "leadStatus", "owner", "assignmentDate", "slaDueDate",
      "attemptCount", "lastActivity", "nextFollowUp", "qualificationStatus",
      "disqualificationReason", "revisitDate"
    ];
    for (const key of expected) {
      expect(fieldKeys.has(key), `missing lead field "${key}"`).toBe(true);
    }
  });

  it("references only existing picklists for option-backed fields (no broken references)", () => {
    for (const field of fields) {
      if (field.optionSetKey) {
        expect(picklistKeys.has(field.optionSetKey), `field "${field.key}" -> unknown option set "${field.optionSetKey}"`).toBe(true);
      }
    }
  });

  it("adds the new lead picklists", () => {
    for (const key of ["lead-capture-source", "lead-sub-source", "lead-grade", "qualification-status", "disqualification-reason", "consent-status"]) {
      expect(picklistKeys.has(key), `missing picklist "${key}"`).toBe(true);
    }
  });

  it("flags sensitive and AI-usable lead fields", () => {
    expect(fields.find((field) => field.key === "email")?.sensitive).toBe(true);
    expect(fields.find((field) => field.key === "phone")?.sensitive).toBe(true);
    expect(fields.find((field) => field.key === "consentStatus")?.sensitive).toBe(true);
    expect(fields.find((field) => field.key === "leadScore")?.aiUsable).toBe(true);
    expect(fields.find((field) => field.key === "aiScore")?.aiUsable).toBe(true);
  });

  it("keeps each new picklist non-empty with a single default", () => {
    const newKeys = new Set(["lead-capture-source", "lead-sub-source", "lead-grade", "qualification-status", "disqualification-reason", "consent-status"]);
    for (const set of defaultCoreCrmStandardPicklistDefinitions.filter((entry) => newKeys.has(entry.setKey))) {
      expect(set.values.length).toBeGreaterThan(0);
      expect(set.values.filter((value) => value.isDefault).length).toBeLessThanOrEqual(1);
    }
  });
});
