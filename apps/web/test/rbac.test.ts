import { describe, expect, it } from "vitest";
import {
  getModuleAccessPermissionCodes,
  getSpecificPermissionCodes,
  hasAllPermissions,
  hasAnyPermission,
  routePermissionRequirements
} from "@/lib/rbac";

describe("Frontend RBAC: permission helpers", () => {
  it("hasAnyPermission matches when at least one code is held", () => {
    expect(hasAnyPermission(["leads.view"], ["leads.view", "leads.edit"])).toBe(true);
    expect(hasAnyPermission(["accounts.view"], ["leads.view"])).toBe(false);
  });

  it("hasAllPermissions requires every code", () => {
    expect(hasAllPermissions(["admin.view", "admin.configure"], ["admin.view", "admin.configure"])).toBe(true);
    expect(hasAllPermissions(["admin.view"], ["admin.view", "admin.configure"])).toBe(false);
  });

  it("builds module access and specific permission code sets", () => {
    expect(getModuleAccessPermissionCodes("leads")).toContain("leads.view");
    expect(getSpecificPermissionCodes("leads", ["create"])).toEqual(["leads.create"]);
  });
});

describe("Frontend RBAC: role-based navigation gating", () => {
  it("only surfaces a route when the user holds one of its required permissions", () => {
    const supportAgent = ["support.view", "support.edit"];
    expect(hasAnyPermission(supportAgent, routePermissionRequirements.support)).toBe(true);
    expect(hasAnyPermission(supportAgent, routePermissionRequirements.admin)).toBe(false);
    expect(hasAnyPermission(supportAgent, routePermissionRequirements.opportunities)).toBe(false);
  });

  it("gates the admin area behind admin permissions", () => {
    expect(hasAnyPermission(["admin.view"], routePermissionRequirements.admin)).toBe(true);
    expect(hasAnyPermission(["leads.view"], routePermissionRequirements.admin)).toBe(false);
  });

  it("lets a sales manager reach sales surfaces but not the customer portal", () => {
    const salesManager = ["leads.view", "opportunities.view", "accounts.view", "dashboards.view"];
    expect(hasAnyPermission(salesManager, routePermissionRequirements.opportunities)).toBe(true);
    expect(hasAnyPermission(salesManager, routePermissionRequirements.dashboard)).toBe(true);
    expect(hasAnyPermission(salesManager, routePermissionRequirements.customerPortal)).toBe(false);
  });
});
