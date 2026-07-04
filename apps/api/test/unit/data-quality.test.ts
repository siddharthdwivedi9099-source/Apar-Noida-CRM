import { describe, expect, it } from "vitest";
import {
  computeCompleteness,
  isStale,
  isValidEmail,
  isValidPhone,
  resolveMergedRecord,
  validateImportRows
} from "@crm/types";

describe("isValidEmail / isValidPhone", () => {
  it("validates emails", () => {
    expect(isValidEmail("jane@acme.com")).toBe(true);
    expect(isValidEmail("jane@acme")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
  it("validates phones by pattern and digit count", () => {
    expect(isValidPhone("+1 (415) 555-1234")).toBe(true);
    expect(isValidPhone("555")).toBe(false); // too few digits
    expect(isValidPhone("abcd")).toBe(false);
  });
});

describe("computeCompleteness", () => {
  it("counts filled vs missing required fields", () => {
    const r = computeCompleteness({ firstName: "Jane", lastName: "", email: null, phone: "123" }, ["firstName", "lastName", "email", "phone"]);
    expect(r.filled).toBe(2);
    expect(r.total).toBe(4);
    expect(r.pct).toBe(50);
    expect(r.missing).toEqual(["lastName", "email"]);
  });
});

describe("isStale", () => {
  const now = 1_000_000_000_000;
  it("flags records with no or old activity", () => {
    expect(isStale(null, now, 60)).toBe(true);
    expect(isStale(new Date(now - 70 * 86_400_000).toISOString(), now, 60)).toBe(true);
    expect(isStale(new Date(now - 10 * 86_400_000).toISOString(), now, 60)).toBe(false);
  });
});

describe("validateImportRows", () => {
  it("catches mandatory, format, allowed-value, consent, and batch-duplicate errors", () => {
    const rows = [
      { firstName: "Jane", lastName: "Doe", companyName: "Acme", email: "jane@acme.com", sourceKey: "website", consent: "granted" },
      { firstName: "", lastName: "Roe", companyName: "Beta", email: "bad-email", phone: "12", sourceKey: "unknown_source" },
      { firstName: "Jim", lastName: "Poe", companyName: "Acme", email: "jane@acme.com", consent: "no" }
    ];
    const summary = validateImportRows(rows, { mandatoryFields: ["firstName", "lastName", "companyName"], requireConsent: true, allowedValues: { sourceKey: ["website", "referral"] } });
    expect(summary.totalRows).toBe(3);
    expect(summary.validRows).toBe(1);
    expect(summary.errorRows).toBe(2);
    const row2 = summary.rows[1].errors.map((e) => e.code);
    expect(row2).toContain("missing_mandatory");
    expect(row2).toContain("invalid_email");
    expect(row2).toContain("invalid_phone");
    expect(row2).toContain("invalid_value");
    expect(row2).toContain("consent_missing");
    const row3 = summary.rows[2].errors.map((e) => e.code);
    expect(row3).toContain("duplicate_in_batch");
    expect(row3).toContain("consent_missing");
  });
});

describe("resolveMergedRecord", () => {
  it("keeps master by default and takes duplicate where selected", () => {
    const master = { firstName: "Jane", lastName: "Doe", email: "jane@acme.com", phone: null };
    const duplicate = { firstName: "Janet", lastName: "Doe", email: "janet@acme.com", phone: "+1 415 555 1234" };
    const merged = resolveMergedRecord(master, duplicate, { email: "duplicate", phone: "duplicate" });
    expect(merged.firstName).toBe("Jane"); // not selected -> master
    expect(merged.email).toBe("janet@acme.com"); // selected -> duplicate
    expect(merged.phone).toBe("+1 415 555 1234");
  });
});
