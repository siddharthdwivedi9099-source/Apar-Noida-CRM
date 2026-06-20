import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["leads.view", "leads.create"] },
    session: { id: "s1" },
    accessToken: "test-token",
    isAuthenticated: true,
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    login: vi.fn(),
    logout: vi.fn(),
    reloadCurrentUser: vi.fn()
  })
}));

vi.mock("@/providers/tenant-config-provider", () => ({
  useTenantConfig: () => ({
    status: "ready",
    errorMessage: null,
    tenant: null,
    settings: {},
    theme: {},
    modules: [],
    terminology: [],
    summary: {},
    reload: vi.fn(),
    isModuleEnabled: () => true,
    getModuleLabel: (key: string) => key
  })
}));

vi.mock("@/lib/api-client", () => ({
  apiRequest: () => new Promise(() => {}),
  ApiClientError: class ApiClientError extends Error {}
}));

import { LeadFormPage } from "@/pages/lead-form-page";

describe("Lead form", () => {
  it("mounts inside the create route and shows its loading/preparation surface", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/leads/new"]}>
        <Routes>
          <Route path="/leads/new" element={<LeadFormPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getAllByText(/loading|preparing/i).length).toBeGreaterThan(0);
  });
});
