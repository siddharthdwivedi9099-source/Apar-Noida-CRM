import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", permissionCodes: ["support.view", "support.edit"] },
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

vi.mock("@/lib/api-client", () => ({
  apiRequest: () => new Promise(() => {}),
  ApiClientError: class ApiClientError extends Error {}
}));

import { SupportPage } from "@/pages/support-page";

describe("Ticket / support page", () => {
  it("mounts and shows its loading surface while tickets load", () => {
    const { container } = render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText(/loading support workspace/i)).toBeInTheDocument();
  });
});
