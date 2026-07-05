import { describe, expect, it } from "vitest";
import {
  buildImportTemplateCsv,
  bulkImportEntities,
  bulkImportSpecs,
  maxBulkImportRows,
  parseCsv,
  parseImportRows
} from "@crm/types";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"]
    ]);
  });

  it("handles quoted cells with commas, escaped quotes, and newlines", () => {
    const text = 'name,note\n"Verma, Asha","She said ""hello""\nsecond line"';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Verma, Asha", 'She said "hello"\nsecond line']
    ]);
  });

  it("handles CRLF line endings and skips blank lines", () => {
    expect(parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"]
    ]);
  });
});

describe("import templates (fixed format per entity)", () => {
  it("ships a template for every entity whose header matches the spec", () => {
    for (const entity of bulkImportEntities) {
      const csv = buildImportTemplateCsv(entity);
      const [header] = parseCsv(csv);
      expect(header).toEqual(bulkImportSpecs[entity].map((column) => column.key));
    }
  });
});

describe("parseImportRows", () => {
  it("accepts the template's own format", () => {
    const result = parseImportRows("lead", buildImportTemplateCsv("lead"));
    expect(result.formatErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].first_name).toBe("Asha");
  });

  it("accepts reordered columns but rejects missing and unknown ones", () => {
    const reordered = parseImportRows("account", "owner_email,name\n,Acme School");
    expect(reordered.formatErrors).toEqual([]);
    expect(reordered.rows[0].name).toBe("Acme School");

    const missing = parseImportRows("lead", "first_name,last_name\nA,B");
    expect(missing.formatErrors.some((error) => error.includes("Missing required column"))).toBe(true);

    const unknown = parseImportRows("account", "name,shoe_size\nAcme,44");
    expect(unknown.formatErrors.some((error) => error.includes("Unknown column"))).toBe(true);
  });

  it("rejects empty files, header-only files, and oversized files", () => {
    expect(parseImportRows("lead", "").formatErrors).toContain("The file is empty.");
    expect(
      parseImportRows("account", "name,website,industry,account_type,health_status,owner_email").formatErrors.some((error) =>
        error.includes("no data rows")
      )
    ).toBe(true);

    const bigBody = Array.from({ length: maxBulkImportRows + 1 }, (_, index) => `Account ${index},,,,,`).join("\n");
    const oversized = parseImportRows("account", `name,website,industry,account_type,health_status,owner_email\n${bigBody}`);
    expect(oversized.formatErrors.some((error) => error.includes("Too many rows"))).toBe(true);
  });

  it("trims cells and keys them by the fixed column names", () => {
    const result = parseImportRows("contact", "first_name,last_name,email,phone,account_name,role,linkedin_url,owner_email\n  Rohit , Sharma ,,,,,,");
    expect(result.rows[0]).toMatchObject({ first_name: "Rohit", last_name: "Sharma", email: "" });
  });
});
