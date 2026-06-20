import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["opportunities.view", "opportunities.create"] },
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

import { OpportunitiesPage } from "@/pages/opportunities-page";

describe("Opportunity board", () => {
  it("mounts and shows its loading surface while the pipeline loads", () => {
    const { container } = render(
      <MemoryRouter>
        <OpportunitiesPage />
      </MemoryRouter>
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
