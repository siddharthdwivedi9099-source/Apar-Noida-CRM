import { describe, expect, it } from "vitest";
import {
  buildPermissionCode,
  defaultPermissionCatalog,
  defaultRoleTemplateDefinitions,
  permissionActionKeys,
  permissionModuleKeys
} from "@crm/types";

describe("RBAC: permission catalog", () => {
  it("defines a permission for every module x action combination", () => {
    expect(defaultPermissionCatalog.length).toBe(permissionModuleKeys.length * permissionActionKeys.length);
  });

  it("contains no duplicate permission codes", () => {
    const codes = defaultPermissionCatalog.map((permission) => permission.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("includes the admin permissions used to gate audit + governance routes", () => {
    const codes = new Set(defaultPermissionCatalog.map((permission) => permission.code));
    for (const action of ["view", "export", "configure", "view_dashboard", "manage_workflow"] as const) {
      expect(codes.has(buildPermissionCode("admin", action))).toBe(true);
    }
  });

  it("builds permission codes as module.action", () => {
    expect(buildPermissionCode("leads", "create")).toBe("leads.create");
  });
});

describe("RBAC: seeded role templates", () => {
  it("seeds role templates with unique slugs and non-empty permission sets", () => {
    expect(defaultRoleTemplateDefinitions.length).toBeGreaterThan(0);
    const slugs = defaultRoleTemplateDefinitions.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("grants the super admin template every catalog permission", () => {
    const superAdmin = defaultRoleTemplateDefinitions.find((template) => template.slug === "super-admin");
    expect(superAdmin).toBeTruthy();
    expect(superAdmin?.permissionCodes.length).toBe(defaultPermissionCatalog.length);
  });

  it("only references permission codes that exist in the catalog", () => {
    const catalog = new Set(defaultPermissionCatalog.map((permission) => permission.code));
    for (const template of defaultRoleTemplateDefinitions) {
      for (const code of template.permissionCodes) {
        expect(catalog.has(code)).toBe(true);
      }
    }
  });
});
